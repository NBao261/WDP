import { Reservation, IReservation, ReservationStatus } from '../models/reservation.model';
import { ParkingSlot, SlotStatus } from '../models/parkingSlot.model';
import { ParkingFacility } from '../models/parkingFacility.model';
import { VehicleType } from '../models/vehicleType.model';
import { PricingPlan } from '../models/pricingPlan.model';
import { AppError } from '../middlewares/error.middleware';
import { logger } from '../config/logger';
import { generateReservationCode } from '../utils/codeGenerator';
import { getIO } from '../config/socket';
import { getCache, setCache, delPattern } from '../config/redis';
import { addReservationExpiryAlertJob } from '../queues/reservationQueue';

export class ReservationService {
  static async createReservation(userId: string, data: {
    facilityId: string;
    vehicleTypeId: string;
    licensePlate: string;
    startTime: string;
  }): Promise<IReservation> {
    const { facilityId, vehicleTypeId, licensePlate, startTime } = data;
    const normalizedPlate = licensePlate.toUpperCase().trim();
    const start = new Date(startTime);
    const now = new Date();

    const facility = await ParkingFacility.findById(facilityId).lean();
    if (!facility) throw new AppError('Bãi xe không tồn tại', 404);
    if (facility.status !== 'active') throw new AppError('Bãi xe hiện đang không hoạt động', 400);

    const startStr = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;

    if (facility.openTime !== facility.closeTime) {
      if (facility.openTime < facility.closeTime) {
        if (startStr < facility.openTime || startStr >= facility.closeTime) {
          throw new AppError(`Thời gian đặt chỗ phải nằm trong giờ hoạt động: ${facility.openTime} - ${facility.closeTime}`, 400);
        }
      } else {
        if (startStr < facility.openTime && startStr >= facility.closeTime) {
          throw new AppError(`Thời gian đặt chỗ phải nằm trong giờ hoạt động: ${facility.openTime} - ${facility.closeTime}`, 400);
        }
      }
    }

    const vehicleType = await VehicleType.findById(vehicleTypeId).lean();
    if (!vehicleType) throw new AppError('Loại xe không tồn tại', 404);

    const pricingPlan = await PricingPlan.findOne({
      facilityId,
      vehicleTypeId,
      status: 'active',
      isDeleted: false,
    });

    if (!pricingPlan) {
      throw new AppError('Bãi xe chưa có bảng giá áp dụng cho loại xe này', 400);
    }

    const minAdvanceMs = 5 * 60 * 1000;
    if (start.getTime() - now.getTime() < minAdvanceMs) {
      throw new AppError('Phải đặt trước ít nhất 5 phút so với thời gian bắt đầu', 400);
    }

    const activeCount = await Reservation.countDocuments({
      userId,
      status: { $in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] },
    });
    if (activeCount >= 2) {
      throw new AppError('Bạn chỉ có thể có tối đa 2 đặt chỗ đang hoạt động', 400);
    }

