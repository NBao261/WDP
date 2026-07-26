import { Reservation, IReservation, ReservationStatus } from '../models/reservation.model';
import { ParkingSlot, SlotStatus } from '../models/parkingSlot.model';
import { ParkingFacility } from '../models/parkingFacility.model';
import { VehicleType } from '../models/vehicleType.model';
import { PricingPlan } from '../models/pricingPlan.model';
import { AppError } from '../middlewares/error.middleware';
import { logger } from '../config/logger';
import { generateReservationCode } from '../utils/codeGenerator';

export class ReservationService {
  /**
   * FR-14.1: Tạo đặt chỗ trước
   * BR-6.1: Chỉ đặt chỗ khi còn slot
   * BR-6.2: Phải đặt trước ít nhất 30 phút
   * BR-6.3: Tối đa 2 reservation active / user
   */
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

    // Validate facility exists and is active
    const facility = await ParkingFacility.findById(facilityId).lean();
    if (!facility) throw new AppError('Bãi xe không tồn tại', 404);
    if (facility.status !== 'active') throw new AppError('Bãi xe hiện đang không hoạt động', 400);

    // Validate facility operating hours
    const startStr = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;

    if (facility.openTime !== facility.closeTime) {
      if (facility.openTime < facility.closeTime) {
        if (startStr < facility.openTime || startStr >= facility.closeTime) {
          throw new AppError(`Thời gian đặt chỗ phải nằm trong giờ hoạt động: ${facility.openTime} - ${facility.closeTime}`, 400);
        }
      } else {
        // Qua đêm (ví dụ 22:00 - 06:00) -> Không hợp lệ nếu nằm trong khoảng 06:00 - 22:00
        if (startStr < facility.openTime && startStr >= facility.closeTime) {
          throw new AppError(`Thời gian đặt chỗ phải nằm trong giờ hoạt động: ${facility.openTime} - ${facility.closeTime}`, 400);
        }
      }
    }

    // Validate vehicle type exists
    const vehicleType = await VehicleType.findById(vehicleTypeId).lean();
    if (!vehicleType) throw new AppError('Loại xe không tồn tại', 404);

    // Validate pricing plan exists
    const pricingPlan = await PricingPlan.findOne({
      facilityId,
      vehicleTypeId,
      status: 'active',
      isDeleted: false,
    });

    if (!pricingPlan) {
      throw new AppError('Bãi xe chưa có bảng giá áp dụng cho loại xe này', 400);
    }

    // BR-6.2: Phải đặt trước ít nhất 5 phút
    const minAdvanceMs = 5 * 60 * 1000;
    if (start.getTime() - now.getTime() < minAdvanceMs) {
      throw new AppError('Phải đặt trước ít nhất 5 phút so với thời gian bắt đầu', 400);
    }

