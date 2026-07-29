import { Request, Response, NextFunction } from 'express';
import { ReportService } from '../services/report.service';
import { ExportService } from '../services/export.service';
import { AppError } from '../middlewares/error.middleware';
import { UserRole } from '../models/user.model';
import { ParkingFacility } from '../models/parkingFacility.model';
export class ReportController {
  private static async resolveManagerFacilityScope(
    req: Request,
    requestedFacilityId?: string
  ): Promise<{ facilityId?: string; facilityIds?: string[] }> {
    const user = req.user!;

    if (user.role === UserRole.ADMIN) {
      return { facilityId: requestedFacilityId };
    }

    const assignedFacilities = await ParkingFacility.find(
      { assignedUsers: user.userId, isDeleted: false },
      { _id: 1 }
    ).lean();

    const allowedIds = assignedFacilities.map((f) => f._id.toString());

    if (allowedIds.length === 0) {
      throw new AppError('Bạn chưa được gán quản lý toà nhà nào', 403);
    }

    if (requestedFacilityId) {
      if (!allowedIds.includes(requestedFacilityId)) {
        throw new AppError('Bạn không có quyền xem báo cáo của toà nhà này', 403);
      }
      return { facilityId: requestedFacilityId };
    }

    return { facilityIds: allowedIds };
  }

  static async getTrafficReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { facilityId, floorId, vehicleTypeId, startDate, endDate, groupBy } = req.query;

      const scope = await ReportController.resolveManagerFacilityScope(req, facilityId as string);

      const result = await ReportService.getTrafficReport({
        ...scope,
        floorId: floorId as string,
        vehicleTypeId: vehicleTypeId as string,
        startDate: startDate as string,
        endDate: endDate as string,
        groupBy: groupBy as 'day' | 'week' | 'month',
      });

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async getRevenueReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { facilityId, vehicleTypeId, paymentMethod, startDate, endDate, groupBy } = req.query;

      const scope = await ReportController.resolveManagerFacilityScope(req, facilityId as string);

      const result = await ReportService.getRevenueReport({
        ...scope,
        vehicleTypeId: vehicleTypeId as string,
        paymentMethod: paymentMethod as string,
        startDate: startDate as string,
        endDate: endDate as string,
        groupBy: groupBy as 'day' | 'week' | 'month',
      });

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async getOccupancyReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { facilityId, vehicleTypeId } = req.query;

      const scope = await ReportController.resolveManagerFacilityScope(req, facilityId as string);

      const result = await ReportService.getOccupancyReport({
        ...scope,
        vehicleTypeId: vehicleTypeId as string,
      });

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async getPeakHoursReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { facilityId, vehicleTypeId, startDate, endDate } = req.query;

      const scope = await ReportController.resolveManagerFacilityScope(req, facilityId as string);

      const result = await ReportService.getPeakHoursReport({
        ...scope,
        vehicleTypeId: vehicleTypeId as string,
        startDate: startDate as string,
        endDate: endDate as string,
      });

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async getOccupancyHeatmap(req: Request, res: Response, next: NextFunction) {
    try {
      const { facilityId, vehicleTypeId } = req.query;

      const scope = await ReportController.resolveManagerFacilityScope(req, facilityId as string);

      const result = await ReportService.getOccupancyHeatmap({
        ...scope,
        vehicleTypeId: vehicleTypeId as string,
      });

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async exportReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { reportType, format, facilityId, ...otherFilters } = req.query;
      
      if (!reportType || !['traffic', 'revenue', 'occupancy', 'peak-hours', 'comprehensive'].includes(reportType as string)) {
        throw new AppError('Loại báo cáo không hợp lệ (traffic, revenue, occupancy, peak-hours, comprehensive)', 400);
      }
      if (!format || !['excel', 'pdf'].includes(format as string)) {
        throw new AppError('Định dạng xuất không hợp lệ (excel, pdf)', 400);
      }

      const scope = await ReportController.resolveManagerFacilityScope(req, facilityId as string);
      const filters = { ...otherFilters, ...scope };

      let buffer: Buffer;

      if (reportType === 'comprehensive') {
        const [trafficData, revenueData, occupancyData, peakHoursData] = await Promise.all([
          ReportService.getTrafficReport(filters),
          ReportService.getRevenueReport(filters),
          ReportService.getOccupancyReport(filters),
          ReportService.getPeakHoursReport(filters),
        ]);

        buffer = await ExportService.generateComprehensiveReport(format as string, {
          revenue: revenueData,
          traffic: trafficData,
          occupancy: occupancyData,
          peakHours: peakHoursData,
        });
      } else {
        let data;
        switch (reportType) {
          case 'traffic': 
            data = await ReportService.getTrafficReport(filters); 
            break;
          case 'revenue': 
            data = await ReportService.getRevenueReport(filters); 
            break;
          case 'occupancy': 
            data = await ReportService.getOccupancyReport(filters); 
            break;
          case 'peak-hours': 
            data = await ReportService.getPeakHoursReport(filters); 
            break;
        }
        buffer = await ExportService.generateReport(reportType as string, format as string, data);
      }

      const contentType = format === 'excel' 
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/pdf';
      const extension = format === 'excel' ? 'xlsx' : 'pdf';
      const filename = `report_${reportType}_${new Date().getTime()}.${extension}`;

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  }
}