    const existingPlateReservation = await Reservation.findOne({
      licensePlate: normalizedPlate,
      status: { $in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] },
    });
    if (existingPlateReservation) {
      throw new AppError(`Biển số ${normalizedPlate} đang có một đặt chỗ chưa sử dụng. Vui lòng sử dụng hoặc hủy đặt chỗ hiện tại trước khi tạo mới.`, 400);
    }

    const availableSlot = await ParkingSlot.findOneAndUpdate(
      {
        facilityId,
        vehicleTypeId,
        status: SlotStatus.AVAILABLE,
        isDeleted: false,
      },
      { status: SlotStatus.RESERVED },
      { new: true },
    );

    if (!availableSlot) {
      throw new AppError('Không còn slot trống cho loại xe này trong khung giờ yêu cầu', 400);
    }

    let reservationCode = generateReservationCode();
    let retries = 5;
    while (retries > 0) {
      const codeExists = await Reservation.findOne({ code: reservationCode }).lean();
      if (!codeExists) break;
      reservationCode = generateReservationCode();
      retries--;
    }
    if (retries === 0) {
      await ParkingSlot.findByIdAndUpdate(availableSlot._id, { status: SlotStatus.AVAILABLE });
      throw new AppError('Không thể tạo mã đặt chỗ. Vui lòng thử lại.', 500);
    }

    let reservation: IReservation;
    try {
      reservation = await Reservation.create({
        code: reservationCode,
        userId,
        facilityId,
        vehicleTypeId,
        slotId: availableSlot._id,
        licensePlate: normalizedPlate,
        startTime: start,
        status: ReservationStatus.CONFIRMED,
      });
    } catch (err) {
      await ParkingSlot.findByIdAndUpdate(availableSlot._id, { status: SlotStatus.AVAILABLE });
      throw err;
    }
    
    try {
      getIO().to(`facility:${facilityId}`).emit('slot:statusChanged', {
        slotId: availableSlot._id,
        status: SlotStatus.RESERVED,
        facilityId: facilityId,
      });
    } catch (e) {}

    delPattern(`cache:reservations:user:${userId}:*`).catch(() => {});
    if (facilityId) {
      delPattern(`cache:reservations:facility:${facilityId}:*`).catch(() => {});
    }

    logger.info(`Reservation created: ${reservation._id} (${reservationCode}) by user ${userId}, slot ${availableSlot.code}, plate ${normalizedPlate}`);

    const alertTime = new Date(reservation.startTime.getTime() + 5 * 60 * 1000);
    const delayMs = alertTime.getTime() - Date.now();
    if (delayMs > 0) {
      await addReservationExpiryAlertJob(reservation._id.toString(), delayMs);
    }

    return reservation.populate([
      { path: 'facilityId', select: 'name address' },
      { path: 'vehicleTypeId', select: 'name' },
      { path: 'slotId', select: 'code floorId' },
    ]);
  }

  static async cancelReservation(reservationId: string, userId: string): Promise<IReservation> {
    const reservation = await Reservation.findById(reservationId);
    if (!reservation) throw new AppError('Đặt chỗ không tồn tại', 404);

    if (reservation.userId.toString() !== userId) {
      throw new AppError('Bạn không có quyền hủy đặt chỗ này', 403);
    }

    if (![ReservationStatus.PENDING, ReservationStatus.CONFIRMED].includes(reservation.status)) {
      throw new AppError('Không thể hủy đặt chỗ đã sử dụng hoặc đã hủy', 400);
    }

    const now = new Date();
    const hoursUntilStart = (reservation.startTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    let cancellationFee = 0;

    if (hoursUntilStart < 2) {
      cancellationFee = 10000;
    }

    reservation.status = ReservationStatus.CANCELLED;
    reservation.cancellationFee = cancellationFee;
    await reservation.save();

    if (reservation.slotId) {
      await ParkingSlot.findByIdAndUpdate(reservation.slotId, {
        status: SlotStatus.AVAILABLE,
      });
      
      try {
        getIO().to(`facility:${reservation.facilityId}`).emit('slot:statusChanged', {
          slotId: reservation.slotId,
          status: SlotStatus.AVAILABLE,
          facilityId: reservation.facilityId,
        });
      } catch (e) {}
    }
    
    delPattern(`cache:reservations:user:${userId}:*`).catch(() => {});
    if (reservation.facilityId) {
      delPattern(`cache:reservations:facility:${reservation.facilityId}:*`).catch(() => {});
    }

    logger.info(`Reservation cancelled: ${reservationId} by user ${userId}, fee: ${cancellationFee}`);

    return reservation;
  }

  static async getReservations(
    userId: string,
    role: string,
    query: any
  ): Promise<{ data: IReservation[]; total: number; page: number; totalPages: number }> {
    const page = query?.page || 1;
    const limit = query?.limit || 10;
    const skip = (page - 1) * limit;

    const filter: any = {};

    if (role === 'driver') {
      filter.userId = userId;
    }

    if (query?.status) filter.status = query.status;
    if (query?.facilityId) filter.facilityId = query.facilityId;

    const sortBy = query?.sortBy || 'createdAt';
    const sortOrder = query?.sortOrder === 'asc' ? 1 : -1;

    let cacheKey = '';
    if (role === 'driver') {
      cacheKey = `cache:reservations:user:${userId}:${Buffer.from(JSON.stringify(query)).toString('base64')}`;
    } else if (query?.facilityId) {
      cacheKey = `cache:reservations:facility:${query.facilityId}:${Buffer.from(JSON.stringify(query)).toString('base64')}`;
    }
    
    if (cacheKey) {
      const cached = await getCache(cacheKey);
      if (cached) return cached;
    }

    const [data, total] = await Promise.all([
      Reservation.find(filter)
        .populate('facilityId', 'name address')
        .populate('vehicleTypeId', 'name code')
        .populate('slotId', 'code floorId')
        .populate('userId', 'fullName email phone')
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      Reservation.countDocuments(filter),
    ]);

    const result = {
      data: data as any[],
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
    
    if (cacheKey) {
      await setCache(cacheKey, result, 300);
    }
    
    return result;
  }

  static async autoExpireReservations(): Promise<number> {
    const now = new Date();
    const graceMs = 15 * 60 * 1000;

    const expiredReservations = await Reservation.find({
      status: { $in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] },
      startTime: { $lte: new Date(now.getTime() - graceMs) },
    });

    let count = 0;
    for (const reservation of expiredReservations) {
      reservation.status = ReservationStatus.EXPIRED;
      await reservation.save();

      if (reservation.slotId) {
        await ParkingSlot.findByIdAndUpdate(reservation.slotId, {
          status: SlotStatus.AVAILABLE,
        });
      }

      count++;
    }

    if (count > 0) {
      logger.info(`Auto-expired ${count} reservations`);
    }

    return count;
  }

  static async convertToCheckedIn(reservationId: string): Promise<IReservation> {
    const reservation = await Reservation.findById(reservationId);
    if (!reservation) throw new AppError('Đặt chỗ không tồn tại', 404);

    if (reservation.status !== ReservationStatus.CONFIRMED) {
      throw new AppError('Đặt chỗ không ở trạng thái có thể check-in', 400);
    }

    reservation.status = ReservationStatus.CHECKED_IN;
    await reservation.save();

    // Clear reservation cache để mobile nhận status mới ngay lập tức
    delPattern(`cache:reservations:user:${reservation.userId}:*`).catch(() => {});
    if (reservation.facilityId) {
      delPattern(`cache:reservations:facility:${reservation.facilityId}:*`).catch(() => {});
    }

    logger.info(`Reservation checked in: ${reservationId}`);
    return reservation;
  }

  static async convertToCompleted(reservationId: string): Promise<IReservation> {
    const reservation = await Reservation.findById(reservationId);
    if (!reservation) throw new AppError('Đặt chỗ không tồn tại', 404);

    if (reservation.status !== ReservationStatus.CHECKED_IN) {
      throw new AppError('Đặt chỗ không ở trạng thái có thể hoàn thành', 400);
    }

    reservation.status = ReservationStatus.COMPLETED;
    await reservation.save();

    delPattern(`cache:reservations:user:${reservation.userId}:*`).catch(() => {});
    if (reservation.facilityId) {
      delPattern(`cache:reservations:facility:${reservation.facilityId}:*`).catch(() => {});
    }

    logger.info(`Reservation completed: ${reservationId}`);
    return reservation;
  }

  static async getReservationById(reservationId: string): Promise<IReservation> {
    const reservation = await Reservation.findById(reservationId)
      .populate('facilityId', 'name address')
      .populate('vehicleTypeId', 'name')
      .populate('slotId', 'code floorId')
      .populate('userId', 'fullName email phone')
      .lean() as any;

    if (!reservation) throw new AppError('Đặt chỗ không tồn tại', 404);
    return reservation;
  }

  static async getByCode(code: string): Promise<IReservation> {
    const reservation = await Reservation.findOne({ code: code.trim().toUpperCase() })
      .populate('facilityId', 'name address openTime closeTime')
      .populate('vehicleTypeId', 'name requiresPlate')
      .populate('slotId', 'code floorId')
      .populate({ path: 'slotId', populate: { path: 'floorId', select: 'name' } })
      .populate('userId', 'fullName name email phone')
      .lean() as any;

    if (!reservation) throw new AppError('Không tìm thấy mã đặt chỗ', 404);

    if (reservation.status !== ReservationStatus.CONFIRMED && reservation.status !== ReservationStatus.CHECKED_IN) {
      const statusMsg: Record<string, string> = {
        cancelled: 'đã bị hủy',
        expired: 'đã hết hạn',
        used: 'đã sử dụng',
        completed: 'đã hoàn thành',
        pending: 'đang chờ xác nhận',
      };
      const msg = statusMsg[reservation.status] || reservation.status;
      throw new AppError(`Đặt chỗ ${msg}, không thể check-in`, 400);
    }

    return reservation;
  }

  static async getByPlate(licensePlate: string, facilityId: string): Promise<IReservation | null> {
    const normalizedPlate = licensePlate.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const earlyWindow = 30 * 60 * 1000;

    const reservation = await Reservation.findOne({
      facilityId,
      status: ReservationStatus.CONFIRMED,
      startTime: {
        $gte: new Date(Date.now() - earlyWindow),
        $lte: new Date(Date.now() + earlyWindow),
      },
    })
      .populate('facilityId', 'name address openTime closeTime')
      .populate('vehicleTypeId', 'name requiresPlate')
      .populate('slotId', 'code floorId')
      .populate({ path: 'slotId', populate: { path: 'floorId', select: 'name' } })
      .populate('userId', 'fullName name email phone')
      .lean() as any;

    if (!reservation) return null;

    const normalizedResPlate = reservation.licensePlate.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (normalizedPlate !== normalizedResPlate) return null;

    return reservation;
  }
}
