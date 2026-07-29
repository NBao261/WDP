import { Request, Response, NextFunction } from 'express';
import { FacilityService } from '../services/facility.service';

export class FacilityController {
  static async createFacility(req: Request, res: Response, next: NextFunction) {
    try {
      const { latitude, longitude, ...rest } = req.body;

      const hasValidCoords =
        typeof latitude === 'number' && typeof longitude === 'number' &&
        !isNaN(latitude) && !isNaN(longitude);

      const data = {
        ...rest,
        location: {
          type: 'Point' as const,
          coordinates: hasValidCoords
            ? [longitude, latitude] as [number, number]
            : [0, 0] as [number, number],
        },
      };

      const facility = await FacilityService.createFacility(data);
      res.status(201).json({ success: true, data: facility });
    } catch (error) {
      next(error);
    }
  }

  static async updateFacility(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const { latitude, longitude, ...rest } = req.body;
      const data: any = { ...rest };
      if (latitude !== undefined && longitude !== undefined) {
        data.location = {
          type: 'Point',
          coordinates: [longitude, latitude],
        };
      }
      const facility = await FacilityService.updateFacility(id, data);
      res.status(200).json({ success: true, data: facility });
    } catch (error) {
      next(error);
    }
  }

  static async deactivateFacility(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const facility = await FacilityService.deactivateFacility(id);
      res.status(200).json({ success: true, data: facility });
    } catch (error) {
      next(error);
    }
  }

  static async softDeleteFacility(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const facility = await FacilityService.softDeleteFacility(id);
      res.status(200).json({ success: true, message: 'Facility đã được xoá', data: facility });
    } catch (error) {
      next(error);
    }
  }

  static async getFacilityById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const facility = await FacilityService.getFacilityById(id);
      res.status(200).json({ success: true, data: facility });
    } catch (error) {
      next(error);
    }
  }

  static async getAllFacilities(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, page = 1, limit = 10 } = req.query;
      const skip = (Number(page) - 1) * Number(limit);
      const filters: any = { isDeleted: false };
      if (status) filters.status = status;

      const { facilities, total } = await FacilityService.getAllFacilities(filters, skip, Number(limit));
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

  static async getOperationsConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const config = await FacilityService.getOperationsConfig(id);
      res.status(200).json({ success: true, data: config });
    } catch (error) {
      next(error);
    }
  }
}
