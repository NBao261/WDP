import mongoose from 'mongoose';
import { ParkingSession } from '../models/parkingSession.model';
import { Payment } from '../models/payment.model';
import { ParkingSlot, SlotStatus } from '../models/parkingSlot.model';
import { Floor } from '../models/floor.model';
import { AppError } from '../middlewares/error.middleware';
import { getCache, setCache } from '../config/redis';

// ─── Định nghĩa kiểu dữ liệu đầu vào ────────────────

interface DateRangeFilter {
  facilityId?: string;
  facilityIds?: string[];
  floorId?: string;
  vehicleTypeId?: string;
  startDate?: string;
  endDate?: string;
  groupBy?: 'day' | 'week' | 'month';
}

interface RevenueFilter {
  facilityId?: string;
  facilityIds?: string[];
  vehicleTypeId?: string;
  paymentMethod?: string;
  startDate?: string;
  endDate?: string;
  groupBy?: 'day' | 'week' | 'month';
}

interface OccupancyFilter {
  facilityId?: string;
  facilityIds?: string[];
  vehicleTypeId?: string;
}

interface PeakHoursFilter {
  facilityId?: string;
  facilityIds?: string[];
  vehicleTypeId?: string;
  startDate?: string;
  endDate?: string;
}

function buildDateMatch(startDate?: string, endDate?: string, dateField = 'checkInTime') {
  const match: any = {};
  if (startDate || endDate) {
    match[dateField] = {};
    if (startDate) match[dateField].$gte = new Date(startDate);
    if (endDate) match[dateField].$lte = new Date(endDate);
  }
  return match;
}

function getDateGroupExpression(groupBy: string, dateField = '$checkInTime') {
  switch (groupBy) {
    case 'week':
      return {
        year: { $isoWeekYear: dateField },
        week: { $isoWeek: dateField },
      };
    case 'month':
      return {
        year: { $year: dateField },
        month: { $month: dateField },
      };
    case 'day':
    default:
      return {
        year: { $year: dateField },
        month: { $month: dateField },
        day: { $dayOfMonth: dateField },
      };
  }
}

function formatGroupLabel(group: any, groupBy: string): string {
  switch (groupBy) {
    case 'week':
      return `${group.year}-W${String(group.week).padStart(2, '0')}`;
    case 'month':
      return `${group.year}-${String(group.month).padStart(2, '0')}`;
    case 'day':
    default:
      return `${group.year}-${String(group.month).padStart(2, '0')}-${String(group.day).padStart(2, '0')}`;
  }
}

