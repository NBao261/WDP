import mongoose from 'mongoose';
import { ParkingSession, IParkingSession, SessionStatus } from '../models/parkingSession.model';
import { ParkingSlot, SlotStatus } from '../models/parkingSlot.model';
import { ParkingFacility } from '../models/parkingFacility.model';
import { VehicleType } from '../models/vehicleType.model';
import { Floor } from '../models/floor.model';
import { PricingPlan } from '../models/pricingPlan.model';
import { User } from '../models/user.model';
import { AppError } from '../middlewares/error.middleware';
import { Exception, ExceptionStatus, ExceptionType } from '../models/exception.model';
import { Reservation, ReservationStatus } from '../models/reservation.model';
import { generateSessionCode, generateCardCode } from '../utils/codeGenerator';
import { getIO } from '../config/socket';
import { delPattern } from '../config/redis';
import { UploadService } from './upload.service';
import { addUploadJob } from '../queues/uploadQueue';
import { getCache, setCache, delCache, sIsMember, sAdd, sRem, getRedlock } from '../config/redis';

interface CheckConditionsResult {
  eligible: boolean;
  reason?: string;
  ownerName?: string;
}

interface SuggestedFloor {
  floorId: string;
  floorName: string;
  availableSlots: number;
  totalSlots: number;
}

interface CheckInData {
  facilityId?: string;
  vehicleTypeId?: string;
  licensePlate?: string;
  gateIn: string;
  staffInId: string;
  floorId?: string;
  slotId?: string;
  reservationCode?: string;
  checkInImage?: string;
  cardCode?: string;
}

export class SessionService {
  static async checkConditions(facilityId: string, vehicleTypeId: string, licensePlate?: string): Promise<CheckConditionsResult> {
    const facility = await ParkingFacility.findById(facilityId).lean();
    if (!facility || facility.status !== 'active') {
      return { eligible: false, reason: 'Bãi xe không hoạt động hoặc không tồn tại' };
    }

    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    if (facility.openTime !== facility.closeTime) {
      let isClosed = false;

      if (facility.openTime < facility.closeTime) {
        isClosed = currentTime < facility.openTime || currentTime >= facility.closeTime;
      } else {
        isClosed = currentTime < facility.openTime && currentTime >= facility.closeTime;
      }

      if (isClosed) {
        return { eligible: false, reason: `Bãi xe đang đóng. Giờ hoạt động: ${facility.openTime} - ${facility.closeTime}` };
      }
    }

    const vehicleType = await VehicleType.findById(vehicleTypeId).lean();
    if (!vehicleType || vehicleType.isDeleted) {
      return { eligible: false, reason: 'Loại phương tiện không hợp lệ' };
    }

    const floorsServingVehicle = await Floor.find({}).lean();

    if (floorsServingVehicle.length === 0) {
      return { eligible: false, reason: `Bãi xe không phục vụ loại xe "${vehicleType.name}"` };
    }

    const hasAvailableSlot = await ParkingSlot.exists({
      facilityId,
      vehicleTypeId,
      status: SlotStatus.AVAILABLE,
      isDeleted: false,
    });

    if (!hasAvailableSlot) {
      return { eligible: false, reason: `Bãi đầy cho loại xe "${vehicleType.name}"` };
    }

    let ownerName = undefined;
    if (licensePlate) {
      const earlyWindow = 15 * 60 * 1000;
      const reservation = await Reservation.findOne({
        licensePlate: licensePlate.toUpperCase(),
        facilityId,
        vehicleTypeId,
        status: ReservationStatus.CONFIRMED,
        startTime: {
          $gte: new Date(Date.now() - earlyWindow),
          $lte: new Date(Date.now() + earlyWindow),
        },
      }).populate('userId', 'name').lean() as any;
      
      if (reservation && reservation.userId && reservation.userId.name) {
        ownerName = reservation.userId.name;
      }
    }

    return { eligible: true, ownerName };
  }

