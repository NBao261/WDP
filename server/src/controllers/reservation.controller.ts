import { Request, Response, NextFunction } from 'express';
import { ReservationService } from '../services/reservation.service';

export class ReservationController {
  /**
   * POST /reservations
   * FR-14.1: Tạo đặt chỗ trước (Driver only)
   */
  static async createReservation(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const reservation = await ReservationService.createReservation(userId, req.body);
      res.status(201).json({ success: true, data: reservation });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /reservations/:id/cancel
   * FR-14.2: Hủy đặt chỗ (Driver only)
   */
  static async cancelReservation(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const reservation = await ReservationService.cancelReservation(req.params.id as string, userId);
      res.status(200).json({ success: true, data: reservation });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /reservations
   * FR-14.2: Xem danh sách đặt chỗ
   * Driver: chỉ thấy của mình | Manager/Admin: thấy tất cả
   */
  static async getReservations(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const role = req.user!.role;
      const result = await ReservationService.getReservations(userId, role, req.query);
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
   * GET /reservations/:id
   * Xem chi tiết reservation
   */
  static async getReservationById(req: Request, res: Response, next: NextFunction) {
    try {
      const reservation = await ReservationService.getReservationById(req.params.id as string);
      res.status(200).json({ success: true, data: reservation });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /reservations/by-code/:code
   * Tra cứu reservation theo mã đặt chỗ — Staff quét QR hoặc nhập tay tại cổng
   */
  static async getByCode(req: Request, res: Response, next: NextFunction) {
    try {
      const reservation = await ReservationService.getByCode(req.params.code as string);
      res.status(200).json({ success: true, data: reservation });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /reservations/by-plate/:plate
   * Tra cứu reservation theo biển số — Staff dùng tự động khi ALPR quét biển số
   */
  static async getByPlate(req: Request, res: Response, next: NextFunction) {
    try {
      const plate = req.params.plate as string;
      const facilityId = req.query.facilityId as string;
      if (!facilityId) {
        return res.status(400).json({ success: false, message: 'facilityId is required' });
      }
      const reservation = await ReservationService.getByPlate(plate, facilityId);
      res.status(200).json({ success: true, data: reservation });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /reservations/auto-expire
   * BR-6.4: Trigger tự động hủy reservation quá hạn (Admin/Cron)
   */
  static async autoExpire(req: Request, res: Response, next: NextFunction) {
    try {
      const count = await ReservationService.autoExpireReservations();
      res.status(200).json({
        success: true,
        message: `Đã hủy ${count} đặt chỗ quá hạn.`,
        data: { count },
      });
    } catch (error) {
      next(error);
    }
  }
}