    // BR-6.3: Tối đa 2 reservation active / user
    const activeCount = await Reservation.countDocuments({
      userId,
      status: { $in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] },
    });
    if (activeCount >= 2) {
      throw new AppError('Bạn chỉ có thể có tối đa 2 đặt chỗ đang hoạt động', 400);
    }

    // Chặn tạo nhiều đặt chỗ cho cùng một biển số (chống trùng lặp thời gian chờ)
    const existingPlateReservation = await Reservation.findOne({
      licensePlate: normalizedPlate,
      status: { $in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] },
    });
    if (existingPlateReservation) {
      throw new AppError(`Biển số ${normalizedPlate} đang có một đặt chỗ chưa sử dụng. Vui lòng sử dụng hoặc hủy đặt chỗ hiện tại trước khi tạo mới.`, 400);
    }

    // BR-6.1: Tìm slot trống cho loại xe tại facility
    const availableSlot = await ParkingSlot.findOne({
      facilityId,
      vehicleTypeId,
      status: SlotStatus.AVAILABLE,
      isDeleted: false,
    });

    if (!availableSlot) {
      throw new AppError('Không còn slot trống cho loại xe này trong khung giờ yêu cầu', 400);
    }

    // Sinh mã reservation (đảm bảo unique)
    let reservationCode = generateReservationCode();
    let retries = 5;
    while (retries > 0) {
      const codeExists = await Reservation.findOne({ code: reservationCode }).lean();
      if (!codeExists) break;
      reservationCode = generateReservationCode();
      retries--;
    }
    if (retries === 0) {
      throw new AppError('Không thể tạo mã đặt chỗ. Vui lòng thử lại.', 500);
    }

    // Tạo reservation + lock slot
    const reservation = await Reservation.create({
      code: reservationCode,
      userId,
      facilityId,
      vehicleTypeId,
      slotId: availableSlot._id,
      licensePlate: normalizedPlate,
      startTime: start,
      status: ReservationStatus.CONFIRMED,
    });

    // Chuyển slot sang Reserved
    await ParkingSlot.findByIdAndUpdate(availableSlot._id, {
      status: SlotStatus.RESERVED,
    });

    logger.info(`Reservation created: ${reservation._id} (${reservationCode}) by user ${userId}, slot ${availableSlot.code}, plate ${normalizedPlate}`);

    return reservation.populate([
      { path: 'facilityId', select: 'name address' },
      { path: 'vehicleTypeId', select: 'name' },
      { path: 'slotId', select: 'code floorId' },
    ]);
  }

  /**
   * FR-14.2: Hủy đặt chỗ
   * BR-6.5: Chính sách hủy — hủy trước ≥2h: miễn phí, trong 2h: có phí
   */
  static async cancelReservation(reservationId: string, userId: string): Promise<IReservation> {
    const reservation = await Reservation.findById(reservationId);
    if (!reservation) throw new AppError('Đặt chỗ không tồn tại', 404);

    // Chỉ user tạo mới được hủy
    if (reservation.userId.toString() !== userId) {
      throw new AppError('Bạn không có quyền hủy đặt chỗ này', 403);
    }

    // Chỉ hủy được reservation chưa sử dụng
    if (![ReservationStatus.PENDING, ReservationStatus.CONFIRMED].includes(reservation.status)) {
      throw new AppError('Không thể hủy đặt chỗ đã sử dụng hoặc đã hủy', 400);
    }

    // BR-6.5: Tính phí hủy
    const now = new Date();
    const hoursUntilStart = (reservation.startTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    let cancellationFee = 0;

    if (hoursUntilStart < 2) {
      // Hủy trong vòng 2 giờ: phí cố định 10,000 VND (có thể cấu hình qua SystemConfig)
      cancellationFee = 10000;
    }

    // Cập nhật reservation
    reservation.status = ReservationStatus.CANCELLED;
    reservation.cancellationFee = cancellationFee;
    await reservation.save();

    // Trả lại slot → Available
    if (reservation.slotId) {
      await ParkingSlot.findByIdAndUpdate(reservation.slotId, {
        status: SlotStatus.AVAILABLE,
      });
    }

    logger.info(`Reservation cancelled: ${reservationId} by user ${userId}, fee: ${cancellationFee}`);

    return reservation;
  }

  /**
   * FR-14.2: Xem danh sách đặt chỗ
   * Driver: chỉ xem của mình
   * Manager/Admin: xem tất cả (filter theo facility)
   */
  static async getReservations(
    userId: string,
    role: string,
    query: any
  ): Promise<{ data: IReservation[]; total: number; page: number; totalPages: number }> {
    const page = query?.page || 1;
    const limit = query?.limit || 10;
    const skip = (page - 1) * limit;

    const filter: any = {};

    // Driver chỉ xem của mình
    if (role === 'driver') {
      filter.userId = userId;
    }

    if (query?.status) filter.status = query.status;
    if (query?.facilityId) filter.facilityId = query.facilityId;

    const sortBy = query?.sortBy || 'createdAt';
    const sortOrder = query?.sortOrder === 'asc' ? 1 : -1;

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

    return {
      data: data as any[],
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * BR-6.4: Tự động hủy reservation quá hạn
   * Gọi bởi cron job — chạy mỗi 5 phút
   */
  static async autoExpireReservations(): Promise<number> {
    const now = new Date();
    const graceMs = 15 * 60 * 1000; // 15 phút

    // Tìm reservation đã quá hạn 15 phút mà chưa đến
    const expiredReservations = await Reservation.find({
      status: { $in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] },
      startTime: { $lte: new Date(now.getTime() - graceMs) },
    });

    let count = 0;
    for (const reservation of expiredReservations) {
      reservation.status = ReservationStatus.EXPIRED;
      await reservation.save();

      // Trả lại slot → Available
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

  /**
   * BR-6.6: Chuyển reservation → session
   * Gọi khi Staff check-in xe có reservation
   */
  static async convertToUsed(reservationId: string): Promise<IReservation> {
    const reservation = await Reservation.findById(reservationId);
    if (!reservation) throw new AppError('Đặt chỗ không tồn tại', 404);

    if (reservation.status !== ReservationStatus.CONFIRMED) {
      throw new AppError('Đặt chỗ không ở trạng thái có thể sử dụng', 400);
    }

    reservation.status = ReservationStatus.USED;
    await reservation.save();

    logger.info(`Reservation converted to used: ${reservationId}`);
    return reservation;
  }

  /**
   * Lấy chi tiết reservation theo ID
   */
  static async getReservationById(reservationId: string): Promise<IReservation> {
    const reservation = await Reservation.findById(reservationId)
      .populate('facilityId', 'name address')
      .populate('vehicleTypeId', 'name')
      .populate('slotId', 'code floorId')
      .populate('userId', 'fullName email phone')
      .lean() as any;

    if (!reservation) throw new AppError('\u0110\u1eb7t ch\u1ed7 kh\u00f4ng t\u1ed3n t\u1ea1i', 404);
    return reservation;
  }

  /**
   * Tra c\u1ee9u reservation theo m\u00e3 \u0111\u1eb7t ch\u1ed7 (code)
   * D\u00f9ng b\u1edfi Staff t\u1ea1i c\u1ed5ng khi qu\u00e9t QR ho\u1eb7c nh\u1eadp tay
   */
  static async getByCode(code: string): Promise<IReservation> {
    const reservation = await Reservation.findOne({ code: code.trim().toUpperCase() })
      .populate('facilityId', 'name address openTime closeTime')
      .populate('vehicleTypeId', 'name requiresPlate')
      .populate('slotId', 'code floorId')
      .populate({ path: 'slotId', populate: { path: 'floorId', select: 'name' } })
      .populate('userId', 'fullName name email phone')
      .lean() as any;

    if (!reservation) throw new AppError('Không tìm thấy mã đặt chỗ', 404);

    if (reservation.status !== ReservationStatus.CONFIRMED) {
      const statusMsg: Record<string, string> = {
        cancelled: 'đã bị hủy',
        expired: 'đã hết hạn',
        used: 'đã sử dụng',
        pending: 'đang chờ xác nhận',
      };
      const msg = statusMsg[reservation.status] || reservation.status;
      throw new AppError(`Đặt chỗ ${msg}, không thể check-in`, 400);
    }

    return reservation;
  }
}
