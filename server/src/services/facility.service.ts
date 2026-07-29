import { ParkingFacility, IParkingFacility } from '../models/parkingFacility.model';
import { Floor } from '../models/floor.model';
import { ParkingSlot } from '../models/parkingSlot.model';
import { VehicleType, IVehicleType } from '../models/vehicleType.model';
import { User } from '../models/user.model';
import { AppError } from '../middlewares/error.middleware';

import { getCache, setCache, delPattern, delCache } from '../config/redis';
import { getIO } from '../config/socket';

export class FacilityService {
  static async createFacility(data: Partial<IParkingFacility>): Promise<IParkingFacility> {
    const existingName = await ParkingFacility.findOne({ name: data.name });
    if (existingName) {
      throw new AppError('Tên toà nhà đã tồn tại', 400);
    }

    const existingAddress = await ParkingFacility.findOne({ address: data.address });
    if (existingAddress) {
      throw new AppError('Địa chỉ toà nhà đã tồn tại', 400);
    }

    if (data.location?.coordinates && data.location.coordinates.length === 2) {
      const [lng, lat] = data.location.coordinates;
      if (lng !== 0 || lat !== 0) {
        const existingLocation = await ParkingFacility.findOne({ 'location.coordinates': [lng, lat] });
        if (existingLocation) {
          throw new AppError('Vị trí bản đồ này đã được sử dụng cho toà nhà khác', 400);
        }
      }
    }

    const newFacility = new ParkingFacility(data);
    await newFacility.save();
    
    await delPattern('cache:public:facilities:*');
    
    return newFacility;
  }

  static async updateFacility(id: string, data: Partial<IParkingFacility>): Promise<IParkingFacility | null> {
    if (data.name) {
      const existingName = await ParkingFacility.findOne({ name: data.name, _id: { $ne: id } });
      if (existingName) {
        throw new AppError('Tên toà nhà đã tồn tại', 400);
      }
    }

    if (data.address) {
      const existingAddress = await ParkingFacility.findOne({ address: data.address, _id: { $ne: id } });
      if (existingAddress) {
        throw new AppError('Địa chỉ toà nhà đã tồn tại', 400);
      }
    }

    if (data.location?.coordinates && data.location.coordinates.length === 2) {
      const [lng, lat] = data.location.coordinates;
      if (lng !== 0 || lat !== 0) {
        const existingLocation = await ParkingFacility.findOne({ 'location.coordinates': [lng, lat], _id: { $ne: id } });
        if (existingLocation) {
          throw new AppError('Vị trí bản đồ này đã được sử dụng cho toà nhà khác', 400);
        }
      }
    }

    if (data.totalFloors !== undefined) {
      const currentFloorsCount = await Floor.countDocuments({
        facilityId: id,
        isDeleted: false,
      });

      if (data.totalFloors < currentFloorsCount) {
        throw new AppError(
          `Không thể giảm số tầng xuống ${data.totalFloors} vì toà nhà đang có ${currentFloorsCount} tầng. Vui lòng xoá bớt tầng trước khi giảm.`,
          400
        );
      }
    }

    if (data.status === 'inactive') {
      const activeSlots = await ParkingSlot.countDocuments({
        facilityId: id,
        status: { $in: ['occupied', 'reserved'] },
      });

      if (activeSlots > 0) {
        throw new AppError('Không thể vô hiệu hoá toà nhà khi còn xe đang gửi hoặc đặt chỗ', 400);
      }
    }

    const facility = await ParkingFacility.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!facility) {
      throw new AppError('Facility not found', 404);
    }

    if (data.status === 'inactive') {
      await Floor.updateMany({ facilityId: id, isDeleted: false }, { status: 'inactive' });
      await ParkingSlot.updateMany({ facilityId: id, status: 'available' }, { status: 'maintenance' });
    } else if (data.status === 'active') {
      await Floor.updateMany({ facilityId: id, isDeleted: false }, { status: 'active' });
      await ParkingSlot.updateMany({ facilityId: id, status: 'maintenance' }, { status: 'available' });
    }

    await delPattern('cache:public:facilities:*');
    await delCache(`cache:public:available-slots:${id}`);
    
