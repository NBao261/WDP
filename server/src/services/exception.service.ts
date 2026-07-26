import mongoose from 'mongoose';
import { Exception, ExceptionStatus, ExceptionType, IException } from '../models/exception.model';
import { ParkingSession, SessionStatus } from '../models/parkingSession.model';
import { ParkingSlot, SlotStatus } from '../models/parkingSlot.model';
import { User } from '../models/user.model';
import { AppError } from '../middlewares/error.middleware';
import { getIO } from '../config/socket';
import { addExceptionUploadJob } from '../queues/uploadQueue';

interface CreateExceptionDto {
  sessionId: string;
  type: ExceptionType;
  description: string;
  staffId: string;
  surcharge?: number;
  actualPlate?: string;
  expectedPlate?: string;
  checkInImage?: string;
  checkOutImage?: string;
  cardCode?: string;
}

interface ResolveExceptionDto {
  staffId: string;
  staffNote: string;
  newLicensePlate?: string; // For WRONG_PLATE
  newSlotId?: string;       // For WRONG_ZONE
}

interface ManagerReviewDto {
  managerId: string;
  managerNote: string;
}

export class ExceptionService {
  /**
   * Tạo ngoại lệ mới (Staff)
   * → Khóa session nếu cần (LOST_CARD, WRONG_PLATE, WRONG_ZONE)
   */
  static async createException(data: CreateExceptionDto): Promise<IException> {
    const session = await ParkingSession.findById(data.sessionId);
    if (!session) {
      throw new AppError('Lượt gửi xe không tồn tại', 404);
    }
    if (session.status === SessionStatus.COMPLETED) {
      throw new AppError('Không thể tạo ngoại lệ cho lượt gửi đã kết thúc', 400);
    }

    // Kiểm tra staff có được phân công tại bãi xe này không (chống IDOR)
    const staffUser = await User.findById(data.staffId).select('assignedFacilities');
    if (!staffUser) throw new AppError('Staff không tồn tại', 404);
    const isAssigned = staffUser.assignedFacilities.some(
      (fId) => fId.toString() === session.facilityId.toString()
    );
    if (!isAssigned) {
      throw new AppError('Bạn không được phân công tại bãi xe này', 403);
    }

    const exception = new Exception({
      sessionId: new mongoose.Types.ObjectId(data.sessionId),
      type: data.type,
      description: data.description,
      source: 'staff',
      staffId: new mongoose.Types.ObjectId(data.staffId),
      surcharge: data.surcharge || 0,
      actualPlate: data.actualPlate,
      expectedPlate: data.expectedPlate,
      checkInImage: data.checkInImage,
      checkOutImage: data.checkOutImage,
      cardCode: data.cardCode,
      status: ExceptionStatus.NEW,
    });

    await exception.save();

    if (
      data.type === ExceptionType.LOST_CARD ||
      data.type === ExceptionType.WRONG_PLATE ||
      data.type === ExceptionType.WRONG_ZONE
    ) {
      session.status = SessionStatus.EXCEPTION;
      await session.save();
    }

    try {
      getIO().to(`facility:${session.facilityId}`).emit('exception:created', {
        exception,
        facilityId: session.facilityId,
      });
    } catch (e) {
      // Bỏ qua lỗi socket
    }

    // Upload ảnh exception lên Cloudinary (background)
    if (
      (exception.checkInImage && exception.checkInImage.startsWith('/uploads/')) ||
      (exception.checkOutImage && exception.checkOutImage.startsWith('/uploads/'))
    ) {
      addExceptionUploadJob((exception._id as any).toString()).catch(console.error);
    }

    return exception;
  }