export class ReportService {
  static async getTrafficReport(filters: DateRangeFilter) {
    const cacheKey = `report:traffic:${Buffer.from(JSON.stringify(filters)).toString('base64')}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    const { facilityId, facilityIds, floorId, vehicleTypeId, startDate, endDate, groupBy = 'day' } = filters;

    const matchStage: any = {};
    if (facilityId) matchStage.facilityId = new mongoose.Types.ObjectId(facilityId);
    else if (facilityIds && facilityIds.length > 0) matchStage.facilityId = { $in: facilityIds.map(id => new mongoose.Types.ObjectId(id)) };
    if (floorId) matchStage.floorId = new mongoose.Types.ObjectId(floorId);
    if (vehicleTypeId) matchStage.vehicleTypeId = new mongoose.Types.ObjectId(vehicleTypeId);

    const dateMatch = buildDateMatch(startDate, endDate, 'checkInTime');
    Object.assign(matchStage, dateMatch);

    const dateGroupExpr = getDateGroupExpression(groupBy, '$checkInTime');

    const checkInAgg = await ParkingSession.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: dateGroupExpr,
          checkInCount: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.week': 1 } },
    ]);

    const checkOutMatchStage: any = { ...matchStage };
    delete checkOutMatchStage.checkInTime;
    if (startDate || endDate) {
      checkOutMatchStage.checkOutTime = {};
      if (startDate) checkOutMatchStage.checkOutTime.$gte = new Date(startDate);
      if (endDate) checkOutMatchStage.checkOutTime.$lte = new Date(endDate);
    }
    checkOutMatchStage.checkOutTime = checkOutMatchStage.checkOutTime || { $ne: null };

    const checkOutDateGroupExpr = getDateGroupExpression(groupBy, '$checkOutTime');

    const checkOutAgg = await ParkingSession.aggregate([
      { $match: checkOutMatchStage },
      {
        $group: {
          _id: checkOutDateGroupExpr,
          checkOutCount: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.week': 1 } },
    ]);

    const mergedMap = new Map<string, { label: string; checkIn: number; checkOut: number }>();

    for (const item of checkInAgg) {
      const label = formatGroupLabel(item._id, groupBy);
      mergedMap.set(label, { label, checkIn: item.checkInCount, checkOut: 0 });
    }

    for (const item of checkOutAgg) {
      const label = formatGroupLabel(item._id, groupBy);
      const existing = mergedMap.get(label);
      if (existing) {
        existing.checkOut = item.checkOutCount;
      } else {
        mergedMap.set(label, { label, checkIn: 0, checkOut: item.checkOutCount });
      }
    }

    const data = Array.from(mergedMap.values()).sort((a, b) => a.label.localeCompare(b.label));

    const totalCheckIn = data.reduce((sum, d) => sum + d.checkIn, 0);
    const totalCheckOut = data.reduce((sum, d) => sum + d.checkOut, 0);

    const result = {
      groupBy,
      summary: {
        totalCheckIn,
        totalCheckOut,
        currentlyParked: totalCheckIn - totalCheckOut,
      },
      data,
    };

    await setCache(cacheKey, result, 600);
    return result;
  }

  static async getRevenueReport(filters: RevenueFilter) {
    const cacheKey = `report:revenue:${Buffer.from(JSON.stringify(filters)).toString('base64')}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    const { facilityId, facilityIds, vehicleTypeId, paymentMethod, startDate, endDate, groupBy = 'day' } = filters;

    const pipeline: any[] = [];

    const paymentMatch: any = { status: 'completed' };
    const dateMatch = buildDateMatch(startDate, endDate, 'createdAt');
    Object.assign(paymentMatch, dateMatch);
    if (paymentMethod) paymentMatch.method = paymentMethod;

    pipeline.push({ $match: paymentMatch });

    pipeline.push({
      $lookup: {
        from: 'parkingsessions',
        localField: 'sessionId',
        foreignField: '_id',
        as: 'session',
      },
    });
    pipeline.push({ $unwind: '$session' });

    if (facilityId || facilityIds || vehicleTypeId) {
      const sessionMatch: any = {};
      if (facilityId) sessionMatch['session.facilityId'] = new mongoose.Types.ObjectId(facilityId);
      else if (facilityIds && facilityIds.length > 0) sessionMatch['session.facilityId'] = { $in: facilityIds.map(id => new mongoose.Types.ObjectId(id)) };
      if (vehicleTypeId) sessionMatch['session.vehicleTypeId'] = new mongoose.Types.ObjectId(vehicleTypeId);
      pipeline.push({ $match: sessionMatch });
    }

    const dateGroupExpr = getDateGroupExpression(groupBy, '$createdAt');

    pipeline.push({
      $group: {
        _id: dateGroupExpr,
        totalRevenue: { $sum: '$amount' },
        transactionCount: { $sum: 1 },
        avgRevenue: { $avg: '$amount' },
      },
    });

    pipeline.push({ $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.week': 1 } });

    const timeData = await Payment.aggregate(pipeline);

    const data = timeData.map((item) => ({
      label: formatGroupLabel(item._id, groupBy),
      totalRevenue: Math.round(item.totalRevenue),
      transactionCount: item.transactionCount,
      avgRevenue: Math.round(item.avgRevenue),
    }));

    const methodPipeline: any[] = [
      { $match: paymentMatch },
      {
        $lookup: {
          from: 'parkingsessions',
          localField: 'sessionId',
          foreignField: '_id',
          as: 'session',
        },
      },
      { $unwind: '$session' },
    ];

    if (facilityId || facilityIds || vehicleTypeId) {
      const sessionMatch: any = {};
      if (facilityId) sessionMatch['session.facilityId'] = new mongoose.Types.ObjectId(facilityId);
      else if (facilityIds && facilityIds.length > 0) sessionMatch['session.facilityId'] = { $in: facilityIds.map(id => new mongoose.Types.ObjectId(id)) };
      if (vehicleTypeId) sessionMatch['session.vehicleTypeId'] = new mongoose.Types.ObjectId(vehicleTypeId);
      methodPipeline.push({ $match: sessionMatch });
    }

    methodPipeline.push({
      $group: {
        _id: '$method',
        totalRevenue: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    });

    const byMethod = await Payment.aggregate(methodPipeline);

    const vehicleTypePipeline: any[] = [
      { $match: paymentMatch },
      {
        $lookup: {
          from: 'parkingsessions',
          localField: 'sessionId',
          foreignField: '_id',
          as: 'session',
        },
      },
      { $unwind: '$session' },
    ];

    if (facilityId) {
      vehicleTypePipeline.push({
        $match: { 'session.facilityId': new mongoose.Types.ObjectId(facilityId) },
      });
    } else if (facilityIds && facilityIds.length > 0) {
      vehicleTypePipeline.push({
        $match: { 'session.facilityId': { $in: facilityIds.map(id => new mongoose.Types.ObjectId(id)) } },
      });
    }

    vehicleTypePipeline.push(
      {
        $lookup: {
          from: 'vehicletypes',
          localField: 'session.vehicleTypeId',
          foreignField: '_id',
          as: 'vehicleType',
        },
      },
      { $unwind: '$vehicleType' },
      {
        $group: {
          _id: { vehicleTypeId: '$session.vehicleTypeId', vehicleTypeName: '$vehicleType.name' },
          totalRevenue: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      }
    );

    const byVehicleType = await Payment.aggregate(vehicleTypePipeline);

    const grandTotal = data.reduce((sum, d) => sum + d.totalRevenue, 0);
    const totalTransactions = data.reduce((sum, d) => sum + d.transactionCount, 0);

    let totalPeriods = 1;
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end   = new Date(endDate);
      if (groupBy === 'month') {
        totalPeriods = Math.max(
          1,
          (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1
        );
      } else if (groupBy === 'week') {
        const diffMs = end.getTime() - start.getTime();
        totalPeriods = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 7)));
      } else {
        const diffMs = end.getTime() - start.getTime();
        totalPeriods = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);
      }
    }

    const avgRevenuePeriod = Math.round(grandTotal / totalPeriods);
    const periodLabel = groupBy === 'month' ? 'tháng' : groupBy === 'week' ? 'tuần' : 'ngày';

    const result = {
      groupBy,
      summary: {
        grandTotal,
        totalTransactions,
        avgRevenuePerDay: avgRevenuePeriod,
        avgRevenuePeriod,
        periodLabel,
      },
      byTimePeriod: data,
      byMethod: byMethod.map((m) => ({
        method: m._id,
        totalRevenue: Math.round(m.totalRevenue),
        count: m.count,
      })),
      byVehicleType: byVehicleType.map((v) => ({
        vehicleTypeId: v._id.vehicleTypeId,
        vehicleTypeName: v._id.vehicleTypeName,
        totalRevenue: Math.round(v.totalRevenue),
        count: v.count,
      })),
    };

    await setCache(cacheKey, result, 600);
    return result;
  }

