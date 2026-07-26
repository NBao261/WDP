import cloudinary from '../config/cloudinary';
import fs from 'fs';
import path from 'path';
import { ParkingSession } from '../models/parkingSession.model';
import { Exception } from '../models/exception.model';

export class UploadService {
  /**
   * Background task: Xử lý gộp cả ảnh checkIn và checkOut
   * khi xe ra khỏi bãi (COMPLETED session).
   */
  static async processCompletedSessionImages(sessionId: string): Promise<void> {
    try {
      console.log(`[UploadService] Starting upload for session ${sessionId}`);
      if (!process.env.CLOUDINARY_CLOUD_NAME) {
        console.warn('[UploadService] CLOUDINARY_CLOUD_NAME not set, skipping upload');
        return;
      }

      const session = await ParkingSession.findById(sessionId);
      if (!session) return;

      let updatedFields: any = {};

      if (session.checkInImage && session.checkInImage.startsWith('/uploads/')) {
        const cloudUrl = await this._uploadAndDeleteLocal(session.checkInImage);
        if (cloudUrl) updatedFields.checkInImage = cloudUrl;
      }

      if (session.checkOutImage && session.checkOutImage.startsWith('/uploads/')) {
        const cloudUrl = await this._uploadAndDeleteLocal(session.checkOutImage);
        if (cloudUrl) updatedFields.checkOutImage = cloudUrl;
      }

      if (Object.keys(updatedFields).length > 0) {
        await ParkingSession.findByIdAndUpdate(sessionId, updatedFields);
        console.log(`[UploadService] [OK] Đã sync Cloudinary thành công cho session ${sessionId}`);
      }
    } catch (error) {
      console.error(`[UploadService] [FAIL] Sync background thất bại cho session ${sessionId}:`, error);
      throw error; // Throw so BullMQ can retry
    }
  }

  /**
   * Background task: Upload ảnh exception (checkInImage, checkOutImage) lên Cloudinary
   * Gọi khi tạo exception mới có ảnh local
   */
  static async processExceptionImages(exceptionId: string): Promise<void> {
    try {
      console.log(`[UploadService] Starting upload for exception ${exceptionId}`);
      if (!process.env.CLOUDINARY_CLOUD_NAME) {
        console.warn('[UploadService] CLOUDINARY_CLOUD_NAME not set, skipping exception upload');
        return;
      }

      const exception = await Exception.findById(exceptionId);
      if (!exception) return;

      let updatedFields: any = {};

      if (exception.checkInImage && exception.checkInImage.startsWith('/uploads/')) {
        const cloudUrl = await this._uploadAndDeleteLocal(exception.checkInImage);
        if (cloudUrl) updatedFields.checkInImage = cloudUrl;
      }

      if (exception.checkOutImage && exception.checkOutImage.startsWith('/uploads/')) {
        const cloudUrl = await this._uploadAndDeleteLocal(exception.checkOutImage);
        if (cloudUrl) updatedFields.checkOutImage = cloudUrl;
      }

      if (Object.keys(updatedFields).length > 0) {
        await Exception.findByIdAndUpdate(exceptionId, updatedFields);
        console.log(`[UploadService] [OK] Đã sync Cloudinary thành công cho exception ${exceptionId}`);
      }
    } catch (error) {
      console.error(`[UploadService] [FAIL] Sync background thất bại cho exception ${exceptionId}:`, error);
      throw error;
    }
  }

  private static async _uploadAndDeleteLocal(localUrl: string): Promise<string | null> {
    const filename = path.basename(localUrl);
    const relativePath = localUrl.startsWith('/') ? localUrl.substring(1) : localUrl;
    const localFilePath = path.join(__dirname, '../../public', relativePath);

    console.log(`[UploadService] Looking for file: ${localFilePath} (exists: ${fs.existsSync(localFilePath)})`);
    if (!fs.existsSync(localFilePath)) return null;

    try {
      const cloudinaryUrl = await new Promise<string>((resolve, reject) => {
        cloudinary.uploader.upload(
          localFilePath,
          { folder: 'smart_parking/alpr' },
          (error, result) => {
            if (error || !result) reject(error);
            else resolve(result.secure_url);
          }
        );
      });

      fs.unlinkSync(localFilePath);
      return cloudinaryUrl;
    } catch (err) {
      console.error(`[UploadService] Lỗi xử lý file ${filename}:`, err);
      throw err; // Throw so BullMQ can retry
    }
  }

  /**
   * Upload ảnh base64 trực tiếp lên Cloudinary.
   * Cloudinary hỗ trợ nhận chuỗi data URI (data:image/...;base64,...) natively.
   * @param base64String - chuỗi base64 hoặc data URI
   * @param folder - thư mục trên Cloudinary (default: 'smart_parking/vehicles')
   * @returns URL ảnh trên Cloudinary (secure_url)
   */
  static async uploadBase64Image(base64String: string, folder = 'smart_parking/vehicles'): Promise<string> {
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      console.warn('[UploadService] CLOUDINARY_CLOUD_NAME not set, keeping base64 as-is');
      return base64String;
    }

    // Đảm bảo chuỗi có prefix data URI
    let dataUri = base64String;
    if (!dataUri.startsWith('data:')) {
      dataUri = `data:image/jpeg;base64,${dataUri}`;
    }

    const result = await cloudinary.uploader.upload(dataUri, {
      folder,
      resource_type: 'image',
      transformation: [
        { width: 800, height: 600, crop: 'limit' }, // giới hạn kích thước tối đa
        { quality: 'auto', fetch_format: 'auto' },   // tự tối ưu chất lượng & format
      ],
    });

    console.log(`[UploadService] [OK] Uploaded vehicle image to Cloudinary: ${result.secure_url}`);
    return result.secure_url;
  }

  /**
   * Kiểm tra chuỗi có phải base64 / data URI không.
   */
  static isBase64Image(str: string): boolean {
    return str.startsWith('data:image/') || /^[A-Za-z0-9+/=]{100,}/.test(str);
  }
}
