import mongoose from 'mongoose';
import { Vehicle, IVehicle } from '../models/vehicle.model';
import { VehicleType } from '../models/vehicleType.model';
import { AppError } from '../middlewares/error.middleware';
import { Reservation, ReservationStatus } from '../models/reservation.model';
import { ParkingSession, SessionStatus } from '../models/parkingSession.model';
import { UploadService } from './upload.service';

interface AddVehicleDto {
  userId: string;
  vehicleTypeId: string;
  licensePlate: string;
  nickname?: string;
  image?: string;
  isDefault?: boolean;
}

interface UpdateVehicleDto {
  vehicleTypeId?: string;
  licensePlate?: string;
  nickname?: string;
  image?: string;
  isDefault?: boolean;
}

export class VehicleService {
  /**
   * Kiểm tra xe có đang được sử dụng (có reservation active hoặc session active)
   */
  static async checkVehicleInUse(licensePlate: string): Promise<{ isInUse: boolean; reason: string }> {
    // Kiểm tra phiên đỗ xe đang active
    const activeSession = await ParkingSession.findOne({
      licensePlate: licensePlate.toUpperCase(),
      status: { $in: [SessionStatus.ACTIVE, SessionStatus.PENDING_PAYMENT] },
    });
    if (activeSession) {
      return {
        isInUse: true,
        reason: `Xe đang đỗ trong bãi (mã phiên: ${activeSession.code}). Không thể thao tác cho đến khi xe rời bãi.`,
      };
    }

    // Kiểm tra đặt chỗ đang active
    const activeReservation = await Reservation.findOne({
      licensePlate: licensePlate.toUpperCase(),
      status: { $in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] },
    });
    if (activeReservation) {
      return {
        isInUse: true,
        reason: `Xe đang có đặt chỗ (mã: ${activeReservation.code}). Vui lòng huỷ đặt chỗ trước khi thao tác.`,
      };
    }

