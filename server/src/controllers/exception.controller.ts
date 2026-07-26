import { Request, Response, NextFunction } from 'express';
import { ExceptionService } from '../services/exception.service';

export class ExceptionController {
  /**
   * Thêm ngoại lệ mới (Staff)
   */
  static async createException(req: Request, res: Response, next: NextFunction) {
    try {
      const data = {
        ...req.body,
        staffId: req.user?.userId,
      };
      const exception = await ExceptionService.createException(data);
      res.status(201).json({ success: true, data: exception });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Lấy chi tiết một sự cố theo ID (bao gồm images)
   */
  static async getExceptionById(req: Request, res: Response, next: NextFunction) {
    try {
      const exception = await ExceptionService.getExceptionById(req.params.id as string);
      res.status(200).json({ success: true, data: exception });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Lấy danh sách ngoại lệ
   */
  static async getExceptions(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ExceptionService.getExceptions(req.query, req.user!);
      res.status(200).json({
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          page: result.page,
          totalPages: result.totalPages,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Staff xử lý ngoại lệ
   */
  static async resolveException(req: Request, res: Response, next: NextFunction) {
    try {
      const exceptionId = req.params.id as string;
      const data = {
        ...req.body,
        staffId: req.user?.userId,
      };

      const exception = await ExceptionService.resolveException(exceptionId, data);
      res.status(200).json({ success: true, data: exception });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Manager review + thêm ghi chú
   */
  static async addManagerReview(req: Request, res: Response, next: NextFunction) {
    try {
      const exceptionId = req.params.id as string;
      const data = {
        managerNote: req.body.managerNote,
        managerId: req.user!.userId,
      };

      const exception = await ExceptionService.addManagerReview(exceptionId, data);
      res.status(200).json({ success: true, data: exception });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Kích hoạt quét tự động xe quá hạn (System/Cron/Admin)
   */
  static async detectOverdue(req: Request, res: Response, next: NextFunction) {
    try {
      const count = await ExceptionService.detectOverdueSessions();
      res.status(200).json({
        success: true,
        message: `Đã quét và phát hiện ${count} lượt gửi xe quá hạn.`,
        data: { count },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Driver tạo báo cáo sự cố (phản hồi)
   */
  static async createDriverReport(req: Request, res: Response, next: NextFunction) {
    try {
      const data = {
        ...req.body,
        driverId: req.user?.userId,
      };
      const exception = await ExceptionService.createDriverReport(data);
      res.status(201).json({ success: true, data: exception });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Driver lấy danh sách báo cáo của mình
   */
  static async getMyReports(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ExceptionService.getDriverReports(req.user!.userId, req.query);
      res.status(200).json({
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          page: result.page,
          totalPages: result.totalPages,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
