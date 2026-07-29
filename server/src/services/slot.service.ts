import { ParkingSlot, IParkingSlot } from '../models/parkingSlot.model';
import { Floor } from '../models/floor.model';
import { Reservation } from '../models/reservation.model';
import { AppError } from '../middlewares/error.middleware';

export class SlotService {
  static async createSlot(data: Partial<IParkingSlot>): Promise<IParkingSlot> {
    const floor = await Floor.findById(data.floorId);
    if (!floor) {
      throw new AppError('Floor not found', 404);
    }

    if (!floor.allowedVehicleTypes.includes(data.vehicleTypeId as any)) {
      throw new AppError('Loại phương tiện này không được hỗ trợ tại tầng này', 400);
    }

    const currentSlotCount = await ParkingSlot.countDocuments({
      floorId: data.floorId,
      isDeleted: false,
    });

    if (currentSlotCount >= floor.totalSlots) {
      throw new AppError(`Tầng "${floor.name}" đã đạt tối đa ${floor.totalSlots} slot. Không thể thêm slot mới.`, 400);
    }

    const existingSlot = await ParkingSlot.findOne({ code: data.code, facilityId: data.facilityId });
    if (existingSlot) {
      throw new AppError('Mã slot đã tồn tại trong cơ sở này', 400);
    }

    const newSlot = new ParkingSlot(data);
    await newSlot.save();

    return newSlot;
  }

  static async createBulkSlots(facilityId: string, floorId: string, vehicleType: string, prefix: string, startNumber: number, count: number): Promise<any[]> {
    const floor = await Floor.findById(floorId);
    if (!floor) {
      throw new AppError('Floor not found', 404);
    }

    if (!floor.allowedVehicleTypes.includes(vehicleType as any)) {
      throw new AppError('Loại phương tiện này không được hỗ trợ tại tầng này', 400);
    }

    const currentSlotCount = await ParkingSlot.countDocuments({
      floorId,
      isDeleted: false,
    });

    if (currentSlotCount + count > floor.totalSlots) {
      const remaining = floor.totalSlots - currentSlotCount;
      throw new AppError(
        `Tầng "${floor.name}" chỉ còn ${remaining} slot trống (max: ${floor.totalSlots}, hiện có: ${currentSlotCount}). Không thể thêm ${count} slot.`,
        400
      );
    }

    const slotsToCreate = [];
    for (let i = 0; i < count; i++) {
      const code = `${prefix}${startNumber + i}`;
      slotsToCreate.push({
        code,
        facilityId,
        floorId,
        vehicleTypeId: vehicleType,
        status: 'available',
      });
    }

    const existingSlots = await ParkingSlot.find({
      facilityId,
      code: { $in: slotsToCreate.map(s => s.code) }
    });

    if (existingSlots.length > 0) {
      throw new AppError(`Một số mã slot đã tồn tại: ${existingSlots.map(s => s.code).join(', ')}`, 400);
    }

    const createdSlots = await ParkingSlot.insertMany(slotsToCreate);

    return createdSlots;
  }


  static async updateSlot(id: string, data: { code?: string; vehicleTypeId?: string }): Promise<IParkingSlot> {
    const slot = await ParkingSlot.findById(id);
    if (!slot) {
      throw new AppError('Slot not found', 404);
    }

    if (data.code) {
      const existing = await ParkingSlot.findOne({
        code: data.code,
        facilityId: slot.facilityId,
        _id: { $ne: id },
        isDeleted: false,
      });
      if (existing) {
        throw new AppError(`Mã slot "${data.code}" đã tồn tại trong cơ sở này`, 400);
      }
      slot.code = data.code;
    }

    if (data.vehicleTypeId) {
      slot.vehicleTypeId = data.vehicleTypeId as any;
    }

    await slot.save();
    return slot;
  }

