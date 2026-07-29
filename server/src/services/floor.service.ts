import { Floor, IFloor } from '../models/floor.model';
import { ParkingSlot } from '../models/parkingSlot.model';
import { VehicleType } from '../models/vehicleType.model';
import { AppError } from '../middlewares/error.middleware';
import { delCache } from '../config/redis';

export class FloorService {
  static async createFloor(data: Partial<IFloor>): Promise<IFloor> {
    // Check if floor with same name exists in the same facility
    const existingFloor = await Floor.findOne({ 
      name: data.name, 
      facilityId: data.facilityId,
      isDeleted: false 
    });

    if (existingFloor) {
      throw new AppError('Tên tầng đã tồn tại trong cơ sở này', 400);
    }

    const newFloor = new Floor(data);
    await newFloor.save();

    if (data.allowedVehicleTypes && data.allowedVehicleTypes.length > 0) {
      await VehicleType.updateMany(
        { _id: { $in: data.allowedVehicleTypes } },
        { $addToSet: { floors: newFloor._id } }
      );
    }
    
    // Invalidate OperationsConfig Cache
    await delCache(`cache:operationsConfig:${data.facilityId}`);
    await delCache(`cache:public:available-slots:${data.facilityId}`);

    return newFloor;
  }

  static async updateFloor(id: string, data: Partial<IFloor>): Promise<IFloor | null> {
    if (data.status === 'inactive') {
      const activeSlots = await ParkingSlot.countDocuments({
        floorId: id,
        status: { $in: ['occupied', 'reserved'] },
      });

      if (activeSlots > 0) {
        throw new AppError('Không thể vô hiệu hoá tầng khi còn xe đang gửi hoặc đặt chỗ', 400);
      }
    }

    const floor = await Floor.findById(id);
    if (!floor) {
      throw new AppError('Floor not found', 404);
    }

    if (data.name && data.name !== floor.name) {
      const existingFloor = await Floor.findOne({
        name: data.name,
        facilityId: floor.facilityId,
        isDeleted: false
      });
      if (existingFloor) {
        throw new AppError('Tên tầng đã tồn tại trong cơ sở này', 400);
      }
    }

    const updatedFloor = await Floor.findByIdAndUpdate(id, data, { new: true, runValidators: true });

    if (data.status === 'inactive') {
      // Cascade: slots available → maintenance
      await ParkingSlot.updateMany({ floorId: id, status: 'available' }, { status: 'maintenance' });
    }
    
    // Invalidate OperationsConfig Cache
    await delCache(`cache:operationsConfig:${floor.facilityId}`);
    await delCache(`cache:public:available-slots:${floor.facilityId}`);

    return floor;
  }

  static async assignVehicleTypes(id: string, vehicleTypeIds: string[]): Promise<IFloor | null> {
    // Lấy floor hiện tại để diff
    const currentFloor = await Floor.findById(id);
    if (!currentFloor) {
      throw new AppError('Floor not found', 404);
    }

    const oldIds = currentFloor.allowedVehicleTypes.map((vtId) => vtId.toString());
    const newIds = vehicleTypeIds;

    // Xác định vehicleType bị xóa và thêm mới
    const removedIds = oldIds.filter((vtId) => !newIds.includes(vtId));
    const addedIds = newIds.filter((vtId) => !oldIds.includes(vtId));

    if (removedIds.length > 0) {
      // Check if there are any slots for the removed vehicle types
      const existingSlots = await ParkingSlot.countDocuments({
        floorId: id,
        vehicleTypeId: { $in: removedIds },
        isDeleted: false,
      });

      if (existingSlots > 0) {
        throw new AppError('Không thể gỡ loại xe đã được phân bổ chỗ đỗ tại tầng này. Vui lòng xoá chỗ đỗ trước.', 400);
      }
    }

    // Cập nhật Floor
    const floor = await Floor.findByIdAndUpdate(
      id,
      { $set: { allowedVehicleTypes: vehicleTypeIds } },
      { new: true, runValidators: true }
    );

    // Two-way sync: xóa floor._id khỏi VehicleType.floors[] cho các vehicleType bị loại bỏ
    if (removedIds.length > 0) {
      await VehicleType.updateMany(
        { _id: { $in: removedIds } },
        { $pull: { floors: currentFloor._id } }
      );
    }

    // Two-way sync: thêm floor._id vào VehicleType.floors[] cho các vehicleType mới
    if (addedIds.length > 0) {
      await VehicleType.updateMany(
        { _id: { $in: addedIds } },
        { $addToSet: { floors: currentFloor._id } }
      );
    }
    
    // Invalidate OperationsConfig Cache
    await delCache(`cache:operationsConfig:${currentFloor.facilityId}`);
    await delCache(`cache:public:available-slots:${currentFloor.facilityId}`);

    return floor;
  }

  static async softDeleteFloor(id: string): Promise<IFloor | null> {
    // Check if there are any existing slots before deleting
    const existingSlots = await ParkingSlot.countDocuments({
      floorId: id,
      isDeleted: false,
    });

    if (existingSlots > 0) {
      throw new AppError('Không thể xoá tầng đã được phân bổ chỗ đỗ. Vui lòng xoá các chỗ đỗ thuộc tầng này trước.', 400);
    }

    const floor = await Floor.findByIdAndUpdate(id, { isDeleted: true, status: 'inactive' }, { new: true });
    if (!floor) {
      throw new AppError('Floor not found', 404);
    }

    // Two-way sync: xóa floor._id khỏi VehicleType.floors[] cho tất cả vehicleType liên quan
    if (floor.allowedVehicleTypes && floor.allowedVehicleTypes.length > 0) {
      await VehicleType.updateMany(
        { _id: { $in: floor.allowedVehicleTypes } },
        { $pull: { floors: floor._id } }
      );
    }
    
    // Invalidate OperationsConfig Cache
    await delCache(`cache:operationsConfig:${floor.facilityId}`);
    await delCache(`cache:public:available-slots:${floor.facilityId}`);

    return floor;
  }

  static async getFloorById(id: string): Promise<IFloor | null> {
    const floor = await Floor.findById(id).populate('allowedVehicleTypes').lean() as any;
    if (!floor) {
      throw new AppError('Floor not found', 404);
    }
    return floor;
  }

  static async getAllFloors(filters: any = {}, skip = 0, limit = 10): Promise<{ floors: IFloor[]; total: number }> {
    const query = { isDeleted: false, ...filters };
    const floors = await Floor.find(query).skip(skip).limit(limit).sort({ createdAt: -1 }).populate('allowedVehicleTypes').lean() as any;
    const total = await Floor.countDocuments(query);
    return { floors, total };
  }
}