    try {
      getIO().to(`facility:${id}`).emit('facility:updated', { facilityId: id });
    } catch (e) {}

    return facility;
  }

  static async deactivateFacility(id: string): Promise<IParkingFacility | null> {
    const activeSlots = await ParkingSlot.countDocuments({
      facilityId: id,
      status: { $in: ['occupied', 'reserved'] },
    });

    if (activeSlots > 0) {
      throw new AppError('Cannot deactivate facility with active parking sessions', 400);
    }

    const facility = await ParkingFacility.findByIdAndUpdate(
      id,
      { status: 'inactive' },
      { new: true }
    );

    if (!facility) {
      throw new AppError('Facility not found', 404);
    }

    await Floor.updateMany({ facilityId: id, isDeleted: false }, { status: 'inactive' });
    await ParkingSlot.updateMany({ facilityId: id, status: 'available' }, { status: 'maintenance' });

    await delPattern('cache:public:facilities:*');
    await delCache(`cache:public:available-slots:${id}`);
    
    try {
      getIO().to(`facility:${id}`).emit('facility:updated', { facilityId: id });
    } catch (e) {}

    return facility;
  }

  static async softDeleteFacility(id: string): Promise<IParkingFacility | null> {
    const activeSlots = await ParkingSlot.countDocuments({
      facilityId: id,
      status: { $in: ['occupied', 'reserved'] },
    });

    if (activeSlots > 0) {
      throw new AppError('Không thể xoá bãi xe khi còn xe đang gửi hoặc đặt chỗ', 400);
    }

    const facility = await ParkingFacility.findByIdAndUpdate(
      id,
      { isDeleted: true, status: 'inactive' },
      { new: true }
    );

    if (!facility) {
      throw new AppError('Facility not found', 404);
    }

    await Floor.updateMany({ facilityId: id }, { isDeleted: true, status: 'inactive' });
    await ParkingSlot.updateMany({ facilityId: id }, { isDeleted: true, status: 'maintenance' });

    if (facility.assignedUsers && facility.assignedUsers.length > 0) {
      await User.updateMany(
        { _id: { $in: facility.assignedUsers } },
        { $pull: { assignedFacilities: facility._id } }
      );
      facility.assignedUsers = [];
      await facility.save();
    }

    await delPattern('cache:public:facilities:*');
    await delCache(`cache:public:available-slots:${id}`);
    await delCache(`cache:public:pricing:${id}`);
    await delCache(`cache:operationsConfig:${id}`);

    try {
      getIO().to(`facility:${id}`).emit('facility:updated', { facilityId: id });
    } catch (e) {}

    return facility;
  }


  static async getFacilityById(id: string): Promise<IParkingFacility | null> {
    const facility = await ParkingFacility.findById(id).lean() as any;
    if (!facility) {
      throw new AppError('Facility not found', 404);
    }
    return facility;
  }

  static async getAllFacilities(filters: any = {}, skip = 0, limit = 10): Promise<{ facilities: IParkingFacility[]; total: number }> {
    const facilities = await ParkingFacility.find(filters).skip(skip).limit(limit).sort({ createdAt: -1 }).lean() as any;
    const total = await ParkingFacility.countDocuments(filters);
    return { facilities, total };
  }

  static async getOperationsConfig(facilityId: string): Promise<{ facilityId: string; allowedVehicleTypes: IVehicleType[] }> {
    const cacheKey = `cache:operationsConfig:${facilityId}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    const facility = await ParkingFacility.findById(facilityId);
    if (!facility) {
      throw new AppError('Facility not found', 404);
    }

    const floors = await Floor.find({
      facilityId,
      status: 'active',
      isDeleted: false,
    }).select('allowedVehicleTypes').lean() as any;

    const vehicleTypeIdSet = new Set<string>();
    for (const floor of floors) {
      for (const vtId of floor.allowedVehicleTypes) {
        vehicleTypeIdSet.add(vtId.toString());
      }
    }

    const allowedVehicleTypes = await VehicleType.find({
      _id: { $in: Array.from(vehicleTypeIdSet) },
      isDeleted: false,
    }).sort({ name: 1 }).lean() as any;

    const result = { facilityId, allowedVehicleTypes };
    
    await setCache(cacheKey, result);

    return result;
  }
}
