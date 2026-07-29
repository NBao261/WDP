import { Request, Response, NextFunction } from 'express';
import { SessionService } from '../services/session.service';
import { User } from '../models/user.model';
import { AppError } from '../middlewares/error.middleware';
import { ParkingSession } from '../models/parkingSession.model';

export class SessionController {
  static async checkConditions(req: Request, res: Response, next: NextFunction) {
    try {
      const { facilityId, vehicleTypeId, licensePlate } = req.body;

      const staffUser = await User.findById(req.user!.userId).select('assignedFacilities');
      if (!staffUser) return next(new AppError('User not found', 404));

      const isAssigned = staffUser.assignedFacilities.some(
        (fId) => fId.toString() === facilityId
      );
      if (!isAssigned) {
        return next(new AppError('Bạn không được phân công tại bãi xe này', 403));
      }

      const result = await SessionService.checkConditions(facilityId, vehicleTypeId, licensePlate);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async checkIn(req: Request, res: Response, next: NextFunction) {
    try {
      const { facilityId, vehicleTypeId, licensePlate, gateIn, floorId, slotId, reservationCode, checkInImage, cardCode } = req.body;
      const staffInId = req.user!.userId;

      const session = await SessionService.checkIn({
        facilityId,
        vehicleTypeId,
        licensePlate,
        gateIn,
        staffInId,
        floorId,
        slotId,
        reservationCode,
        checkInImage,
        cardCode,
      });

      res.status(201).json({ success: true, data: session });
    } catch (error) {
      next(error);
    }
  }

  static async suggestFloors(req: Request, res: Response, next: NextFunction) {
    try {
      const { facilityId, vehicleTypeId } = req.query;
      const result = await SessionService.suggestFloors(
        facilityId as string,
        vehicleTypeId as string
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async getActiveSessions(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await SessionService.getActiveSessions(req.query);
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  static async getTodayTraffic(req: Request, res: Response, next: NextFunction) {
    try {
      const facilityId = req.query.facilityId as string;
      const result = await SessionService.getTodayTraffic(facilityId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async searchSession(req: Request, res: Response, next: NextFunction) {
    try {
      const { cardCode, licensePlate, code } = req.query;
      const session = await SessionService.searchSession({
        cardCode: cardCode as string,
        licensePlate: licensePlate as string,
        code: code as string,
      });

      const feeResult = await SessionService.calculateFee(session);
      const sessionData = typeof (session as any).toObject === 'function' ? (session as any).toObject() : session;
      
      res.status(200).json({ success: true, data: { ...sessionData, feeResult } });
    } catch (error) {
      next(error);
    }
  }

  static async calculateFee(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const session = await ParkingSession.findById(id).select('facilityId status');
      if (!session) return next(new AppError('Session không tồn tại', 404));

      const staffUser = await User.findById(req.user!.userId).select('assignedFacilities role');
      if (!staffUser) return next(new AppError('User not found', 404));
      
      if (staffUser.role !== 'admin' && staffUser.role !== 'manager') {
        const isAssigned = staffUser.assignedFacilities.some(
          (fId) => fId.toString() === session.facilityId.toString()
        );
        if (!isAssigned) {
          return next(new AppError('Bạn không được phân công tại bãi xe này', 403));
        }
      }

      const result = await SessionService.calculateFee(id as string);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async checkOut(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { gateOut, checkOutImage } = req.body;
      const staffOutId = req.user!.userId;

      const session = await SessionService.checkOut({
        sessionId: id as string,
        gateOut: gateOut as string,
        staffOutId: staffOutId as string,
        checkOutImage: checkOutImage as string,
      });

      res.status(200).json({ success: true, data: session });
    } catch (error) {
      next(error);
    }
  }

  static async getMySessions(req: Request, res: Response, next: NextFunction) {
    try {
      const driverId = req.user!.userId;
      const result = await SessionService.getMySessions(driverId, req.query);
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }
}


