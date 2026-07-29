import { Request, Response, NextFunction } from 'express';
import { VehicleService } from '../services/vehicle.service';

export class VehicleController {
  static async addVehicle(req: Request, res: Response, next: NextFunction) {
    try {
      const data = {
        ...req.body,
        userId: req.user!.userId,
      };
      const vehicle = await VehicleService.addVehicle(data);
      res.status(201).json({ success: true, data: vehicle });
    } catch (error) {
      next(error);
    }
  }

  static async getMyVehicles(req: Request, res: Response, next: NextFunction) {
    try {
      const vehicles = await VehicleService.getMyVehicles(req.user!.userId);
      res.status(200).json({ success: true, data: vehicles });
    } catch (error) {
      next(error);
    }
  }

  static async getVehicleById(req: Request, res: Response, next: NextFunction) {
    try {
      const vehicle = await VehicleService.getVehicleById(
        req.user!.userId,
        req.params.id as string
      );
      res.status(200).json({ success: true, data: vehicle });
    } catch (error) {
      next(error);
    }
  }

  static async updateVehicle(req: Request, res: Response, next: NextFunction) {
    try {
      const vehicle = await VehicleService.updateVehicle(
        req.user!.userId,
        req.params.id as string,
        req.body
      );
      res.status(200).json({ success: true, data: vehicle });
    } catch (error) {
      next(error);
    }
  }

  static async deleteVehicle(req: Request, res: Response, next: NextFunction) {
    try {
      await VehicleService.deleteVehicle(req.user!.userId, req.params.id as string);
      res.status(200).json({ success: true, message: 'Đã xoá xe thành công' });
    } catch (error) {
      next(error);
    }
  }
}