  static async getOccupancyReport(filters: OccupancyFilter) {
    const cacheKey = `report:occupancy:${Buffer.from(JSON.stringify(filters)).toString('base64')}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    const { facilityId, facilityIds, vehicleTypeId } = filters;

    const slotMatch: any = { isDeleted: false };
    if (facilityId) slotMatch.facilityId = new mongoose.Types.ObjectId(facilityId);
    else if (facilityIds && facilityIds.length > 0) slotMatch.facilityId = { $in: facilityIds.map(id => new mongoose.Types.ObjectId(id)) };
    if (vehicleTypeId) slotMatch.vehicleTypeId = new mongoose.Types.ObjectId(vehicleTypeId);

    const pipeline: any[] = [
      { $match: slotMatch },
      {
        $group: {
          _id: { floorId: '$floorId', facilityId: '$facilityId' },
          total: { $sum: 1 },
          occupied: {
            $sum: { $cond: [{ $eq: ['$status', SlotStatus.OCCUPIED] }, 1, 0] },
          },
          reserved: {
            $sum: { $cond: [{ $eq: ['$status', SlotStatus.RESERVED] }, 1, 0] },
          },
          available: {
            $sum: { $cond: [{ $eq: ['$status', SlotStatus.AVAILABLE] }, 1, 0] },
          },
          maintenance: {
            $sum: { $cond: [{ $eq: ['$status', SlotStatus.MAINTENANCE] }, 1, 0] },
          },
          locked: {
            $sum: { $cond: [{ $eq: ['$status', SlotStatus.LOCKED] }, 1, 0] },
          },
        },
      },
      {
        $lookup: {
          from: 'floors',
          localField: '_id.floorId',
          foreignField: '_id',
          as: 'floor',
        },
      },
      { $unwind: '$floor' },
      {
        $lookup: {
          from: 'parkingfacilities',
          localField: '_id.facilityId',
          foreignField: '_id',
          as: 'facility',
        },
      },
      { $unwind: '$facility' },
      {
        $project: {
          _id: 0,
          floorId: '$_id.floorId',
          floorName: '$floor.name',
          facilityId: '$_id.facilityId',
          facilityName: '$facility.name',
          total: 1,
          occupied: 1,
          reserved: 1,
          available: 1,
          maintenance: 1,
          locked: 1,
          occupancyRate: {
            $cond: [
              { $gt: ['$total', 0] },
              { $round: [{ $multiply: [{ $divide: ['$occupied', '$total'] }, 100] }, 2] },
              0,
            ],
          },
          effectiveOccupancy: {
            $cond: [
              { $gt: ['$total', 0] },
              {
                $round: [
                  {
                    $multiply: [
                      { $divide: [{ $add: ['$occupied', '$reserved'] }, '$total'] },
                      100,
                    ],
                  },
                  2,
                ],
              },
              0,
            ],
          },
        },
      },
      { $sort: { facilityName: 1, floorName: 1 } },
    ];

    const floors = await ParkingSlot.aggregate(pipeline);

    const totalSlots = floors.reduce((sum, f) => sum + f.total, 0);
    const totalOccupied = floors.reduce((sum, f) => sum + f.occupied, 0);
    const totalReserved = floors.reduce((sum, f) => sum + f.reserved, 0);
    const totalAvailable = floors.reduce((sum, f) => sum + f.available, 0);
    const totalMaintenance = floors.reduce((sum, f) => sum + f.maintenance, 0);
    const totalLocked = floors.reduce((sum, f) => sum + f.locked, 0);
    const overallOccupancyRate = totalSlots > 0 ? (totalOccupied / totalSlots) * 100 : 0;
    const overallEffectiveOccupancy = totalSlots > 0 ? ((totalOccupied + totalReserved) / totalSlots) * 100 : 0;

    const result = {
      summary: {
        totalSlots,
        totalOccupied,
        totalAvailable,
        totalReserved,
        totalMaintenance,
        totalLocked,
        overallOccupancyRate: Number(overallOccupancyRate.toFixed(2)),
        overallEffectiveOccupancy: Number(overallEffectiveOccupancy.toFixed(2)),
      },
      byFloor: floors,
    };

    await setCache(cacheKey, result, 60);
    return result;
  }

  static async getPeakHoursReport(filters: PeakHoursFilter) {
    const cacheKey = `report:peak:${Buffer.from(JSON.stringify(filters)).toString('base64')}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    const { facilityId, facilityIds, vehicleTypeId, startDate, endDate } = filters;

    const matchStage: any = {};
    if (facilityId) matchStage.facilityId = new mongoose.Types.ObjectId(facilityId);
    else if (facilityIds && facilityIds.length > 0) matchStage.facilityId = { $in: facilityIds.map(id => new mongoose.Types.ObjectId(id)) };
    if (vehicleTypeId) matchStage.vehicleTypeId = new mongoose.Types.ObjectId(vehicleTypeId);

    const dateMatch = buildDateMatch(startDate, endDate, 'checkInTime');
    Object.assign(matchStage, dateMatch);

    const checkInByHour = await ParkingSession.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { hour: { $hour: '$checkInTime' } },
          checkInCount: { $sum: 1 },
        },
      },
      { $sort: { '_id.hour': 1 } },
    ]);

    const checkOutMatchStage: any = { ...matchStage };
    delete checkOutMatchStage.checkInTime;
    checkOutMatchStage.checkOutTime = { $ne: null };
    if (startDate || endDate) {
      checkOutMatchStage.checkOutTime = { $ne: null };
      if (startDate) checkOutMatchStage.checkOutTime.$gte = new Date(startDate);
      if (endDate) checkOutMatchStage.checkOutTime.$lte = new Date(endDate);
    }

    const checkOutByHour = await ParkingSession.aggregate([
      { $match: checkOutMatchStage },
      {
        $group: {
          _id: { hour: { $hour: '$checkOutTime' } },
          checkOutCount: { $sum: 1 },
        },
      },
      { $sort: { '_id.hour': 1 } },
    ]);

    const hourlyData = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      label: `${String(i).padStart(2, '0')}:00 - ${String(i).padStart(2, '0')}:59`,
      checkIn: 0,
      checkOut: 0,
      totalActivity: 0,
    }));

    for (const item of checkInByHour) {
      hourlyData[item._id.hour].checkIn = item.checkInCount;
    }

    for (const item of checkOutByHour) {
      hourlyData[item._id.hour].checkOut = item.checkOutCount;
    }

    for (const h of hourlyData) {
      h.totalActivity = h.checkIn + h.checkOut;
    }

    const sorted = [...hourlyData].sort((a, b) => b.totalActivity - a.totalActivity);
    const peakHours = sorted.slice(0, 3).map((h) => ({
      hour: h.hour,
      label: h.label,
      totalActivity: h.totalActivity,
      checkIn: h.checkIn,
      checkOut: h.checkOut,
    }));

    const totalActivity = hourlyData.reduce((sum, h) => sum + h.totalActivity, 0);
    const avgActivityPerHour = totalActivity / 24;

    const result = {
      summary: {
        totalActivity,
        avgActivityPerHour: Math.round(avgActivityPerHour * 100) / 100,
        peakHours,
      },
      hourlyDistribution: hourlyData,
    };

    await setCache(cacheKey, result, 300);
    return result;
  }

  private static MFD_OPTIMAL_OCCUPANCY: Record<string, number> = {
    small: 85,
    medium: 75,
    large: 70,
  };

  private static MFD_DEFAULT_OPTIMAL = 75;

  private static classifyMFDRegime(
    effectiveOccupancyPct: number,
    optimalOccupancyPct: number
  ): 'free-flow' | 'capacity' | 'congested' {
    if (effectiveOccupancyPct > optimalOccupancyPct) return 'congested';
    if (effectiveOccupancyPct >= optimalOccupancyPct * 0.85) return 'capacity';
    return 'free-flow';
  }

  static async getOccupancyHeatmap(filters: OccupancyFilter) {
    const { facilityId, facilityIds, vehicleTypeId } = filters;

    const slotMatch: any = { isDeleted: false };
    if (facilityId) slotMatch.facilityId = new mongoose.Types.ObjectId(facilityId);
    else if (facilityIds && facilityIds.length > 0) slotMatch.facilityId = { $in: facilityIds.map(id => new mongoose.Types.ObjectId(id)) };
    if (vehicleTypeId) slotMatch.vehicleTypeId = new mongoose.Types.ObjectId(vehicleTypeId);

    const pipeline: any[] = [
      { $match: slotMatch },
      {
        $group: {
          _id: { floorId: '$floorId', vehicleTypeId: '$vehicleTypeId', facilityId: '$facilityId' },
          total: { $sum: 1 },
          occupied: {
            $sum: { $cond: [{ $eq: ['$status', SlotStatus.OCCUPIED] }, 1, 0] },
          },
          reserved: {
            $sum: { $cond: [{ $eq: ['$status', SlotStatus.RESERVED] }, 1, 0] },
          },
          available: {
            $sum: { $cond: [{ $eq: ['$status', SlotStatus.AVAILABLE] }, 1, 0] },
          },
          maintenance: {
            $sum: { $cond: [{ $eq: ['$status', SlotStatus.MAINTENANCE] }, 1, 0] },
          },
          locked: {
            $sum: { $cond: [{ $eq: ['$status', SlotStatus.LOCKED] }, 1, 0] },
          },
        },
      },
      {
        $lookup: {
          from: 'floors',
          localField: '_id.floorId',
          foreignField: '_id',
          as: 'floor',
        },
      },
      { $unwind: '$floor' },
      {
        $lookup: {
          from: 'parkingfacilities',
          localField: '_id.facilityId',
          foreignField: '_id',
          as: 'facility',
        },
      },
      { $unwind: '$facility' },
      {
        $lookup: {
          from: 'vehicletypes',
          localField: '_id.vehicleTypeId',
          foreignField: '_id',
          as: 'vehicleType',
        },
      },
      { $unwind: '$vehicleType' },
      {
        $project: {
          _id: 0,
          floorId: '$_id.floorId',
          floorName: '$floor.name',
          vehicleTypeId: '$_id.vehicleTypeId',
          vehicleTypeName: '$vehicleType.name',
          vehicleTypeCode: '$vehicleType.code',
          facilityId: '$_id.facilityId',
          facilityName: '$facility.name',
          total: 1,
          occupied: 1,
          reserved: 1,
          available: 1,
          maintenance: 1,
          locked: 1,
        },
      },
      { $sort: { floorName: 1, vehicleTypeName: 1 } },
    ];

    const rawCells = await ParkingSlot.aggregate(pipeline);

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const flowMatch: any = {
      checkOutTime: { $gte: twentyFourHoursAgo },
    };
    if (facilityId) flowMatch.facilityId = new mongoose.Types.ObjectId(facilityId);
    if (vehicleTypeId) flowMatch.vehicleTypeId = new mongoose.Types.ObjectId(vehicleTypeId);

    const flowAgg = await ParkingSession.aggregate([
      { $match: flowMatch },
      {
        $group: {
          _id: { floorId: '$floorId', vehicleTypeId: '$vehicleTypeId' },
          turnover: { $sum: 1 },
        },
      },
    ]);

    const flowMap = new Map<string, number>();
    for (const f of flowAgg) {
      const key = `${f._id.floorId}_${f._id.vehicleTypeId}`;
      flowMap.set(key, f.turnover);
    }

    const heatmapCells = rawCells.map((cell: any) => {
      const occupancyRate =
        cell.total > 0 ? Math.round((cell.occupied / cell.total) * 10000) / 100 : 0;

      const effectiveOccupancy =
        cell.total > 0
          ? Math.round(((cell.occupied + cell.reserved) / cell.total) * 10000) / 100
          : 0;

      const optimalOccupancy = ReportService.MFD_DEFAULT_OPTIMAL;

      const operatingRegime = ReportService.classifyMFDRegime(effectiveOccupancy, optimalOccupancy);

      const gap = Math.round((effectiveOccupancy - optimalOccupancy) * 100) / 100;

      const flowKey = `${cell.floorId}_${cell.vehicleTypeId}`;
      const flowProxy = flowMap.get(flowKey) || 0;

      return {
        floorId: cell.floorId,
        floorName: cell.floorName,
        vehicleTypeId: cell.vehicleTypeId,
        vehicleTypeName: cell.vehicleTypeName,
        vehicleTypeCode: cell.vehicleTypeCode,

        facilityId: cell.facilityId,
        facilityName: cell.facilityName,
        total: cell.total,
        occupied: cell.occupied,
        reserved: cell.reserved,
        available: cell.available,
        maintenance: cell.maintenance,
        locked: cell.locked,
        occupancyRate,
        effectiveOccupancy,
        optimalOccupancy,
        operatingRegime,
        gap,
        flowProxy,
      };
    });

    const floorAxis: { floorId: string; floorName: string }[] = [];
    const seenFloors = new Set<string>();
    for (const cell of heatmapCells) {
      const fid = cell.floorId.toString();
      if (!seenFloors.has(fid)) {
        seenFloors.add(fid);
        floorAxis.push({ floorId: fid, floorName: cell.floorName });
      }
    }

    const vehicleTypeAxis: { vehicleTypeId: string; vehicleTypeName: string; vehicleTypeCode: string }[] = [];
    const seenVehicleTypes = new Set<string>();
    for (const cell of heatmapCells) {
      const vid = cell.vehicleTypeId.toString();
      if (!seenVehicleTypes.has(vid)) {
        seenVehicleTypes.add(vid);
        vehicleTypeAxis.push({
          vehicleTypeId: vid,
          vehicleTypeName: cell.vehicleTypeName,
          vehicleTypeCode: cell.vehicleTypeCode,
        });
      }
    }

    const totalSlots = heatmapCells.reduce((s: number, c: any) => s + c.total, 0);
    const totalOccupied = heatmapCells.reduce((s: number, c: any) => s + c.occupied, 0);
    const totalReserved = heatmapCells.reduce((s: number, c: any) => s + c.reserved, 0);
    const totalAvailable = heatmapCells.reduce((s: number, c: any) => s + c.available, 0);
    const totalFlow = heatmapCells.reduce((s: number, c: any) => s + c.flowProxy, 0);

    const weightedOptimal =
      totalSlots > 0
        ? Math.round(
            heatmapCells.reduce(
              (s: number, c: any) => s + c.optimalOccupancy * c.total,
              0
            ) / totalSlots * 100
          ) / 100
        : ReportService.MFD_DEFAULT_OPTIMAL;

    const overallEffective =
      totalSlots > 0
        ? Math.round(((totalOccupied + totalReserved) / totalSlots) * 10000) / 100
        : 0;

    const overallRegime = ReportService.classifyMFDRegime(overallEffective, weightedOptimal);

    const regimeCounts = {
      'free-flow': heatmapCells.filter((c: any) => c.operatingRegime === 'free-flow').length,
      capacity: heatmapCells.filter((c: any) => c.operatingRegime === 'capacity').length,
      congested: heatmapCells.filter((c: any) => c.operatingRegime === 'congested').length,
    };

    return {
      algorithm: 'MFD',
      description:
        'Occupancy heatmap theo tầng × loại xe với MFD-based Optimal Occupancy.',
      summary: {
        totalSlots,
        totalOccupied,
        totalReserved,
        totalAvailable,
        overallOccupancyRate:
          totalSlots > 0 ? Math.round((totalOccupied / totalSlots) * 10000) / 100 : 0,
        overallEffectiveOccupancy: overallEffective,
        weightedOptimalOccupancy: weightedOptimal,
        overallOperatingRegime: overallRegime,
        totalFlowProxy24h: totalFlow,
        regimeCounts,
      },
      axes: {
        floors: floorAxis,
        vehicleTypes: vehicleTypeAxis,
      },
      heatmapCells,
    };
  }
}