  /**
   * Lấy chi tiết một exception theo ID (bao gồm images)
   */
  static async getExceptionById(exceptionId: string): Promise<IException> {
    const exception = await Exception.findById(exceptionId)
      .populate('staffId', 'name email')
      .populate('driverId', 'name email phone')
      .populate('resolvedByStaffId', 'name email')
      .populate('managerId', 'name email')
      .populate('oldSlot', 'name')
      .populate('newSlot', 'name')
      .populate({
        path: 'sessionId',
        select: 'code licensePlate status facilityId vehicleTypeId checkInTime checkOutTime gateIn gateOut floorId slotId totalFee cardCode',
        populate: [
          { path: 'facilityId', select: 'name' },
          { path: 'vehicleTypeId', select: 'name code' },
          { path: 'floorId', select: 'name' },
          { path: 'slotId', select: 'code name' }
        ]
      })
      .lean();

    if (!exception) {
      throw new AppError('Không tìm thấy sự cố', 404);
    }

    return exception as unknown as IException;
  }

  /**
   * Lấy danh sách ngoại lệ
   */
  static async getExceptions(query: any, user: any): Promise<{ data: IException[], total: number, page: number, totalPages: number }> {
    const { page = 1, limit = 10, status, type, sessionId, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const filter: any = {};

    if (status) filter.status = status;
    if (type) filter.type = type;

    // Filter by assigned facilities
    if (user.role !== 'admin') {
      const { User } = await import('../models/user.model');
      const dbUser = await User.findById(user.userId).select('assignedFacilities');
      if (dbUser && dbUser.assignedFacilities && dbUser.assignedFacilities.length > 0) {
        if (sessionId) {
          const session = await ParkingSession.findOne({
            _id: sessionId,
            facilityId: { $in: dbUser.assignedFacilities }
          });
          if (!session) {
            return { data: [], total: 0, page: Number(page), totalPages: 0 };
          }
          filter.sessionId = sessionId;
        } else {
          const queryObj: any = { facilityId: { $in: dbUser.assignedFacilities } };
          if (query.facilityId && dbUser.assignedFacilities.some(id => id.toString() === query.facilityId)) {
            queryObj.facilityId = query.facilityId;
          }
          const sessions = await ParkingSession.find(queryObj).select('_id').lean();
          const sessionIds = sessions.map(s => s._id);
          filter.sessionId = { $in: sessionIds };
        }
      } else {
        // No facilities assigned => no data
        return { data: [], total: 0, page: Number(page), totalPages: 0 };
      }
    } else {
      if (sessionId) filter.sessionId = sessionId;
      if (query.facilityId) {
        const sessions = await ParkingSession.find({ facilityId: query.facilityId }).select('_id').lean();
        const fSessionIds = sessions.map(s => s._id);
        if (filter.sessionId) {
          if (Array.isArray(filter.sessionId.$in)) {
             filter.sessionId.$in = filter.sessionId.$in.filter((id: any) => fSessionIds.some(fid => fid.toString() === id.toString()));
          } else {
             filter.sessionId = fSessionIds.some(fid => fid.toString() === filter.sessionId.toString()) ? filter.sessionId : null;
          }
        } else {
          filter.sessionId = { $in: fSessionIds };
        }
      }
    }

    const skip = (Number(page) - 1) * Number(limit);
    const sort: any = { [sortBy as string]: sortOrder === 'asc' ? 1 : -1 };

    const [data, total] = await Promise.all([
      Exception.find(filter)
        .select('-images')
        .sort(sort)
        .skip(skip)
        .limit(Number(limit))
        .populate('staffId', 'name')
        .populate('driverId', 'name email phone')
        .populate('resolvedByStaffId', 'name')
        .populate('managerId', 'name')
        .populate('oldSlot', 'name')
        .populate('newSlot', 'name')
        .populate({
          path: 'sessionId',
          select: 'code licensePlate status facilityId vehicleTypeId checkInTime checkOutTime gateIn gateOut floorId slotId totalFee cardCode',
          populate: [
            { path: 'facilityId', select: 'name' },
            { path: 'vehicleTypeId', select: 'name code' },
            { path: 'floorId', select: 'name' },
            { path: 'slotId', select: 'code name' }
          ]
        })
        .lean(),
      Exception.countDocuments(filter)
    ]);

    return {
      data: data as any[],
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit))
    };
  }

  /**
   * Staff xử lý ngoại lệ
   * → Thực hiện hành động tương ứng (đổi biển số, chuyển slot, mở khoá session)
   */
  static async resolveException(exceptionId: string, data: ResolveExceptionDto): Promise<IException> {
    const exception = await Exception.findById(exceptionId);
    if (!exception) {
      throw new AppError('Không tìm thấy ngoại lệ', 404);
    }

    if (exception.status === ExceptionStatus.RESOLVED) {
      throw new AppError('Ngoại lệ đã được xử lý trước đó', 400);
    }

    exception.resolvedByStaffId = new mongoose.Types.ObjectId(data.staffId);
    exception.staffNote = data.staffNote || '';
    exception.status = ExceptionStatus.RESOLVED;

    // Thực hiện các hành động tương ứng với loại ngoại lệ
    const session = await ParkingSession.findById(exception.sessionId);
    if (!session) throw new AppError('Lượt gửi xe liên quan không tồn tại', 404);

    // Kiểm tra staff có được phân công tại bãi xe này không (chống IDOR)
    const staffUser = await User.findById(data.staffId).select('assignedFacilities');
    if (!staffUser) throw new AppError('Staff không tồn tại', 404);
    const isAssigned = staffUser.assignedFacilities.some(
      (fId) => fId.toString() === session.facilityId.toString()
    );
    if (!isAssigned) {
      throw new AppError('Bạn không được phân công tại bãi xe này', 403);
    }

    if (exception.type === ExceptionType.WRONG_PLATE) {
      if (!data.newLicensePlate) {
        throw new AppError('Vui lòng cung cấp biển số mới khi xử lý ngoại lệ sai biển số', 400);
      }
      // Cập nhật lại biển số đúng
      session.licensePlate = data.newLicensePlate.toUpperCase();

      // Chỉ mở khóa session khi không còn ngoại lệ nào khác chưa xử lý
      const unresolvedAfterPlate = await Exception.countDocuments({
        sessionId: session._id,
        _id: { $ne: exception._id },
        status: ExceptionStatus.NEW,
      });
      if (unresolvedAfterPlate === 0) {
        session.status = SessionStatus.ACTIVE;
      }
      await session.save();
    }
    else if (exception.type === ExceptionType.WRONG_ZONE) {
      if (!data.newSlotId) {
        throw new AppError('Vui lòng chọn slot mới khi xử lý ngoại lệ sai khu vực', 400);
      }

      // Cập nhật lại slot thực tế
      const newSlot = await ParkingSlot.findById(data.newSlotId);
      if (!newSlot) throw new AppError('Slot mới không tồn tại', 404);

      // 1. Chỉ được đổi những slot thực sự còn trống (AVAILABLE) hoặc đang khóa tạm (LOCKED)
      if (newSlot.status !== SlotStatus.AVAILABLE && newSlot.status !== SlotStatus.LOCKED) {
        throw new AppError('Slot mới không còn trống hoặc không khả dụng', 400);
      }

      // 2. Không được đổi sang tòa khác (cùng facilityId)
      if (newSlot.facilityId.toString() !== session.facilityId.toString()) {
        throw new AppError('Slot mới phải thuộc cùng một tòa nhà/bãi xe', 400);
      }

      // 3. Phải cùng loại xe (không cho ô tô đổi sang slot xe máy)
      if (newSlot.vehicleTypeId.toString() !== session.vehicleTypeId.toString()) {
        throw new AppError('Slot mới phải phù hợp với loại xe của lượt gửi', 400);
      }

      const oldSlotId = session.slotId;
      exception.oldSlot = oldSlotId as mongoose.Types.ObjectId;
      exception.newSlot = newSlot._id as mongoose.Types.ObjectId;

      // Lưu trạng thái gốc của slot mới TRƯỚC khi thay đổi
      const newSlotWasLocked = newSlot.status === SlotStatus.LOCKED;

      // Cập nhật session (giữ nguyên mọi thông tin, chỉ đổi slot + floor + mở khoá)
      session.slotId = newSlot._id as mongoose.Types.ObjectId;
      session.floorId = newSlot.floorId;

      // Chỉ mở khóa session khi không còn ngoại lệ nào khác chưa xử lý
      const unresolvedAfterZone = await Exception.countDocuments({
        sessionId: session._id,
        _id: { $ne: exception._id },
        status: ExceptionStatus.NEW,
      });
      if (unresolvedAfterZone === 0) {
        session.status = SessionStatus.ACTIVE;
      }
      await session.save();

      // Cập nhật slot mới -> Occupied (xoá ghi chú cũ nếu có)
      newSlot.status = SlotStatus.OCCUPIED;
      newSlot.currentSessionId = session._id as mongoose.Types.ObjectId;
      newSlot.maintenanceReason = '';
      await newSlot.save();

      // Xử lý slot cũ dựa trên trạng thái gốc của slot MỚI  
      if (oldSlotId) {
        const oldSlot = await ParkingSlot.findById(oldSlotId);
        if (oldSlot) {
          if (newSlotWasLocked) {
            // newSlot đang Locked → xe đậu nhầm được hợp lệ hoá tại chỗ → slot cũ trống
            oldSlot.status = SlotStatus.AVAILABLE;
            oldSlot.maintenanceReason = '';
          } else {
            // newSlot đang Available → dời xe sang chỗ mới → slot cũ có xe lạ chiếm → khoá
            oldSlot.status = SlotStatus.LOCKED;
            oldSlot.maintenanceReason = 'Đang có xe đậu sai chỗ, chờ xác minh';
          }
          oldSlot.currentSessionId = null;
          await oldSlot.save();
        }
      }
    }
    else if (exception.type === ExceptionType.LOST_CARD) {
      // Chỉ mở khóa session khi không còn ngoại lệ nào khác chưa xử lý
      const unresolvedAfterCard = await Exception.countDocuments({
        sessionId: session._id,
        _id: { $ne: exception._id },
        status: ExceptionStatus.NEW,
      });
      if (unresolvedAfterCard === 0) {
        session.status = SessionStatus.ACTIVE;
      }
      await session.save();
    }

    await exception.save();

    // Lấy lại dữ liệu đã populate
    const updatedException = await Exception.findById(exception._id)
      .populate('staffId', 'name email')
      .populate('resolvedByStaffId', 'name email')
      .populate('managerId', 'name email')
      .populate('oldSlot', 'name')
      .populate('newSlot', 'name')
      .populate('sessionId');

    try {
      getIO().to(`facility:${session.facilityId}`).emit('exception:resolved', {
        exception: updatedException,
        facilityId: session.facilityId,
      });
    } catch (e) {
      // Bỏ qua lỗi socket
    }

    return updatedException!;
  }

  /**
   * Manager review + thêm ghi chú cho ngoại lệ đã xử lý
   * → Không thay đổi status hay session, chỉ ghi nhận review
   */
  static async addManagerReview(exceptionId: string, data: ManagerReviewDto): Promise<IException> {
    const exception = await Exception.findById(exceptionId);
    if (!exception) {
      throw new AppError('Không tìm thấy ngoại lệ', 404);
    }

    exception.managerId = new mongoose.Types.ObjectId(data.managerId);
    exception.managerNote = data.managerNote || '';
    await exception.save();

    const updatedException = await Exception.findById(exception._id)
      .populate('staffId', 'name email')
      .populate('resolvedByStaffId', 'name email')
      .populate('managerId', 'name email')
      .populate({
        path: 'sessionId',
        populate: [
          { path: 'vehicleTypeId', select: 'name code' },
          { path: 'slotId', select: 'code' },
          { path: 'floorId', select: 'name' }
        ]
      });

    return updatedException!;
  }

  /**
   * Driver tạo báo cáo sự cố (phản hồi)
   */
  static async createDriverReport(data: {
    sessionId: string;
    type: string;
    description: string;
    driverId: string;
    images?: string[];
  }): Promise<IException> {
    const session = await ParkingSession.findById(data.sessionId);
    if (!session) {
      throw new AppError('Lượt gửi xe không tồn tại', 404);
    }
    
    // Kiểm tra session có thuộc về driver không (thông qua userId của driver đã tạo xe)
    // Ở đây tạm dùng thông tin chung, thực tế có thể cần liên kết thêm

    let imageUrls: string[] = [];
    if (data.images && data.images.length > 0) {
      // Import UploadService dynamically or ensure it's imported at the top
      const { UploadService } = await import('./upload.service');
      for (const img of data.images) {
        if (img.startsWith('data:image')) {
          try {
            const url = await UploadService.uploadBase64Image(img, 'exceptions');
            imageUrls.push(url);
          } catch (error) {
            console.error('[ExceptionService] Error uploading image to Cloudinary:', error);
          }
        } else {
          imageUrls.push(img); // Neu da la url roi
        }
      }
    }
    
    const exception = new Exception({
      sessionId: new mongoose.Types.ObjectId(data.sessionId),
      type: data.type as ExceptionType,
      description: data.description,
      source: 'driver',
      driverId: new mongoose.Types.ObjectId(data.driverId),
      images: imageUrls,
      status: ExceptionStatus.NEW,
    });

    await exception.save();

    // Không khóa session tự động khi driver report (để staff review)

    try {
      getIO().to(`facility:${session.facilityId}`).emit('exception:created', {
        exception,
        facilityId: session.facilityId,
      });
    } catch (e) {
      // Bỏ qua lỗi socket
    }

    return exception;
  }

  /**
   * Lấy danh sách báo cáo sự cố của Driver
   */
  static async getDriverReports(driverId: string, query: any): Promise<{ data: IException[], total: number, page: number, totalPages: number }> {
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const filter: any = { driverId: new mongoose.Types.ObjectId(driverId) };

    const skip = (Number(page) - 1) * Number(limit);
    const sort: any = { [sortBy as string]: sortOrder === 'asc' ? 1 : -1 };

    const [data, total] = await Promise.all([
      Exception.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(Number(limit))
        .populate('staffId', 'name')
        .populate('resolvedByStaffId', 'name')
        .populate('oldSlot', 'name code')
        .populate('newSlot', 'name code')
        .populate({
          path: 'sessionId',
          select: 'code licensePlate checkInTime facilityId slotId',
          populate: [
            { path: 'facilityId', select: 'name' },
            { path: 'slotId', select: 'name code' }
          ]
        })
        .lean(),
      Exception.countDocuments(filter)
    ]);

    return {
      data: data as any[],
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit))
    };
  }

  /**
   * Tự động phát hiện xe quá hạn (quá 24h) và tạo cảnh báo (Exception OVERTIME)
   */
  static async detectOverdueSessions(): Promise<number> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Tìm các session đang active và gửi quá 24h
    const overdueSessions = await ParkingSession.find({
      status: SessionStatus.ACTIVE,
      checkInTime: { $lt: twentyFourHoursAgo }
    });

    let detectedCount = 0;

    for (const session of overdueSessions) {
      // Kiểm tra xem đã có ngoại lệ OVERTIME nào chưa (chưa giải quyết)
      const existingException = await Exception.findOne({
        sessionId: session._id,
        type: ExceptionType.OVERTIME,
        status: ExceptionStatus.NEW
      });

      if (!existingException) {
        const mongooseUser = mongoose.model('User');
        const adminUser = await mongooseUser.findOne({ role: 'admin' });

        if (adminUser) {
          const newException = await Exception.create({
            sessionId: session._id,
            type: ExceptionType.OVERTIME,
            description: 'Phát hiện xe đỗ quá 24h liên tục tự động bởi hệ thống.',
            source: 'system',
            staffId: adminUser._id,
            status: ExceptionStatus.NEW
          });
          detectedCount++;
          
          try {
            getIO().to(`facility:${session.facilityId}`).emit('exception:created', {
              exception: newException,
              facilityId: session.facilityId,
            });
          } catch (e) {
            // ignore
          }
        }
      }
    }

    return detectedCount;
  }
}
