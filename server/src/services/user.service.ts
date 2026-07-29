import bcrypt from 'bcryptjs';
import { User, IUser, UserStatus } from '../models/user.model';
import { ParkingFacility } from '../models/parkingFacility.model';
import { Reservation, ReservationStatus } from '../models/reservation.model';
import { AppError } from '../middlewares/error.middleware';

export class UserService {
  static async createUser(data: Partial<IUser>): Promise<IUser> {
    const existingUser = await User.findOne({ $or: [{ email: data.email }, { phone: data.phone }] });
    if (existingUser) {
      if (existingUser.email === data.email) throw new AppError('Email đã được sử dụng', 400);
      if (existingUser.phone === data.phone) throw new AppError('Số điện thoại đã được sử dụng', 400);
      throw new AppError('Email hoặc số điện thoại đã được sử dụng', 400);
    }

    let password = data.password;
    if (!password) {
      // Generate a temporary password if not provided
      password = Math.random().toString(36).slice(-8);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password as string, salt);

    const newUser = new User({
      ...data,
      password: hashedPassword,
    });

    await newUser.save();

    // Two-way sync: thêm user._id vào ParkingFacility.assignedUsers[] cho mỗi facility
    if (data.assignedFacilities && data.assignedFacilities.length > 0) {
      await ParkingFacility.updateMany(
        { _id: { $in: data.assignedFacilities } },
        { $addToSet: { assignedUsers: newUser._id } }
      );
    }

    return newUser;
  }

  static async updateUser(userId: string, data: Partial<IUser>): Promise<IUser | null> {
    // Prevent updating critical fields directly
    delete data.password;
    delete data.role;
    delete data.status;
    delete data.assignedFacilities; // Force using assignFacilities endpoint for two-way sync

    if (data.email || data.phone) {
      const orConditions: any[] = [];
      if (data.email) orConditions.push({ email: data.email });
      if (data.phone) orConditions.push({ phone: data.phone });
      
      if (orConditions.length > 0) {
        const existingUser = await User.findOne({
          _id: { $ne: userId },
          $or: orConditions
        });
        
        if (existingUser) {
          if (data.email && existingUser.email === data.email) {
            throw new AppError('Email đã được sử dụng', 400);
          }
          if (data.phone && existingUser.phone === data.phone) {
            throw new AppError('Số điện thoại đã được sử dụng', 400);
          }
        }
      }
    }

    const updatedUser = await User.findByIdAndUpdate(userId, data, { new: true, runValidators: true });
    if (!updatedUser) {
      throw new AppError('User not found', 404);
    }
    return updatedUser;
  }

  static async getUserById(userId: string): Promise<IUser | null> {
    const user = await User.findById(userId)
      .populate('assignedFacilities', 'name address status openTime closeTime')
      .lean() as IUser | null;
    if (!user) {
      throw new AppError('User not found', 404);
    }
    return user;
  }

  /** GET /users/me — Lấy profile của chính mình (Staff dùng để lấy danh sách facility) */
  static async getMe(userId: string): Promise<IUser | null> {
    const user = await User.findById(userId)
      .select('-password -customPermissions -failedLoginAttempts -lockedUntil')
      .populate('assignedFacilities', 'name address status openTime closeTime')
      .lean() as IUser | null;
    if (!user) {
      throw new AppError('User not found', 404);
    }
    return user;
  }

