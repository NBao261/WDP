import { Feedback, IFeedback, FeedbackStatus } from '../models/feedback.model';
import { ParkingSession } from '../models/parkingSession.model';
import { AppError } from '../middlewares/error.middleware';
import { logger } from '../config/logger';
import { getIO } from '../config/socket';
import fs from 'fs';
import path from 'path';
import { UploadService } from './upload.service';

export class FeedbackService {
  static async createFeedback(userId: string, data: {
    sessionId: string;
    facilityId?: string;
    type: string;
    description: string;
    images?: string[];
  }): Promise<IFeedback> {
    const session = await ParkingSession.findById(data.sessionId);
    if (!session) throw new AppError('Lượt gửi xe không tồn tại', 404);
    
    const facilityId = session.facilityId?.toString();
    if (!facilityId) throw new AppError('Không tìm thấy thông tin toà nhà của lượt gửi', 400);

    let processedImages: string[] = [];
    if (data.images && data.images.length > 0) {
      const dir = path.join(__dirname, '../../public/uploads/feedbacks');
      if (!fs.existsSync(dir) && !process.env.CLOUDINARY_CLOUD_NAME) {
        fs.mkdirSync(dir, { recursive: true });
      }

      for (const img of data.images) {
        if (UploadService.isBase64Image(img)) {
          if (process.env.CLOUDINARY_CLOUD_NAME) {
            try {
              const cloudUrl = await UploadService.uploadBase64Image(img, 'smart_parking/feedbacks');
              processedImages.push(cloudUrl);
            } catch (err) {
              logger.error('Failed to upload feedback image to Cloudinary:', err);
              const matches = img.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
              if (matches && matches.length === 3) {
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
                const buffer = Buffer.from(matches[2], 'base64');
                const filename = `feedback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
                fs.writeFileSync(path.join(dir, filename), buffer);
                processedImages.push(`/uploads/feedbacks/${filename}`);
              }
            }
          } else {
            const matches = img.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
              const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
              const buffer = Buffer.from(matches[2], 'base64');
              const filename = `feedback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
              fs.writeFileSync(path.join(dir, filename), buffer);
              processedImages.push(`/uploads/feedbacks/${filename}`);
            } else {
              processedImages.push(img);
            }
          }
        } else {
          processedImages.push(img);
        }
      }
    }

    const feedback = await Feedback.create({
      userId,
      facilityId,
      sessionId: data.sessionId,
      type: data.type,
      description: data.description,
      images: processedImages,
      status: FeedbackStatus.SUBMITTED,
    });

    logger.info(`Feedback created: ${feedback._id} by user ${userId}, type: ${data.type}`);

    try {
      getIO().to(`facility:${facilityId}`).emit('feedback:created', {
        feedbackId: feedback._id,
        type: data.type,
        facilityId: facilityId,
        message: 'Có phản hồi sự cố mới từ khách hàng',
      });
    } catch (e) {}

    return feedback.populate([
      { path: 'userId', select: 'fullName email phone' },
      { path: 'sessionId', select: 'code licensePlate checkInTime' },
      { path: 'facilityId', select: 'name' }
    ]);
  }

  static async getFeedbacks(
    userId: string,
    role: string,
    query: any
  ): Promise<{ data: IFeedback[]; total: number; page: number; totalPages: number }> {
    const page = query?.page || 1;
    const limit = query?.limit || 10;
    const skip = (page - 1) * limit;

    const filter: any = {};

    if (role === 'driver') {
      filter.userId = userId;
    }

    if (query?.status) filter.status = query.status;
    if (query?.type) filter.type = query.type;
    if (query?.userId && role !== 'driver') filter.userId = query.userId;
    if (query?.facilityId) filter.facilityId = query.facilityId;

    const sortBy = query?.sortBy || 'createdAt';
    const sortOrder = query?.sortOrder === 'asc' ? 1 : -1;

    const [data, total] = await Promise.all([
      Feedback.find(filter)
        .populate('userId', 'fullName email phone')
        .populate('sessionId', 'code licensePlate checkInTime')
        .populate('facilityId', 'name')
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      Feedback.countDocuments(filter),
    ]);

    return {
      data: data as any[],
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  static async updateFeedbackStatus(
    feedbackId: string,
    managerId: string,
    data: { status: string; responseNote?: string }
  ): Promise<IFeedback> {
    const feedback = await Feedback.findById(feedbackId);
    if (!feedback) throw new AppError('Phản hồi không tồn tại', 404);

    if ([FeedbackStatus.RESOLVED, FeedbackStatus.REJECTED].includes(feedback.status as FeedbackStatus)) {
      throw new AppError('Phản hồi đã được xử lý, không thể thay đổi', 400);
    }

    feedback.status = data.status as FeedbackStatus;
    if (data.responseNote !== undefined) {
      feedback.responseNote = data.responseNote;
    }
    await feedback.save();

    logger.info(`Feedback ${feedbackId} updated to ${data.status} by manager ${managerId}`);

    return feedback.populate([
      { path: 'userId', select: 'fullName email phone' },
      { path: 'sessionId', select: 'code licensePlate checkInTime' },
      { path: 'facilityId', select: 'name' }
    ]);
  }

  static async getFeedbackById(feedbackId: string): Promise<IFeedback> {
    const feedback = await Feedback.findById(feedbackId)
      .populate('userId', 'fullName email phone')
      .populate('sessionId', 'code licensePlate checkInTime')
      .populate('facilityId', 'name');

    if (!feedback) throw new AppError('Phản hồi không tồn tại', 404);
    return feedback;
  }
}