  static async checkIn(data: CheckInData): Promise<IParkingSession> {
    const redlock = getRedlock();
    let checkInLock: any = null;
    
    if (redlock && data.staffInId) {
      try {
        const lockKey = `lock:checkin:staff:${data.staffInId}`;
        checkInLock = await redlock.acquire([lockKey], 5000);
      } catch (error) {
        throw new AppError('Hệ thống đang xử lý yêu cầu, vui lòng không gửi liên tục.', 429);
      }
    }
    
    try {
    let matchedReservation = null;

    if (data.reservationCode) {
      matchedReservation = await Reservation.findOne({ code: data.reservationCode }).lean();

      if (!matchedReservation) {
        throw new AppError('Mã đặt chỗ không tồn tại hoặc đã được sử dụng/hủy', 404);
      }

      const now = new Date();
      const earlyWindow = 15 * 60 * 1000;
      const resStartTime = new Date(matchedReservation.startTime);
      const earliestCheckIn = new Date(resStartTime.getTime() - earlyWindow);

      if (now < earliestCheckIn) {
        const startTimeStr = resStartTime.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
        const minutesEarly = Math.ceil((earliestCheckIn.getTime() - now.getTime()) / 60000);
        throw new AppError(
          `Chưa đến giờ check-in. Giờ đặt chỗ là ${startTimeStr}. Bạn chỉ được vào sớm tối đa 15 phút (vui lòng chờ thêm ${minutesEarly} phút).`,
          400
        );
      }

      const expirationTime = new Date(resStartTime.getTime() + earlyWindow);

      if (now > expirationTime) {
        throw new AppError('Đặt chỗ đã hết hạn. Vui lòng tạo đặt chỗ mới hoặc check-in walk-in.', 400);
      }

      if (!data.checkInImage) {
        throw new AppError('Bắt buộc phải có ảnh chụp xe lúc vào bãi khi sử dụng đặt chỗ.', 400);
      }

      if (data.vehicleTypeId && data.vehicleTypeId.toString() !== matchedReservation.vehicleTypeId.toString()) {
        throw new AppError('Loại xe không khớp với thông tin đã đặt chỗ.', 400);
      }

      const normalizedReqPlate = (data.licensePlate || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      const normalizedResPlate = matchedReservation.licensePlate.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (normalizedReqPlate && normalizedReqPlate !== normalizedResPlate) {
        throw new AppError(`Biển số xe vào (${data.licensePlate}) không khớp với biển số đã đặt (${matchedReservation.licensePlate}).`, 400);
      }

      data.facilityId = matchedReservation.facilityId.toString();
      data.vehicleTypeId = matchedReservation.vehicleTypeId.toString();
      data.licensePlate = matchedReservation.licensePlate;
    }

    if (!data.facilityId || !data.vehicleTypeId) {
      throw new AppError('Thiếu thông tin bắt buộc: facilityId, vehicleTypeId', 400);
    }

    const pricingCacheKey = `pricing:active:${data.facilityId}:${data.vehicleTypeId}`;

    const earlyWindow = 15 * 60 * 1000;
    const [
      staffUser,
      vehicleType,
      facility,
      floorsServingVehicle,
      hasAvailableSlot,
      existingSession,
      cachedPricingPlan,
      autoMatchReservation,
      isCardActiveDB
    ] = await Promise.all([
      User.findById(data.staffInId).select('assignedFacilities role name email').lean(),
      VehicleType.findById(data.vehicleTypeId).lean(),
      ParkingFacility.findById(data.facilityId).lean(),
      Floor.find({
        facilityId: data.facilityId,
        allowedVehicleTypes: data.vehicleTypeId,
        isDeleted: false,
        status: 'active',
      }).lean(),
      ParkingSlot.exists({
        facilityId: data.facilityId,
        vehicleTypeId: data.vehicleTypeId,
        status: SlotStatus.AVAILABLE,
        isDeleted: false,
      }),
      data.licensePlate ? ParkingSession.findOne({
        licensePlate: data.licensePlate.toUpperCase(),
        status: { $in: [SessionStatus.ACTIVE, SessionStatus.EXCEPTION] },
      }).lean() : Promise.resolve(null),
      getCache(pricingCacheKey),
      (!matchedReservation && data.licensePlate) ? Reservation.findOne({
        licensePlate: data.licensePlate.toUpperCase(),
        facilityId: data.facilityId,
        status: ReservationStatus.CONFIRMED,
        startTime: {
          $gte: new Date(Date.now() - earlyWindow),
          $lte: new Date(Date.now() + earlyWindow),
        },
      }).populate('userId', 'name email phone').lean() : Promise.resolve(null),
      data.cardCode ? ParkingSession.exists({ 
        cardCode: data.cardCode, 
        status: { $in: [SessionStatus.ACTIVE, SessionStatus.EXCEPTION] } 
      }) : Promise.resolve(false)
    ]);

    if (!vehicleType || vehicleType.isDeleted) {
      throw new AppError('Loại phương tiện không hợp lệ', 400);
    }

    const isNoPlateVehicle = vehicleType.requiresPlate === false;

    if (!isNoPlateVehicle && !data.licensePlate) {
      throw new AppError('Thiếu thông tin bắt buộc: licensePlate', 400);
    }

    if (isNoPlateVehicle && !data.licensePlate) {
      data.licensePlate = `NOPLATE-${Date.now()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
    }

    if (!facility || facility.status !== 'active') {
      throw new AppError('Bãi xe không hoạt động hoặc không tồn tại', 400);
    }

    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    if (facility.openTime !== facility.closeTime) {
      let isClosed = false;
      if (facility.openTime < facility.closeTime) {
        isClosed = currentTime < facility.openTime || currentTime >= facility.closeTime;
      } else {
        isClosed = currentTime < facility.openTime && currentTime >= facility.closeTime;
      }
      if (isClosed) {
        throw new AppError(`Bãi xe đang đóng. Giờ hoạt động: ${facility.openTime} - ${facility.closeTime}`, 400);
      }
    }

    if (floorsServingVehicle.length === 0) {
      throw new AppError(`Bãi xe không phục vụ loại xe "${vehicleType.name}"`, 400);
    }

    if (!hasAvailableSlot && !(matchedReservation && matchedReservation.slotId)) {
      throw new AppError(`Bãi đầy cho loại xe "${vehicleType.name}"`, 400);
    }

    if (!staffUser) {
      throw new AppError('Staff user not found', 404);
    }
    const isAssigned = staffUser.assignedFacilities.some((fId: any) => fId.toString() === data.facilityId);
    if (!isAssigned) {
      throw new AppError('Bạn không được phân công tại bãi xe này', 403);
    }

    if (!isNoPlateVehicle && existingSession) {
      if (existingSession.status === SessionStatus.EXCEPTION) {
        throw new AppError(`Xe biển số "${data.licensePlate}" đang có sự cố ngoại lệ cần xử lý (${existingSession.code}), không được phép vào gửi.`, 400);
      }
      throw new AppError(`Xe biển số "${data.licensePlate}" đang có lượt gửi chưa kết thúc (${existingSession.code})`, 400);
    }

    let pricingPlan = cachedPricingPlan;
    if (!pricingPlan) {
      pricingPlan = await PricingPlan.findOne({
        facilityId: data.facilityId,
        vehicleTypeId: data.vehicleTypeId,
        status: 'active',
        isDeleted: false,
      }).sort({ createdAt: -1 }).lean();

      if (!pricingPlan) {
        throw new AppError('Không tìm thấy bảng giá active cho tổ hợp bãi xe + loại xe này', 400);
      }
      setCache(pricingCacheKey, pricingPlan, 900).catch(() => { });
    }

    if (autoMatchReservation) {
      matchedReservation = autoMatchReservation;
      data.vehicleTypeId = matchedReservation.vehicleTypeId.toString();
    }

    const sessionId = new mongoose.Types.ObjectId();
    let slot: any = null;

    try {
      if (matchedReservation && matchedReservation.slotId) {
        slot = await ParkingSlot.findOneAndUpdate(
          { _id: matchedReservation.slotId, status: SlotStatus.RESERVED, isDeleted: false },
          { status: SlotStatus.OCCUPIED, currentSessionId: sessionId },
          { new: true }
        );
        if (!slot) {
          throw new AppError('Slot đã đặt trước không khả dụng', 400);
        }
      } else if (data.slotId) {
        slot = await ParkingSlot.findOneAndUpdate(
          { _id: data.slotId, facilityId: data.facilityId, vehicleTypeId: data.vehicleTypeId, status: SlotStatus.AVAILABLE, isDeleted: false },
          { status: SlotStatus.OCCUPIED, currentSessionId: sessionId },
          { new: true }
        );
        if (!slot) {
          throw new AppError('Slot đã chọn không khả dụng hoặc đã có xe khác vào', 400);
        }
      } else {
        slot = await ParkingSlot.findOneAndUpdate(
          {
            facilityId: data.facilityId,
            vehicleTypeId: data.vehicleTypeId,
            status: SlotStatus.AVAILABLE,
            isDeleted: false,
            ...(data.floorId ? { floorId: data.floorId } : {})
          },
          { status: SlotStatus.OCCUPIED, currentSessionId: sessionId },
          { new: true, sort: { code: 1 } }
        );
        if (!slot) {
          throw new AppError('Không còn slot trống phù hợp', 400);
        }
      }

      let sessionCode = generateSessionCode();

      if (data.cardCode) {
        const isCardActive = await sIsMember('activeCards', data.cardCode);
        if (isCardActive) {
          throw new AppError('Thẻ NFC này đang được sử dụng cho một xe khác (Chưa check-out)', 400);
        }
        if (isCardActiveDB) {
          await sAdd('activeCards', data.cardCode);
          throw new AppError('Thẻ NFC này đang được sử dụng cho một xe khác (Chưa check-out)', 400);
        }
      }

      let cardCode = matchedReservation
        ? matchedReservation.code
        : data.cardCode || generateCardCode();

      const session = new ParkingSession({
        _id: sessionId,
        code: sessionCode,
        licensePlate: data.licensePlate!.toUpperCase(),
        vehicleTypeId: data.vehicleTypeId,
        facilityId: data.facilityId,
        floorId: slot.floorId,
        slotId: slot._id,
        pricingPlanId: pricingPlan._id,
        checkInTime: new Date(),
        gateIn: data.gateIn,
        staffInId: data.staffInId,
        cardCode,
        status: SessionStatus.ACTIVE,
        driverId: matchedReservation ? matchedReservation.userId : null,
        reservationId: matchedReservation ? matchedReservation._id : null,
        checkInImage: data.checkInImage || null,
      });

      try {
        const saveOps: any[] = [session.save()];
        if (matchedReservation) {
          saveOps.push(Reservation.updateOne({ _id: matchedReservation._id }, { status: ReservationStatus.CHECKED_IN }));
        }
        await Promise.all(saveOps);
      } catch (err) {
        await ParkingSlot.updateOne(
          { _id: slot._id },
          { status: matchedReservation ? SlotStatus.RESERVED : SlotStatus.AVAILABLE, $unset: { currentSessionId: "" } }
        );
        throw new AppError('Lỗi khi tạo lượt gửi xe, vui lòng thử lại', 500);
      }

      if (!isNoPlateVehicle && session.licensePlate) {
        delCache(`session:plate:${session.licensePlate}`).catch(() => { });
      }
      if (session.cardCode) {
        sAdd('activeCards', session.cardCode).catch(() => { });
      }

      if (session.checkInImage) {
        addUploadJob(session._id.toString()).catch(err => console.error('[CheckIn] Upload job failed:', err));
      }

      try {
        const io = getIO();
        io.to(`facility:${data.facilityId}`).emit('slot:statusChanged', {
          slotId: slot._id,
          status: SlotStatus.OCCUPIED,
          facilityId: data.facilityId,
        });
        if (session.driverId) {
          io.to(`user:${session.driverId}`).emit('session:created', { sessionId: session._id });
          if (matchedReservation) {
            io.to(`user:${session.driverId}`).emit('reservation:statusChanged', {
              reservationId: matchedReservation._id,
              status: ReservationStatus.CHECKED_IN,
            });
          }
        }
      } catch (err) { }
      
      delPattern('report:*').catch(() => {});

      const floorInfo = floorsServingVehicle.find((f: any) => f._id.toString() === slot.floorId.toString());

      const populatedSession = {
        ...session.toObject(),
        vehicleTypeId: { _id: vehicleType._id, name: vehicleType.name, code: vehicleType.code, icon: vehicleType.icon },
        facilityId: { _id: facility._id, name: facility.name, address: facility.address },
        floorId: { _id: slot.floorId, name: floorInfo ? floorInfo.name : '' },
        slotId: { _id: slot._id, code: slot.code },
        staffInId: { _id: staffUser._id, name: staffUser.name, email: staffUser.email },
        ...(matchedReservation && matchedReservation.userId && typeof matchedReservation.userId === 'object' ? { driverId: matchedReservation.userId } : {})
      };
      delete populatedSession.checkInImage;
      delete populatedSession.checkOutImage;
      await delCache(`cache:public:available-slots:${data.facilityId}`);

      return populatedSession as any;
    } catch (error) {
      if (slot && slot._id) {
        await ParkingSlot.updateOne(
          { _id: slot._id },
          { status: matchedReservation ? SlotStatus.RESERVED : SlotStatus.AVAILABLE, $unset: { currentSessionId: "" } }
        ).catch(() => { });
      }
      throw error;
    }
    } finally {
      if (checkInLock) {
        await checkInLock.release().catch(() => {});
      }
    }
  }

  static async suggestFloors(facilityId: string, vehicleTypeId: string): Promise<SuggestedFloor[]> {
    const floors = await Floor.find({}).lean();

    if (floors.length === 0) {
      return [];
    }

    const floorIds = floors.map((f) => f._id);

    const slotCounts = await ParkingSlot.aggregate([
      {
        $match: {
          floorId: { $in: floorIds },
          vehicleTypeId: new mongoose.Types.ObjectId(vehicleTypeId),
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: { floorId: '$floorId', status: '$status' },
          count: { $sum: 1 },
        },
      },
    ]);

    const floorMap = new Map<string, { available: number; total: number }>();
    for (const item of slotCounts) {
      const fid = item._id.floorId.toString();
      if (!floorMap.has(fid)) {
        floorMap.set(fid, { available: 0, total: 0 });
      }
      const entry = floorMap.get(fid)!;
      entry.total += item.count;
      if (item._id.status === SlotStatus.AVAILABLE) {
        entry.available += item.count;
      }
    }

    const result: SuggestedFloor[] = floors.map((floor) => {
      const stats = floorMap.get(floor._id.toString()) || { available: 0, total: 0 };
      return {
        floorId: floor._id.toString(),
        floorName: floor.name,
        availableSlots: stats.available,
        totalSlots: stats.total,
      };
    });

    result.sort((a, b) => b.availableSlots - a.availableSlots);

    return result;
  }

  static async searchSession(query: { cardCode?: string; licensePlate?: string; code?: string }): Promise<IParkingSession> {
    const searchConditions: any = { status: { $in: [SessionStatus.ACTIVE, SessionStatus.EXCEPTION] } };

    let cacheKey = '';
    if (query.cardCode) {
      searchConditions.cardCode = query.cardCode;
      cacheKey = `session:card:${query.cardCode}`;
    } else if (query.licensePlate) {
      searchConditions.licensePlate = query.licensePlate.toUpperCase();
      cacheKey = `session:plate:${searchConditions.licensePlate}`;
    } else if (query.code) {
      searchConditions.code = query.code;
    } else {
      throw new AppError('Cần ít nhất 1 tham số tìm kiếm (cardCode, licensePlate, hoặc code)', 400);
    }

    if (cacheKey) {
      const cachedSession = await getCache<IParkingSession>(cacheKey);
      if (cachedSession) return cachedSession as any;
    }

    const session = await ParkingSession.findOne(searchConditions).lean()
      .populate('vehicleTypeId', 'name code icon requiresPlate')
      .populate('facilityId', 'name address')
      .populate('floorId', 'name')
      .populate('slotId', 'code status')
      .populate('pricingPlanId', 'name feeType rates')
      .populate('staffInId', 'name email')
      .populate('driverId', 'name email phone');

    if (!session) {
      throw new AppError('Không tìm thấy lượt gửi xe', 404);
    }

    if (cacheKey) {
      await setCache(cacheKey, session, 30);
    }

    return session as any;
  }

  static async getActiveSessions(query: any): Promise<{ data: IParkingSession[], total: number, page: number, totalPages: number }> {
    const {
      page = 1,
      limit = 10,
      facilityId,
      vehicleTypeId,
      floorId,
      licensePlate,
      sortBy = 'checkInTime',
      sortOrder = 'desc'
    } = query;

    const filter: any = { status: { $in: [SessionStatus.ACTIVE, SessionStatus.EXCEPTION] } };

    if (facilityId) filter.facilityId = facilityId;
    if (vehicleTypeId) filter.vehicleTypeId = vehicleTypeId;
    if (floorId) filter.floorId = floorId;
    if (licensePlate) filter.licensePlate = { $regex: licensePlate, $options: 'i' };

    const skip = (Number(page) - 1) * Number(limit);
    const sort: any = { [sortBy as string]: sortOrder === 'asc' ? 1 : -1 };

    const [data, total] = await Promise.all([
      ParkingSession.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(Number(limit))
        .populate('vehicleTypeId', 'name code icon')
        .populate('facilityId', 'name')
        .populate('floorId', 'name')
        .populate('slotId', 'code status')
        .populate('pricingPlanId', 'name feeType')
        .populate('staffInId', 'name')
        .populate('driverId', 'name email phone')
        .lean(),
      ParkingSession.countDocuments(filter)
    ]);

    return {
      data: data as any[],
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit))
    };
  }

  static async getTodayTraffic(facilityId?: string): Promise<{ trafficIn: number; trafficOut: number }> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const filterIn: any = { checkInTime: { $gte: startOfDay, $lte: endOfDay } };
    const filterOut: any = { checkOutTime: { $gte: startOfDay, $lte: endOfDay } };

    if (facilityId) {
      filterIn.facilityId = facilityId;
      filterOut.facilityId = facilityId;
    }

    const [trafficIn, trafficOut] = await Promise.all([
      ParkingSession.countDocuments(filterIn),
      ParkingSession.countDocuments(filterOut)
    ]);

    return { trafficIn, trafficOut };
  }

  static async getMySessions(driverId: string, query: any): Promise<{ data: IParkingSession[], total: number }> {
    const { Vehicle } = require('../models/vehicle.model');
    const userVehicles = await Vehicle.find({ userId: driverId, isDeleted: false }).select('licensePlate').lean();
    const userPlates = userVehicles.map((v: any) => v.licensePlate.toUpperCase());

    const orConditions: any[] = [{ driverId }];
    if (userPlates.length > 0) {
      orConditions.push({ licensePlate: { $in: userPlates }, driverId: null });
    }
    const filter: any = { $or: orConditions };

    if (query.status) {
      filter.status = query.status;
    }

    const sort: any = { checkInTime: -1 };

    const [data, total] = await Promise.all([
      ParkingSession.find(filter)
        .sort(sort)
        .limit(50)
        .populate('vehicleTypeId', 'name code icon')
        .populate('facilityId', 'name address')
        .populate('floorId', 'name')
        .populate('slotId', 'code status')
        .populate('pricingPlanId', 'name feeType rates')
        .lean(),
      ParkingSession.countDocuments(filter)
    ]);

    return { data: data as any[], total };
  }

  static async calculateFee(sessionIdOrSession: any, checkOutTime: Date = new Date()): Promise<{ totalFee: number, details: any }> {
    let session: any;
    let sessionId: string;

    if (typeof sessionIdOrSession === 'string' || sessionIdOrSession instanceof mongoose.Types.ObjectId) {
      sessionId = sessionIdOrSession.toString();
      session = await ParkingSession.findById(sessionIdOrSession).populate('pricingPlanId');
    } else {
      session = sessionIdOrSession;
      sessionId = session._id.toString();
      if (typeof session.populate === 'function' && !session.populated('pricingPlanId')) {
        await session.populate('pricingPlanId');
      }
    }
    if (!session) throw new AppError('Session không tồn tại', 404);

    const pricingPlan: any = session.pricingPlanId;
    if (!pricingPlan) throw new AppError('Không tìm thấy bảng giá cho session này', 400);

    const checkInTime = new Date(session.checkInTime);
    const durationMs = checkOutTime.getTime() - checkInTime.getTime();
    if (durationMs < 0) {
      throw new AppError('Thời gian ra phải sau thời gian vào', 400);
    }

    const durationMinutes = durationMs / (1000 * 60);
    const durationHours = Math.ceil(durationMs / (1000 * 60 * 60));

    if (pricingPlan.gracePeriodMinutes > 0 && durationMinutes <= pricingPlan.gracePeriodMinutes) {
      let exceptionSurcharge = 0;
      let lostCardFeeTotal = 0;
      const resolvedExceptions = await Exception.find({ sessionId, status: ExceptionStatus.RESOLVED }).lean();
      for (const exc of resolvedExceptions) {
        if (exc.type === ExceptionType.LOST_CARD) {
          lostCardFeeTotal += exc.surcharge || 0;
        } else {
          exceptionSurcharge += exc.surcharge || 0;
        }
      }
      return {
        totalFee: exceptionSurcharge + lostCardFeeTotal,
        details: {
          durationHours: 0, durationMinutes: Math.round(durationMinutes),
          baseFee: 0, overnightFee: 0, overtimeFee: 0,
          exceptionSurcharge, lostCardFee: lostCardFeeTotal,
          pricingPlanName: pricingPlan.name, feeMethod: pricingPlan.feeMethod || 'duration_based',
          gracePeriodApplied: true, daysDiff: 0,
        }
      };
    }

    let baseFee = 0;
    let overnightFee = 0;
    let overtimeFee = 0;

    const startDay = new Date(checkInTime.getFullYear(), checkInTime.getMonth(), checkInTime.getDate());
    const endDay = new Date(checkOutTime.getFullYear(), checkOutTime.getMonth(), checkOutTime.getDate());
    const daysDiff = Math.round((endDay.getTime() - startDay.getTime()) / (1000 * 60 * 60 * 24));

    const feeMethod = pricingPlan.feeMethod ||
      (pricingPlan.feeType === 'per_turn' ? 'flat_rate' : 'duration_based');

    if (feeMethod === 'flat_rate') {
      baseFee = pricingPlan.rates[0]?.amount || 0;
      if (daysDiff > 0 && pricingPlan.overnightFee > 0) {
        overnightFee = pricingPlan.overnightFee * daysDiff;
      }

      if (pricingPlan.overtimeFeePerHour > 0) {
        const facility = await ParkingFacility.findById(session.facilityId).lean();
        if (facility && facility.openTime !== facility.closeTime) {
          const otMinutes = this.calculateOvertimeMinutes(checkInTime, checkOutTime, facility.openTime, facility.closeTime);
          overtimeFee = Math.ceil(otMinutes / 60) * pricingPlan.overtimeFeePerHour;
        }
      }
    }
    else if (feeMethod === 'duration_based') {
      const firstRate = pricingPlan.rates[0]?.amount || 0;
      const nextRate = pricingPlan.rates[1]?.amount || firstRate;
      const firstBlock = pricingPlan.firstBlockHours || 1;

      if (durationHours <= firstBlock) {
        baseFee = firstRate;
      } else {
        baseFee = firstRate + (durationHours - firstBlock) * nextRate;
      }

      if (pricingPlan.maxDailyFee > 0) {
        const totalDays = Math.max(1, daysDiff + 1);
        const maxTotal = pricingPlan.maxDailyFee * totalDays;
        if (baseFee > maxTotal) {
          baseFee = maxTotal;
        }
      }

      if (daysDiff > 0 && pricingPlan.overnightFee > 0) {
        overnightFee = pricingPlan.overnightFee * daysDiff;
      }

      if (pricingPlan.overtimeFeePerHour > 0) {
        const facility = await ParkingFacility.findById(session.facilityId).lean();
        if (facility && facility.openTime !== facility.closeTime) {
          const otMinutes = this.calculateOvertimeMinutes(checkInTime, checkOutTime, facility.openTime, facility.closeTime);
          overtimeFee = Math.ceil(otMinutes / 60) * pricingPlan.overtimeFeePerHour;
        }
      }
    }
    else if (feeMethod === 'time_window') {
      const facility = await ParkingFacility.findById(session.facilityId).lean();
      if (!facility) throw new AppError('Facility không tồn tại', 404);

      const twResult = this.calculateTimeWindowFee(
        checkInTime, checkOutTime, pricingPlan.rates,
        pricingPlan.maxDailyFee || 0,
        facility.openTime, facility.closeTime,
        pricingPlan.overtimeFeePerHour || 0
      );
      baseFee = twResult.baseFee;
      overtimeFee = twResult.overtimeFee;
    }
    else {
      baseFee = pricingPlan.rates[0]?.amount || 0;
    }

    let exceptionSurcharge = 0;
    let lostCardFeeTotal = 0;

    const resolvedExceptions = await Exception.find({
      sessionId: sessionId,
      status: ExceptionStatus.RESOLVED,
    });

    for (const exc of resolvedExceptions) {
      if (exc.type === ExceptionType.LOST_CARD) {
        lostCardFeeTotal += exc.surcharge || 0;
      } else {
        exceptionSurcharge += exc.surcharge || 0;
      }
    }

    const totalFee = baseFee + overnightFee + overtimeFee + exceptionSurcharge + lostCardFeeTotal;

    return {
      totalFee,
      details: {
        durationHours,
        durationMinutes: Math.round(durationMinutes),
        baseFee,
        overnightFee,
        overtimeFee,
        exceptionSurcharge,
        lostCardFee: lostCardFeeTotal,
        pricingPlanName: pricingPlan.name,
        feeMethod,
        gracePeriodApplied: false,
        daysDiff
      }
    };
  }

  private static calculateOvertimeMinutes(
    checkIn: Date, checkOut: Date,
    openTime: string, closeTime: string
  ): number {
    const [oH, oM] = openTime.split(':').map(Number);
    const [cH, cM] = closeTime.split(':').map(Number);
    const openMin = oH * 60 + oM;
    const closeMin = cH * 60 + cM;

    let overtimeMinutes = 0;
    const cursor = new Date(checkIn);

    while (cursor < checkOut) {
      const minuteOfDay = cursor.getHours() * 60 + cursor.getMinutes();
      let isOutside: boolean;

      if (openMin < closeMin) {
        isOutside = minuteOfDay < openMin || minuteOfDay >= closeMin;
      } else {
        isOutside = minuteOfDay >= closeMin && minuteOfDay < openMin;
      }

      if (isOutside) {
        overtimeMinutes++;
      }
      cursor.setTime(cursor.getTime() + 60000);
    }

    return overtimeMinutes;
  }

  private static calculateTimeWindowFee(
    checkIn: Date, checkOut: Date,
    rates: Array<{ startTime?: string; endTime?: string; amount: number }>,
    maxDailyFee: number,
    openTime: string,
    closeTime: string,
    overtimeFeePerHour: number
  ): { baseFee: number; overtimeFee: number } {
    const [oH, oM] = openTime.split(':').map(Number);
    const [cH, cM] = closeTime.split(':').map(Number);
    const openMin = oH * 60 + oM;
    const closeMin = cH * 60 + cM;
    const is24h = openMin === closeMin;

    type Interval = { from: number; to: number; amount: number; isOvertime: boolean };
    const allIntervals: Interval[] = [];

    for (const r of rates) {
      if (!r.startTime || !r.endTime) continue;
      const [sH, sM] = r.startTime.split(':').map(Number);
      const [eH, eM] = r.endTime.split(':').map(Number);
      const start = sH * 60 + sM;
      const end = eH * 60 + eM;
      if (start < end) {
        allIntervals.push({ from: start, to: end, amount: r.amount, isOvertime: false });
      } else if (start > end) {
        allIntervals.push({ from: start, to: 1440, amount: r.amount, isOvertime: false });
        allIntervals.push({ from: 0, to: end, amount: r.amount, isOvertime: false });
      }
    }

    if (!is24h) {
      if (openMin < closeMin) {
        if (openMin > 0) {
          allIntervals.push({ from: 0, to: openMin, amount: overtimeFeePerHour, isOvertime: true });
        }
        if (closeMin < 1440) {
          allIntervals.push({ from: closeMin, to: 1440, amount: overtimeFeePerHour, isOvertime: true });
        }
      } else {
        if (closeMin < openMin) {
          allIntervals.push({ from: closeMin, to: openMin, amount: overtimeFeePerHour, isOvertime: true });
        }
      }
    }

    allIntervals.sort((a, b) => a.from - b.from);

    let baseFee = 0;
    let overtimeFee = 0;
    const current = new Date(checkIn);

    while (current < checkOut) {
      const minuteOfDay = current.getHours() * 60 + current.getMinutes();

      const interval = allIntervals.find(fi => minuteOfDay >= fi.from && minuteOfDay < fi.to);
      if (!interval) {
        current.setTime(current.getTime() + 60000);
        continue;
      }

      const segEndDate = new Date(current);
      if (interval.to === 1440) {
        segEndDate.setDate(segEndDate.getDate() + 1);
        segEndDate.setHours(0, 0, 0, 0);
      } else {
        segEndDate.setHours(Math.floor(interval.to / 60), interval.to % 60, 0, 0);
      }
      const segmentEnd = checkOut < segEndDate ? checkOut : segEndDate;

      const durationMs = segmentEnd.getTime() - current.getTime();
      const durationMinutes = durationMs / (1000 * 60);
      const perMinuteRate = interval.amount / 60;

      if (interval.isOvertime) {
        overtimeFee += durationMinutes * perMinuteRate;
      } else {
        baseFee += durationMinutes * perMinuteRate;
      }

      current.setTime(segmentEnd.getTime());
    }

    baseFee = Math.ceil(baseFee);
    overtimeFee = Math.ceil(overtimeFee);

    if (maxDailyFee > 0) {
      const startDay = new Date(checkIn.getFullYear(), checkIn.getMonth(), checkIn.getDate());
      const endDay = new Date(checkOut.getFullYear(), checkOut.getMonth(), checkOut.getDate());
      const totalDays = Math.max(1, Math.round((endDay.getTime() - startDay.getTime()) / 86400000) + 1);
      const maxTotal = maxDailyFee * totalDays;
      if (baseFee > maxTotal) {
        baseFee = maxTotal;
      }
    }

    return { baseFee, overtimeFee };
  }

  static async checkOut(data: { sessionId: string, gateOut: string, staffOutId: string, checkOutImage?: string }): Promise<IParkingSession> {
    const sessionMongoose = await mongoose.startSession();
    sessionMongoose.startTransaction();

    try {
      const session = await ParkingSession.findById(data.sessionId).session(sessionMongoose);
      const staffUser = await User.findById(data.staffOutId).select('assignedFacilities').session(sessionMongoose);

      if (!session) throw new AppError('Session không tồn tại', 404);
      if (session.status === SessionStatus.COMPLETED) {
        throw new AppError('Lượt gửi xe đã kết thúc', 400);
      }
      if (session.status === SessionStatus.EXCEPTION) {
        throw new AppError('Lượt gửi xe đang có ngoại lệ chưa được xử lý. Vui lòng giải quyết ngoại lệ trước khi checkout.', 400);
      }

      if (!staffUser) throw new AppError('Staff user not found', 404);
      const isAssigned = staffUser.assignedFacilities.some(
        (fId) => fId.toString() === session.facilityId.toString()
      );
      if (!isAssigned) {
        throw new AppError('Bạn không được phân công tại bãi xe này', 403);
      }

      const checkOutTime = new Date();
      const feeResult = await this.calculateFee(session, checkOutTime);

      const { Payment, PaymentMethod, PaymentStatus } = require('../models/payment.model');

      const transactionCode = `CASH${Date.now()}${Math.floor(Math.random() * 1000)}`;
      const payment = new Payment({
        sessionId: data.sessionId,
        transactionCode,
        amount: feeResult.totalFee,
        method: PaymentMethod.CASH,
        status: PaymentStatus.COMPLETED,
        staffId: data.staffOutId,
      });
      await payment.save({ session: sessionMongoose });

      session.checkOutTime = checkOutTime;
      session.gateOut = data.gateOut;
      session.staffOutId = new mongoose.Types.ObjectId(data.staffOutId);
      session.totalFee = feeResult.totalFee;
      session.status = SessionStatus.COMPLETED;
      if (data.checkOutImage) {
        session.checkOutImage = data.checkOutImage;
      }

      await session.save({ session: sessionMongoose });

      const slot = await ParkingSlot.findById(session.slotId).session(sessionMongoose);
      if (slot) {
        slot.status = SlotStatus.AVAILABLE;
        slot.currentSessionId = null;
        slot.maintenanceReason = '';
        await slot.save({ session: sessionMongoose });
      }

      // Chuyển reservation sang COMPLETED khi checkout
      if (session.reservationId) {
        await Reservation.updateOne(
          { _id: session.reservationId },
          { status: ReservationStatus.COMPLETED },
        ).session(sessionMongoose);
      }

      await sessionMongoose.commitTransaction();
      sessionMongoose.endSession();

      // Clear reservation cache
      if (session.reservationId && session.driverId) {
        delPattern(`cache:reservations:user:${session.driverId}:*`).catch(() => {});
      }
      if (session.reservationId && session.facilityId) {
        delPattern(`cache:reservations:facility:${session.facilityId}:*`).catch(() => {});
      }

      const populatedSession = await ParkingSession.findById(session._id)
        .populate('vehicleTypeId', 'name code icon')
        .populate('facilityId', 'name address')
        .populate('floorId', 'name')
        .populate('slotId', 'code status')
        .populate('pricingPlanId', 'name feeType rates')
        .populate('staffInId', 'name email')
        .populate('staffOutId', 'name email');

      try {
        const io = getIO();
        io.to(`facility:${session.facilityId}`).emit('slot:statusChanged', {
          slotId: session.slotId,
          status: SlotStatus.AVAILABLE,
          facilityId: session.facilityId,
        });
        if (session.driverId) {
          io.to(`user:${session.driverId}`).emit('session:completed', { sessionId: session._id });
          if (session.reservationId) {
            io.to(`user:${session.driverId}`).emit('reservation:statusChanged', {
              reservationId: session.reservationId,
              status: ReservationStatus.COMPLETED,
            });
          }
        }
      } catch (err) {
      }
      
      delPattern('report:*').catch(() => {});

      if (session.licensePlate) {
        await delCache(`session:plate:${session.licensePlate}`);
      }
      if (session.cardCode) {
        await delCache(`session:card:${session.cardCode}`);
        await sRem('activeCards', session.cardCode);
      }

      console.log(`[Checkout] Triggering upload job for session ${session._id}`);
      addUploadJob(session._id.toString()).catch(err => console.error('[Checkout] Upload job failed:', err));

      await delCache(`cache:public:available-slots:${session.facilityId}`);

      return populatedSession!;
    } catch (error) {
      await sessionMongoose.abortTransaction();
      sessionMongoose.endSession();
      throw error;
    }
  }

}