    return { isInUse: false, reason: '' };
  }

  /**
   * Thêm xe mới cho Driver
   */
  static async addVehicle(data: AddVehicleDto): Promise<IVehicle> {
    // Validate vehicleTypeId tồn tại
    const vehicleType = await VehicleType.findById(data.vehicleTypeId);
    if (!vehicleType || vehicleType.isDeleted) {
      throw new AppError('Loại xe không tồn tại hoặc đã bị xoá', 400);
    }

    // Kiểm tra trùng biển số per user
    const existing = await Vehicle.findOne({
      userId: data.userId,
      licensePlate: data.licensePlate.toUpperCase(),
      isDeleted: false,
    });
    if (existing) {
      throw new AppError('Bạn đã đăng ký xe với biển số này rồi', 400);
    }

    // Upload ảnh lên Cloudinary nếu là base64
    let imageUrl = data.image || '';
    if (imageUrl && UploadService.isBase64Image(imageUrl)) {
      try {
        imageUrl = await UploadService.uploadBase64Image(imageUrl);
      } catch (err) {
        console.error('[VehicleService] Upload ảnh xe thất bại, lưu trống:', err);
        imageUrl = '';
      }
    }

    const vehicle = new Vehicle({
      userId: new mongoose.Types.ObjectId(data.userId),
      vehicleTypeId: new mongoose.Types.ObjectId(data.vehicleTypeId),
      licensePlate: data.licensePlate.toUpperCase(),
      nickname: data.nickname || '',
      image: imageUrl,
    });

    if (data.isDefault === true) {
      // Bỏ default các xe khác
      await Vehicle.updateMany(
        { userId: data.userId, isDeleted: false },
        { isDefault: false }
      );
      vehicle.isDefault = true;
    } else {
      vehicle.isDefault = false;
    }

    await vehicle.save();

    return vehicle.populate('vehicleTypeId', 'name code icon');
  }

  /**
   * Lấy danh sách xe của Driver
   */
  static async getMyVehicles(userId: string): Promise<any[]> {
    const vehicles = await Vehicle.find({ userId, isDeleted: false })
      .sort({ isDefault: -1, createdAt: -1 })
      .populate('vehicleTypeId', 'name code icon')
      .lean();

    // Batch check trạng thái sử dụng cho tất cả xe
    const plates = vehicles.map(v => v.licensePlate);

    const [activeReservations, activeSessions] = await Promise.all([
      Reservation.find({
        licensePlate: { $in: plates },
        status: { $in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] },
      }).select('licensePlate').lean(),
      ParkingSession.find({
        licensePlate: { $in: plates },
        status: { $in: [SessionStatus.ACTIVE, SessionStatus.PENDING_PAYMENT] },
      }).select('licensePlate').lean(),
    ]);

    const reservedPlates = new Set(activeReservations.map(r => r.licensePlate));
    const parkedPlates = new Set(activeSessions.map(s => s.licensePlate));

    return vehicles.map(v => ({
      ...v,
      isInUse: reservedPlates.has(v.licensePlate) || parkedPlates.has(v.licensePlate),
      inUseReason: parkedPlates.has(v.licensePlate)
        ? 'Xe đang đỗ trong bãi'
        : reservedPlates.has(v.licensePlate)
          ? 'Xe đang có đặt chỗ'
          : '',
    }));
  }

  /**
   * Lấy chi tiết 1 xe
   */
  static async getVehicleById(userId: string, vehicleId: string): Promise<any> {
    const vehicle = await Vehicle.findOne({ _id: vehicleId, userId, isDeleted: false })
      .populate('vehicleTypeId', 'name code icon')
      .lean();
    if (!vehicle) {
      throw new AppError('Xe không tồn tại hoặc không thuộc về bạn', 404);
    }

    // Kiểm tra trạng thái sử dụng
    const inUseCheck = await VehicleService.checkVehicleInUse(vehicle.licensePlate);
    return { ...vehicle, isInUse: inUseCheck.isInUse, inUseReason: inUseCheck.reason };
  }

  /**
   * Cập nhật xe (vehicleTypeId, licensePlate, nickname, image, isDefault)
   */
  static async updateVehicle(userId: string, vehicleId: string, data: UpdateVehicleDto): Promise<IVehicle> {
    const vehicle = await Vehicle.findOne({ _id: vehicleId, userId, isDeleted: false });
    if (!vehicle) {
      throw new AppError('Xe không tồn tại hoặc không thuộc về bạn', 404);
    }

    // Kiểm tra xe có đang được sử dụng không
    const inUseCheck = await VehicleService.checkVehicleInUse(vehicle.licensePlate);
    if (inUseCheck.isInUse) {
      throw new AppError(inUseCheck.reason, 400);
    }

    // Cập nhật loại xe
    if (data.vehicleTypeId) {
      const vt = await VehicleType.findById(data.vehicleTypeId);
      if (!vt || vt.isDeleted) {
        throw new AppError('Loại xe không tồn tại hoặc đã bị xoá', 400);
      }
      vehicle.vehicleTypeId = new mongoose.Types.ObjectId(data.vehicleTypeId);
    }

    // Cập nhật biển số (check trùng)
    if (data.licensePlate) {
      const plate = data.licensePlate.toUpperCase();
      const dup = await Vehicle.findOne({
        userId, licensePlate: plate, isDeleted: false,
        _id: { $ne: vehicleId },
      });
      if (dup) {
        throw new AppError('Bạn đã đăng ký xe với biển số này rồi', 400);
      }
      vehicle.licensePlate = plate;
    }

    if (data.nickname !== undefined) vehicle.nickname = data.nickname;

    // Upload ảnh lên Cloudinary nếu là base64 mới
    if (data.image !== undefined) {
      if (data.image && UploadService.isBase64Image(data.image)) {
        try {
          vehicle.image = await UploadService.uploadBase64Image(data.image);
        } catch (err) {
          console.error('[VehicleService] Upload ảnh xe thất bại:', err);
          // Giữ ảnh cũ nếu upload thất bại
        }
      } else {
        vehicle.image = data.image;
      }
    }

    // Nếu set default → bỏ default của các xe khác
    if (data.isDefault === true) {
      await Vehicle.updateMany(
        { userId, isDeleted: false, _id: { $ne: vehicleId } },
        { isDefault: false }
      );
      vehicle.isDefault = true;
    } else if (data.isDefault === false) {
      vehicle.isDefault = false;
    }

    await vehicle.save();
    return vehicle.populate('vehicleTypeId', 'name code icon');
  }

  /**
   * Xoá xe (soft delete)
   */
  static async deleteVehicle(userId: string, vehicleId: string): Promise<void> {
    const vehicle = await Vehicle.findOne({ _id: vehicleId, userId, isDeleted: false });
    if (!vehicle) {
      throw new AppError('Xe không tồn tại hoặc không thuộc về bạn', 404);
    }

    // Kiểm tra xe có đang được sử dụng không
    const inUseCheck = await VehicleService.checkVehicleInUse(vehicle.licensePlate);
    if (inUseCheck.isInUse) {
      throw new AppError(inUseCheck.reason, 400);
    }

    vehicle.isDeleted = true;
    vehicle.isDefault = false;
    await vehicle.save();
  }
}
