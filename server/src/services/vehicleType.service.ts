import { VehicleType, IVehicleType } from '../models/vehicleType.model';
import { Floor } from '../models/floor.model';
import { ParkingSlot } from '../models/parkingSlot.model';
import { ParkingSession, SessionStatus } from '../models/parkingSession.model';
import { Reservation, ReservationStatus } from '../models/reservation.model';
import { AppError } from '../middlewares/error.middleware';
import { delPattern } from '../config/redis';

import { normalizeVehicleTypeName } from '../utils/string.util';
import { distance } from 'fastest-levenshtein';

export class VehicleTypeService {
  private static async checkDuplicateName(name: string, excludeId?: string): Promise<void> {
    const normalized = normalizeVehicleTypeName(name);
    const query: any = { normalized_name: normalized, isDeleted: false };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }
    const duplicate = await VehicleType.findOne(query);
    if (duplicate) {
      const error: any = new Error('Loại xe tương tự đã tồn tại');
      error.statusCode = 409;
      error.code = 'DUPLICATE_VEHICLE_TYPE';
      error.existingId = duplicate._id;
      throw error;
    }
  }

  static async createVehicleType(data: Partial<IVehicleType>): Promise<IVehicleType> {
    const existingType = await VehicleType.findOne({ code: data.code });
    if (existingType) {
      throw new AppError('Mã loại xe đã tồn tại', 400);
    }

    if (data.name) {
      await this.checkDuplicateName(data.name);
    }

    const newType = new VehicleType(data);
    await newType.save();

    if (data.floors && data.floors.length > 0) {
      await Floor.updateMany(
        { _id: { $in: data.floors } },
        { $addToSet: { allowedVehicleTypes: newType._id } }
      );
    }

    await delPattern('cache:operationsConfig:*');
    await delPattern('cache:public:available-slots:*');

    return newType;
  }

  static async updateVehicleType(id: string, data: Partial<IVehicleType>): Promise<IVehicleType | null> {
    const oldVehicleType = await VehicleType.findById(id);
    if (!oldVehicleType) {
      throw new AppError('Vehicle type not found', 404);
    }

    const defaultCodes = ['XEOTODIEN', 'XEMAYDIEN', 'XEOTO', 'XEMAY', 'XEDAP'];
    if (defaultCodes.includes(oldVehicleType.code.toUpperCase())) {
      if (data.name && data.name !== oldVehicleType.name) {
        throw new AppError('Không thể sửa tên của loại xe mặc định', 400);
      }
      if (data.description !== undefined && data.description !== oldVehicleType.description) {
        throw new AppError('Không thể sửa mô tả của loại xe mặc định', 400);
      }
      if (data.icon && data.icon !== oldVehicleType.icon) {
        throw new AppError('Không thể sửa biểu tượng của loại xe mặc định', 400);
      }
    }

    if (data.code && data.code.toUpperCase() !== oldVehicleType.code.toUpperCase()) {
      const existingType = await VehicleType.findOne({ code: data.code.toUpperCase() });
      if (existingType) {
        throw new AppError('Mã loại xe đã tồn tại', 400);
      }
    }

    if (data.name && data.name !== oldVehicleType.name) {
      await this.checkDuplicateName(data.name, id);
    }

    if (data.floors) {
      const oldFloorIds = oldVehicleType.floors.map((f: any) => f.toString());
      const newFloorIds = data.floors.map((f: any) => f.toString());
      const removedFloors = oldFloorIds.filter(f => !newFloorIds.includes(f));

      if (removedFloors.length > 0) {
        const existingSlots = await ParkingSlot.countDocuments({
          floorId: { $in: removedFloors },
          vehicleTypeId: id,
          isDeleted: false,
        });

        if (existingSlots > 0) {
          throw new AppError('Không thể gỡ loại xe khỏi tầng đã được phân bổ chỗ đỗ. Vui lòng xoá chỗ đỗ trước.', 400);
        }
      }
    }

    const vehicleType = await VehicleType.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!vehicleType) return null;

    if (data.floors) {
      const oldFloorIds = oldVehicleType.floors.map((f: any) => f.toString());
      const newFloorIds = data.floors.map((f: any) => f.toString());

      const addedFloors = newFloorIds.filter(f => !oldFloorIds.includes(f));
      const removedFloors = oldFloorIds.filter(f => !newFloorIds.includes(f));

      if (addedFloors.length > 0) {
        await Floor.updateMany(
          { _id: { $in: addedFloors } },
          { $addToSet: { allowedVehicleTypes: vehicleType._id } }
        );
      }
      if (removedFloors.length > 0) {
        await Floor.updateMany(
          { _id: { $in: removedFloors } },
          { $pull: { allowedVehicleTypes: vehicleType._id } }
        );
      }
    }

    await delPattern('cache:operationsConfig:*');
    await delPattern('cache:public:available-slots:*');

    return vehicleType;
  }

  static async softDeleteVehicleType(id: string): Promise<IVehicleType | null> {
    const defaultCodes = ['XEOTODIEN', 'XEMAYDIEN', 'XEOTO', 'XEMAY', 'XEDAP'];
    const vehicleTypeToSoftDelete = await VehicleType.findById(id);
    if (!vehicleTypeToSoftDelete) {
      throw new AppError('Vehicle type not found', 404);
    }
    if (defaultCodes.includes(vehicleTypeToSoftDelete.code.toUpperCase())) {
      throw new AppError('Không thể xoá các loại xe mặc định của hệ thống', 400);
    }

    const floorsWithThisType = await Floor.countDocuments({
      allowedVehicleTypes: id,
      isDeleted: false,
    });

    if (floorsWithThisType > 0) {
      throw new AppError('Không thể xoá loại xe này do đang được gán cho các tầng', 400);
    }

    const activeSessions = await ParkingSession.countDocuments({
      vehicleTypeId: id,
      status: SessionStatus.ACTIVE,
    });
    if (activeSessions > 0) {
      throw new AppError('Không thể xoá loại xe này do đang có lượt gửi xe hoạt động', 400);
    }

    const activeReservations = await Reservation.countDocuments({
      vehicleTypeId: id,
      status: { $in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] },
    });
    if (activeReservations > 0) {
      throw new AppError('Không thể xoá loại xe này do đang có đặt chỗ đang hoạt động', 400);
    }

    const vehicleType = await VehicleType.findByIdAndUpdate(id, { isDeleted: true }, { new: true });
    if (!vehicleType) {
      throw new AppError('Vehicle type not found', 404);
    }

    await Floor.updateMany(
      { allowedVehicleTypes: id },
      { $pull: { allowedVehicleTypes: vehicleType._id } }
    );

    vehicleType.floors = [];
    await vehicleType.save();

    await delPattern('cache:operationsConfig:*');
    await delPattern('cache:public:available-slots:*');

    return vehicleType;
  }

  static async getVehicleTypeById(id: string): Promise<IVehicleType | null> {
    const vehicleType = await VehicleType.findById(id).populate({
      path: 'floors',
      select: 'name facilityId',
      populate: { path: 'facilityId', select: 'name' }
    });
    if (!vehicleType) {
      throw new AppError('Vehicle type not found', 404);
    }
    return vehicleType;
  }

  static async getAllVehicleTypes(filters: any = {}, skip = 0, limit = 10): Promise<{ vehicleTypes: IVehicleType[]; total: number }> {
    const query = { isDeleted: false, ...filters };
    const vehicleTypes = await VehicleType.find(query)
      .populate({
        path: 'floors',
        select: 'name facilityId',
        populate: { path: 'facilityId', select: 'name' }
      })
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean() as any;
    const total = await VehicleType.countDocuments(query);
    return { vehicleTypes, total };
  }

  static async getSimilarVehicleTypes(name?: string, icon?: string): Promise<{ byName: IVehicleType[], byIcon: IVehicleType[] }> {
    const allTypes = await VehicleType.find({ isDeleted: false }).lean();
    
    let byName: IVehicleType[] = [];
    if (name) {
      const normalizedTarget = normalizeVehicleTypeName(name);
      if (normalizedTarget.length < 3) {
        byName = [];
      } else {
        byName = allTypes.filter(vt => {
          const vtNormalized = normalizeVehicleTypeName(vt.name);
          if (normalizedTarget.length >= vtNormalized.length * 0.5) {
            if (vtNormalized.includes(normalizedTarget) || normalizedTarget.includes(vtNormalized)) return true;
          }
          const dist = distance(normalizedTarget, vtNormalized);
          const maxDist = Math.max(1, Math.floor(normalizedTarget.length / 5));
          return dist <= maxDist;
        }) as unknown as IVehicleType[];
      }
    }

    let byIcon: IVehicleType[] = [];
    if (icon) {
      byIcon = allTypes.filter(vt => vt.icon === icon) as unknown as IVehicleType[];
    }

    return { byName, byIcon };
  }
}
