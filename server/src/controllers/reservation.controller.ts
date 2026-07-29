import { Request, Response, NextFunction } from 'express';
import { ReservationService } from '../services/reservation.service';

export class ReservationController {
  static async createReservation(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const reservation = await ReservationService.createReservation(userId, req.body);
      res.status(201).json({ success: true, data: reservation });
    } catch (error) {
      next(error);
    }
  }

  static async cancelReservation(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const reservation = await ReservationService.cancelReservation(req.params.id as string, userId);
      res.status(200).json({ success: true, data: reservation });
    } catch (error) {
      next(error);
    }
  }

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

  static async getReservationById(req: Request, res: Response, next: NextFunction) {
    try {
      const reservation = await ReservationService.getReservationById(req.params.id as string);
      res.status(200).json({ success: true, data: reservation });
    } catch (error) {
      next(error);
    }
  }

  static async getByCode(req: Request, res: Response, next: NextFunction) {
    try {
      const reservation = await ReservationService.getByCode(req.params.code as string);
      res.status(200).json({ success: true, data: reservation });
    } catch (error) {
      next(error);
    }
  }

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
