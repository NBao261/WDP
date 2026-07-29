import { Request, Response, NextFunction } from 'express';
import { SlotService } from '../services/slot.service';

export class SlotController {
  static async createSlot(req: Request, res: Response, next: NextFunction) {
    try {
      const slot = await SlotService.createSlot(req.body);
      res.status(201).json({ success: true, data: slot });
    } catch (error) {
      next(error);
    }
  }

  static async createBulkSlots(req: Request, res: Response, next: NextFunction) {
    try {
      const { facilityId, floorId, vehicleType, prefix, startNumber, count } = req.body;
      const slots = await SlotService.createBulkSlots(facilityId, floorId, vehicleType, prefix, startNumber, count);
      res.status(201).json({ success: true, data: slots });
    } catch (error) {
      next(error);
    }
  }

  static async updateSlot(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const slot = await SlotService.updateSlot(id, req.body);
      res.status(200).json({ success: true, data: slot });
    } catch (error) {
      next(error);
    }
  }

  static async updateSlotStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const { status, reason } = req.body;
      const userRole = req.user?.role;
      const slot = await SlotService.updateSlotStatus(id, status, reason, userRole);
      res.status(200).json({ success: true, data: slot });
    } catch (error) {
      next(error);
    }
  }

  static async deleteSlot(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      await SlotService.deleteSlot(id);
      res.status(200).json({ success: true, message: 'Slot deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async getSlotById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const slot = await SlotService.getSlotById(id);
      res.status(200).json({ success: true, data: slot });
    } catch (error) {
      next(error);
    }
  }

  static async getSlotsByFloor(req: Request, res: Response, next: NextFunction) {
    try {
      const floorId = req.params.floorId as string;
      const slots = await SlotService.getSlotsByFloor(floorId);
      res.status(200).json({ success: true, data: slots });
    } catch (error) {
      next(error);
    }
  }

  static async getSlotStats(req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await SlotService.getSlotStats();
      res.status(200).json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }
}