  static async updateSlotStatus(id: string, status: string, reason?: string, userRole?: string): Promise<IParkingSlot | null> {
    const slot = await ParkingSlot.findById(id);
    if (!slot) {
      throw new AppError('Slot not found', 404);
    }

    if (userRole === 'staff') {
      if (status !== 'maintenance' && status !== 'available') {
        throw new AppError('Nhân viên chỉ có quyền cập nhật trạng thái bảo trì hoặc trống', 403);
      }
      if (slot.status === 'occupied') {
        throw new AppError('Không thể thay đổi trạng thái slot đang có xe đỗ', 400);
      }
    }

    if (slot.status === 'occupied' && ['maintenance', 'locked'].includes(status)) {
      throw new AppError('Cannot set an occupied slot to maintenance or locked', 400);
    }

    slot.status = status as any;
    await slot.save();
    return slot;
  }

  static async deleteSlot(id: string): Promise<void> {
    const slot = await ParkingSlot.findById(id);
    if (!slot) {
      throw new AppError('Slot not found', 404);
    }

    if (slot.status === 'occupied' || slot.status === 'reserved') {
      throw new AppError('Cannot delete a slot that is currently occupied or reserved', 400);
    }

    slot.isDeleted = true;
    slot.status = 'maintenance' as any;
    await slot.save();
  }

  static async getSlotById(id: string): Promise<any> {
    const slot = await ParkingSlot.findById(id)
      .populate('vehicleTypeId')
      .populate({
        path: 'currentSessionId',
        populate: { path: 'pricingPlanId' }
      })
      .lean();
    if (!slot) {
      throw new AppError('Slot not found', 404);
    }

    if (slot.status === 'reserved') {
      const reservation = await Reservation.findOne({
        slotId: slot._id,
        status: { $in: ['pending', 'confirmed'] },
      })
        .populate('userId', 'name email phone')
        .lean();

      if (reservation) {
        (slot as any).reservationInfo = {
          _id: reservation._id,
          code: reservation.code,
          licensePlate: reservation.licensePlate,
          startTime: reservation.startTime,
          status: reservation.status,
          user: reservation.userId,
        };
      }
    }

    return slot;
  }

  static async getSlotsByFloor(floorId: string): Promise<any[]> {
    const slots = await ParkingSlot.find({ floorId, isDeleted: false })
      .populate('vehicleTypeId')
      .populate({
        path: 'currentSessionId',
        populate: { path: 'pricingPlanId' }
      })
      .sort({ code: 1 })
      .lean();

    const reservedSlotIds = slots
      .filter(s => s.status === 'reserved' && s._id)
      .map(s => s._id);

    if (reservedSlotIds.length > 0) {
      const reservations = await Reservation.find({
        slotId: { $in: reservedSlotIds },
        status: { $in: ['pending', 'confirmed'] },
      })
        .populate('userId', 'name email phone')
        .lean();

      const reservationMap = new Map<string, any>();
      for (const r of reservations) {
        if (r.slotId) {
          reservationMap.set(r.slotId.toString(), r);
        }
      }

      for (const slot of slots) {
        const reservation = reservationMap.get(slot._id.toString());
        if (reservation) {
          (slot as any).reservationInfo = {
            _id: reservation._id,
            code: reservation.code,
            licensePlate: reservation.licensePlate,
            startTime: reservation.startTime,
            status: reservation.status,
            user: reservation.userId,
          };
        }
      }
    }

    return slots;
  }

  static async getSlotStats(): Promise<Record<string, { occupied: number; reserved: number }>> {
    const stats = await ParkingSlot.aggregate([
      { $match: { isDeleted: false } },
      {
        $group: {
          _id: '$floorId',
          occupied: { $sum: { $cond: [{ $eq: ['$status', 'occupied'] }, 1, 0] } },
          reserved: { $sum: { $cond: [{ $eq: ['$status', 'reserved'] }, 1, 0] } },
        },
      },
    ]);

    const result: Record<string, { occupied: number; reserved: number }> = {};
    for (const stat of stats) {
      result[stat._id.toString()] = {
        occupied: stat.occupied,
        reserved: stat.reserved,
      };
    }
    return result;
  }
}