  /** PATCH /users/:id/assign-facilities — Manager phân công tòa nhà cho Staff */
  static async assignFacilities(
    targetUserId: string,
    facilityIds: string[],
    callerUserId?: string,
    callerRole?: string
  ): Promise<IUser | null> {
    const user = await User.findById(targetUserId);
    if (!user) throw new AppError('User not found', 404);
    if (user.isDeleted) throw new AppError('User has been deleted', 400);

    // Guard: chỉ cho phép gán facility cho Manager hoặc Staff
    if (user.role !== 'manager' && user.role !== 'staff') {
      throw new AppError('Can only assign facilities to Manager or Staff users', 400);
    }
    if (callerRole === 'manager' && user.role !== 'staff') {
      throw new AppError('Manager can only assign facilities to Staff users', 403);
    }

    const oldIds = user.assignedFacilities.map((fId) => fId.toString());
    const newIds = facilityIds;

    // Xác định facility bị xóa và thêm mới
    const removedIds = oldIds.filter((fId) => !newIds.includes(fId));
    const addedIds = newIds.filter((fId) => !oldIds.includes(fId));

    // Guard: Manager chỉ được assign hoặc gỡ facility mà chính mình đang quản lý
    if (callerRole === 'manager' && callerUserId) {
      const caller = await User.findById(callerUserId);
      if (!caller) throw new AppError('Caller not found', 404);
      const callerFacilityIds = caller.assignedFacilities.map((fId) => fId.toString());
      
      const unauthorizedAdded = addedIds.filter((fId) => !callerFacilityIds.includes(fId));
      const unauthorizedRemoved = removedIds.filter((fId) => !callerFacilityIds.includes(fId));
      
      if (unauthorizedAdded.length > 0 || unauthorizedRemoved.length > 0) {
        const unauthorized = [...unauthorizedAdded, ...unauthorizedRemoved];
        throw new AppError(
          `Manager can only assign facilities they are assigned to. Unauthorized: ${unauthorized.join(', ')}`,
          403
        );
      }
    }

    const updated = await User.findByIdAndUpdate(
      targetUserId,
      { assignedFacilities: facilityIds },
      { new: true, runValidators: true }
    ).populate('assignedFacilities', 'name address status openTime closeTime');

    // Two-way sync: xóa user._id khỏi ParkingFacility.assignedUsers[] cho các facility bị loại bỏ
    if (removedIds.length > 0) {
      await ParkingFacility.updateMany(
        { _id: { $in: removedIds } },
        { $pull: { assignedUsers: user._id } }
      );
    }

    // Two-way sync: thêm user._id vào ParkingFacility.assignedUsers[] cho các facility mới
    if (addedIds.length > 0) {
      await ParkingFacility.updateMany(
        { _id: { $in: addedIds } },
        { $addToSet: { assignedUsers: user._id } }
      );
    }

    return updated;
  }

  static async getAllUsers(filters: any = {}, skip = 0, limit = 10): Promise<{ users: IUser[]; total: number }> {
    const query = { isDeleted: false, ...filters };
    const users = await User.find(query).skip(skip).limit(limit).sort({ createdAt: -1 }).lean() as any;
    const total = await User.countDocuments(query);
    return { users, total };
  }

  static async lockUser(userId: string): Promise<IUser | null> {
    // Không cho phép khoá nếu đang có đặt chỗ
    const activeReservations = await Reservation.countDocuments({
      userId,
      status: { $in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] },
    });
    if (activeReservations > 0) {
      throw new AppError('Không thể khoá người dùng này do vẫn còn đặt chỗ đang hoạt động. Vui lòng xử lý đặt chỗ trước.', 400);
    }

    const user = await User.findByIdAndUpdate(userId, { status: UserStatus.LOCKED }, { new: true });
    if (!user) {
      throw new AppError('User not found', 404);
    }
    return user;
  }

  static async unlockUser(userId: string): Promise<IUser | null> {
    const user = await User.findByIdAndUpdate(userId, { status: UserStatus.ACTIVE, failedLoginAttempts: 0, lockedUntil: null }, { new: true });
    if (!user) {
      throw new AppError('User not found', 404);
    }
    return user;
  }

  static async softDeleteUser(userId: string): Promise<IUser | null> {
    // Không cho phép xoá nếu đang có đặt chỗ
    const activeReservations = await Reservation.countDocuments({
      userId,
      status: { $in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] },
    });
    if (activeReservations > 0) {
      throw new AppError('Không thể xoá người dùng này do vẫn còn đặt chỗ đang hoạt động. Vui lòng xử lý đặt chỗ trước.', 400);
    }

    const user = await User.findByIdAndUpdate(userId, { isDeleted: true, status: UserStatus.INACTIVE }, { new: true });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Two-way sync: xóa user._id khỏi ParkingFacility.assignedUsers[] cho tất cả facility liên quan
    if (user.assignedFacilities && user.assignedFacilities.length > 0) {
      await ParkingFacility.updateMany(
        { _id: { $in: user.assignedFacilities } },
        { $pull: { assignedUsers: user._id } }
      );
    }

    return user;
  }

  static async resetPassword(userId: string, newPassword: string): Promise<IUser | null> {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    const user = await User.findByIdAndUpdate(userId, { 
      password: hashedPassword,
      mustChangePassword: true,
      failedLoginAttempts: 0,
      lockedUntil: null
    }, { new: true });

    if (!user) {
      throw new AppError('User not found', 404);
    }
    return user;
  }
}
