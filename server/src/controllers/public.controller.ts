import { Request, Response, NextFunction } from 'express';
import { PublicService } from '../services/public.service';

export class PublicController {
  static async getPublicFacilities(req: Request, res: Response, next: NextFunction) {
    try {
      const { page = 1, limit = 10, search, status, vehicleTypeId } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const filters: any = {};
      if (search) {
        filters.$or = [
          { name: { $regex: search, $options: 'i' } },
          { address: { $regex: search, $options: 'i' } }
        ];
      }
      if (status) {
        filters.status = status;
      }
      if (vehicleTypeId) {
        filters.vehicleTypeId = vehicleTypeId;
      }

      const { facilities, total } = await PublicService.getPublicFacilities(filters, skip, Number(limit));
      res.status(200).json({
        success: true,
        data: facilities,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getPublicPricing(req: Request, res: Response, next: NextFunction) {
    try {
      const facilityId = req.params.facilityId as string;
      const pricing = await PublicService.getPublicPricing(facilityId);
      res.status(200).json({ success: true, data: pricing });
    } catch (error) {
      next(error);
    }
  }

  static async getAvailableSlots(req: Request, res: Response, next: NextFunction) {
    try {
      const facilityId = req.params.facilityId as string;
      const slots = await PublicService.getAvailableSlots(facilityId);
      res.status(200).json({ success: true, data: slots });
    } catch (error) {
      next(error);
    }
  }

  static async getPublicFacilityById(req: Request, res: Response, next: NextFunction) {
    try {
      const facilityId = req.params.facilityId as string;
      const facility = await PublicService.getPublicFacilityById(facilityId);
      res.status(200).json({ success: true, data: facility });
    } catch (error) {
      next(error);
    }
  }
}
