import mongoose from 'mongoose';
import { ParkingSession } from '../models/parkingSession.model';
import { Payment } from '../models/payment.model';
import { ParkingSlot, SlotStatus } from '../models/parkingSlot.model';
import { Floor } from '../models/floor.model';
import { AppError } from '../middlewares/error.middleware';
import { getCache, setCache } from '../config/redis';

// ─── Định nghĩa kiểu dữ liệu đầu vào ────────────────

/** Bộ lọc cho báo cáo lượt xe vào/ra (FR-6.1) */
interface DateRangeFilter {
  facilityId?: string;     // ID bãi xe (lọc theo bãi)
  facilityIds?: string[];  // Danh sách facility IDs (scope manager)
  floorId?: string;        // ID tầng (lọc theo tầng)
  vehicleTypeId?: string;  // ID loại phương tiện
  startDate?: string;      // Ngày bắt đầu (ISO date string)
  endDate?: string;        // Ngày kết thúc (ISO date string)
  groupBy?: 'day' | 'week' | 'month'; // Nhóm theo ngày/tuần/tháng
}

/** Bộ lọc cho báo cáo doanh thu (FR-6.2) */
interface RevenueFilter {
  facilityId?: string;     // ID bãi xe
  facilityIds?: string[];  // Danh sách facility IDs (scope manager)
  vehicleTypeId?: string;  // ID loại phương tiện
  paymentMethod?: string;  // Phương thức thanh toán (cash, qr_pay, e_wallet, bank_card)
  startDate?: string;      // Ngày bắt đầu
  endDate?: string;        // Ngày kết thúc
  groupBy?: 'day' | 'week' | 'month'; // Nhóm theo ngày/tuần/tháng
}

/** Bộ lọc cho báo cáo tỷ lệ lấp đầy (FR-6.3) */
interface OccupancyFilter {
  facilityId?: string;     // ID bãi xe
  facilityIds?: string[];  // Danh sách facility IDs (scope manager)
  vehicleTypeId?: string;  // ID loại phương tiện
}

/** Bộ lọc cho báo cáo khung giờ cao điểm (FR-6.4) */
interface PeakHoursFilter {
  facilityId?: string;     // ID bãi xe
  facilityIds?: string[];  // Danh sách facility IDs (scope manager)
  vehicleTypeId?: string;  // ID loại phương tiện
  startDate?: string;      // Ngày bắt đầu
  endDate?: string;        // Ngày kết thúc
}

// ─── Hàm tiện ích: Xây dựng điều kiện lọc theo ngày ──

/**
 * Tạo điều kiện MongoDB match cho khoảng thời gian
 * @param startDate - Ngày bắt đầu (ISO string)
 * @param endDate - Ngày kết thúc (ISO string)
 * @param dateField - Tên trường ngày cần lọc (mặc định: checkInTime)
 * @returns Đối tượng match cho MongoDB aggregation
 */
function buildDateMatch(startDate?: string, endDate?: string, dateField = 'checkInTime') {
  const match: any = {};
  if (startDate || endDate) {
    match[dateField] = {};
    if (startDate) match[dateField].$gte = new Date(startDate);
    if (endDate) match[dateField].$lte = new Date(endDate);
  }
  return match;
}

/**
 * Tạo biểu thức nhóm theo thời gian cho MongoDB $group stage
 * @param groupBy - Kiểu nhóm: 'day' | 'week' | 'month'
 * @param dateField - Trường ngày để nhóm (mặc định: $checkInTime)
 * @returns Biểu thức _id cho $group
 */
function getDateGroupExpression(groupBy: string, dateField = '$checkInTime') {
  switch (groupBy) {
    case 'week':
      // Nhóm theo tuần ISO (năm + số tuần)
      return {
        year: { $isoWeekYear: dateField },
        week: { $isoWeek: dateField },
      };
    case 'month':
      // Nhóm theo tháng (năm + tháng)
      return {
        year: { $year: dateField },
        month: { $month: dateField },
      };
    case 'day':
    default:
      // Nhóm theo ngày (năm + tháng + ngày)
      return {
        year: { $year: dateField },
        month: { $month: dateField },
        day: { $dayOfMonth: dateField },
      };
  }
}

/**
 * Chuyển đổi kết quả nhóm thành nhãn hiển thị (label)
 * Ví dụ: { year: 2026, month: 5, day: 1 } → "2026-05-01"
 * @param group - Đối tượng _id từ kết quả $group
 * @param groupBy - Kiểu nhóm: 'day' | 'week' | 'month'
 * @returns Chuỗi nhãn thời gian
 */
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

// ─── Lớp dịch vụ Báo cáo ─────────────────────────────

export class ReportService {
  /**
   * FR-6.1: Báo cáo lượt xe vào/ra
   *
   * Thống kê số lượt xe check-in và check-out theo ngày/tuần/tháng.
   * Hỗ trợ lọc theo bãi xe, tầng, loại phương tiện và khoảng thời gian.
   *
   * Luồng xử lý:
   * 1. Aggregate check-in từ ParkingSession theo checkInTime
   * 2. Aggregate check-out từ ParkingSession theo checkOutTime (chỉ session đã hoàn thành)
   * 3. Gộp (merge) kết quả check-in/check-out theo nhãn thời gian
   * 4. Tính tổng và trả về summary + data chi tiết
   */
  static async getTrafficReport(filters: DateRangeFilter) {
    const cacheKey = `report:traffic:${Buffer.from(JSON.stringify(filters)).toString('base64')}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    const { facilityId, facilityIds, floorId, vehicleTypeId, startDate, endDate, groupBy = 'day' } = filters;

    // ── Bước 1: Xây dựng điều kiện lọc (match stage) ──
    const matchStage: any = {};
    if (facilityId) matchStage.facilityId = new mongoose.Types.ObjectId(facilityId);
    else if (facilityIds && facilityIds.length > 0) matchStage.facilityId = { $in: facilityIds.map(id => new mongoose.Types.ObjectId(id)) };
    if (floorId) matchStage.floorId = new mongoose.Types.ObjectId(floorId);
    if (vehicleTypeId) matchStage.vehicleTypeId = new mongoose.Types.ObjectId(vehicleTypeId);

    // Lọc theo khoảng thời gian check-in
    const dateMatch = buildDateMatch(startDate, endDate, 'checkInTime');
    Object.assign(matchStage, dateMatch);

    // Biểu thức nhóm theo thời gian
    const dateGroupExpr = getDateGroupExpression(groupBy, '$checkInTime');

    // ── Bước 2: Aggregate lượt xe VÀO (check-in) ──
    const checkInAgg = await ParkingSession.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: dateGroupExpr,
          checkInCount: { $sum: 1 }, // Đếm số lượt check-in
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.week': 1 } },
    ]);

    // ── Bước 3: Aggregate lượt xe RA (check-out) ──
    // Chỉ tính session đã có checkOutTime (xe đã ra bãi)
    const checkOutMatchStage: any = { ...matchStage };
    // Chuyển lọc ngày sang trường checkOutTime thay vì checkInTime
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
          checkOutCount: { $sum: 1 }, // Đếm số lượt check-out
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.week': 1 } },
    ]);

    // ── Bước 4: Gộp dữ liệu check-in và check-out theo nhãn thời gian ──
    const mergedMap = new Map<string, { label: string; checkIn: number; checkOut: number }>();

    // Thêm dữ liệu check-in vào map
    for (const item of checkInAgg) {
      const label = formatGroupLabel(item._id, groupBy);
      mergedMap.set(label, { label, checkIn: item.checkInCount, checkOut: 0 });
    }

    // Gộp dữ liệu check-out vào map (bổ sung hoặc cập nhật)
    for (const item of checkOutAgg) {
      const label = formatGroupLabel(item._id, groupBy);
      const existing = mergedMap.get(label);
      if (existing) {
        existing.checkOut = item.checkOutCount;
      } else {
        mergedMap.set(label, { label, checkIn: 0, checkOut: item.checkOutCount });
      }
    }

    // Sắp xếp theo thời gian tăng dần
    const data = Array.from(mergedMap.values()).sort((a, b) => a.label.localeCompare(b.label));

    // ── Bước 5: Tính tổng kết ──
    const totalCheckIn = data.reduce((sum, d) => sum + d.checkIn, 0);
    const totalCheckOut = data.reduce((sum, d) => sum + d.checkOut, 0);

    const result = {
      groupBy,
      summary: {
        totalCheckIn,                              // Tổng lượt xe vào
        totalCheckOut,                             // Tổng lượt xe ra
        currentlyParked: totalCheckIn - totalCheckOut, // Số xe đang gửi (ước tính)
      },
      data, // Dữ liệu chi tiết theo từng mốc thời gian
    };

    await setCache(cacheKey, result, 600); // 10 phút cache
    return result;
  }

  /**
   * FR-6.2: Báo cáo doanh thu
   *
   * Thống kê doanh thu gửi xe theo ngày/tuần/tháng.
   * Phân tích doanh thu theo 3 chiều:
   * - Theo mốc thời gian (byTimePeriod)
   * - Theo phương thức thanh toán (byMethod): cash, qr_pay, e_wallet, bank_card
   * - Theo loại phương tiện (byVehicleType): xe máy, ô tô, v.v.
   *
   * Luồng xử lý:
   * 1. Lọc Payment có status = 'completed'
   * 2. Join (lookup) với ParkingSession để lấy facilityId, vehicleTypeId
   * 3. Aggregate theo 3 chiều phân tích
   */
  static async getRevenueReport(filters: RevenueFilter) {
    const cacheKey = `report:revenue:${Buffer.from(JSON.stringify(filters)).toString('base64')}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    const { facilityId, facilityIds, vehicleTypeId, paymentMethod, startDate, endDate, groupBy = 'day' } = filters;

    // ── Pipeline chính: Doanh thu theo mốc thời gian ──
    const pipeline: any[] = [];

    // Chỉ tính thanh toán đã hoàn thành (completed)
    const paymentMatch: any = { status: 'completed' };
    const dateMatch = buildDateMatch(startDate, endDate, 'createdAt');
    Object.assign(paymentMatch, dateMatch);
    // Lọc theo phương thức thanh toán nếu có
    if (paymentMethod) paymentMatch.method = paymentMethod;

    pipeline.push({ $match: paymentMatch });

    // Join với collection ParkingSession để lấy thông tin bãi xe và loại xe
    pipeline.push({
      $lookup: {
        from: 'parkingsessions',       // Tên collection MongoDB (viết thường)
        localField: 'sessionId',       // Trường liên kết bên Payment
        foreignField: '_id',           // Trường liên kết bên ParkingSession
        as: 'session',                 // Tên mảng kết quả
      },
    });
    pipeline.push({ $unwind: '$session' }); // Giải nén mảng thành object

    // Lọc theo bãi xe hoặc loại phương tiện (từ session)
    if (facilityId || facilityIds || vehicleTypeId) {
      const sessionMatch: any = {};
      if (facilityId) sessionMatch['session.facilityId'] = new mongoose.Types.ObjectId(facilityId);
      else if (facilityIds && facilityIds.length > 0) sessionMatch['session.facilityId'] = { $in: facilityIds.map(id => new mongoose.Types.ObjectId(id)) };
      if (vehicleTypeId) sessionMatch['session.vehicleTypeId'] = new mongoose.Types.ObjectId(vehicleTypeId);
      pipeline.push({ $match: sessionMatch });
    }

    // Nhóm theo mốc thời gian và tính tổng doanh thu
    const dateGroupExpr = getDateGroupExpression(groupBy, '$createdAt');

    pipeline.push({
      $group: {
        _id: dateGroupExpr,
        totalRevenue: { $sum: '$amount' },      // Tổng doanh thu
        transactionCount: { $sum: 1 },          // Số giao dịch
        avgRevenue: { $avg: '$amount' },         // Doanh thu trung bình mỗi giao dịch
      },
    });

    pipeline.push({ $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.week': 1 } });

    const timeData = await Payment.aggregate(pipeline);

    // Định dạng kết quả theo mốc thời gian
    const data = timeData.map((item) => ({
      label: formatGroupLabel(item._id, groupBy),
      totalRevenue: Math.round(item.totalRevenue),     // Làm tròn doanh thu
      transactionCount: item.transactionCount,
      avgRevenue: Math.round(item.avgRevenue),          // Làm tròn trung bình
    }));

    // ── Pipeline phụ 1: Doanh thu theo phương thức thanh toán ──
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

    // Áp dụng lọc bãi xe / loại xe nếu có
    if (facilityId || facilityIds || vehicleTypeId) {
      const sessionMatch: any = {};
      if (facilityId) sessionMatch['session.facilityId'] = new mongoose.Types.ObjectId(facilityId);
      else if (facilityIds && facilityIds.length > 0) sessionMatch['session.facilityId'] = { $in: facilityIds.map(id => new mongoose.Types.ObjectId(id)) };
      if (vehicleTypeId) sessionMatch['session.vehicleTypeId'] = new mongoose.Types.ObjectId(vehicleTypeId);
      methodPipeline.push({ $match: sessionMatch });
    }

    // Nhóm theo phương thức thanh toán
    methodPipeline.push({
      $group: {
        _id: '$method',                          // Nhóm theo method (cash, qr_pay, ...)
        totalRevenue: { $sum: '$amount' },       // Tổng doanh thu theo phương thức
        count: { $sum: 1 },                       // Số giao dịch
      },
    });

    const byMethod = await Payment.aggregate(methodPipeline);

    // ── Pipeline phụ 2: Doanh thu theo loại phương tiện ──
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

    // Lọc theo bãi xe nếu có
    if (facilityId) {
      vehicleTypePipeline.push({
        $match: { 'session.facilityId': new mongoose.Types.ObjectId(facilityId) },
      });
    } else if (facilityIds && facilityIds.length > 0) {
      vehicleTypePipeline.push({
        $match: { 'session.facilityId': { $in: facilityIds.map(id => new mongoose.Types.ObjectId(id)) } },
      });
    }

    // Join với VehicleType để lấy tên loại xe
    vehicleTypePipeline.push(
      {
        $lookup: {
          from: 'vehicletypes',                   // Collection loại phương tiện
          localField: 'session.vehicleTypeId',
          foreignField: '_id',
          as: 'vehicleType',
        },
      },
      { $unwind: '$vehicleType' },
      {
        $group: {
          _id: { vehicleTypeId: '$session.vehicleTypeId', vehicleTypeName: '$vehicleType.name' },
          totalRevenue: { $sum: '$amount' },       // Tổng doanh thu theo loại xe
          count: { $sum: 1 },                       // Số giao dịch
        },
      }
    );

    const byVehicleType = await Payment.aggregate(vehicleTypePipeline);

    // ── Tính tổng kết ──
    const grandTotal = data.reduce((sum, d) => sum + d.totalRevenue, 0);
    const totalTransactions = data.reduce((sum, d) => sum + d.transactionCount, 0);

    // Tính số "kỳ" thực sự dựa vào groupBy và khoảng thời gian lọc
    // Tránh trường hợp chỉ 1 kỳ có dữ liệu → TB = tổng doanh thu
    let totalPeriods = 1;
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end   = new Date(endDate);
      if (groupBy === 'month') {
        // Đếm số tháng thực sự (VD: Jan→Jul 2026 = 7 tháng)
        totalPeriods = Math.max(
          1,
          (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1
        );
      } else if (groupBy === 'week') {
        const diffMs = end.getTime() - start.getTime();
        totalPeriods = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 7)));
      } else {
        // groupBy === 'day': đếm số ngày thực sự
        const diffMs = end.getTime() - start.getTime();
        totalPeriods = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);
      }
    }

    // avgRevenuePerDay: vẫn là TB mỗi ngày cho backward compat
    // avgRevenuePeriod: TB mỗi "kỳ" (ngày / tháng / tuần) kèm nhãn cho frontend
    const avgRevenuePeriod = Math.round(grandTotal / totalPeriods);
    const periodLabel = groupBy === 'month' ? 'tháng' : groupBy === 'week' ? 'tuần' : 'ngày';

    const result = {
      groupBy,
      summary: {
        grandTotal,                    // Tổng doanh thu
        totalTransactions,             // Tổng số giao dịch
        avgRevenuePerDay: avgRevenuePeriod, // Giá trị TB (backward-compat field name)
        avgRevenuePeriod,              // TB mỗi kỳ (ngày / tháng / tuần)
        periodLabel,                   // Nhãn kỳ: 'ngày' | 'tháng' | 'tuần'
      },
      byTimePeriod: data, // Doanh thu theo mốc thời gian
      byMethod: byMethod.map((m) => ({
        method: m._id,                                      // Phương thức thanh toán
        totalRevenue: Math.round(m.totalRevenue),
        count: m.count,
      })),
      byVehicleType: byVehicleType.map((v) => ({
        vehicleTypeId: v._id.vehicleTypeId,                 // ID loại xe
        vehicleTypeName: v._id.vehicleTypeName,             // Tên loại xe
        totalRevenue: Math.round(v.totalRevenue),
        count: v.count,
      })),
    };

    await setCache(cacheKey, result, 600); // 10 phút cache
    return result;
  }

  /**
   * FR-6.3: Báo cáo tỷ lệ lấp đầy
   *
   * Tính toán tỷ lệ slot đang sử dụng / tổng slot theo từng tầng (realtime).
   * Bao gồm effective occupancy = (occupied + reserved) / total
   * — dựa trên mô hình Reservation-Aware Capacity [P10] (Wang, Li & Xie, TRC 2022).
   *
   * Luồng xử lý:
   * 1. Lọc slot chưa bị xóa (isDeleted = false)
   * 2. Nhóm slot theo tầng, đếm từng trạng thái
   * 3. Join với Floor và ParkingFacility để lấy tên
   * 4. Tính occupancyRate và effectiveOccupancy
   */
  static async getOccupancyReport(filters: OccupancyFilter) {
    const cacheKey = `report:occupancy:${Buffer.from(JSON.stringify(filters)).toString('base64')}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    const { facilityId, facilityIds, vehicleTypeId } = filters;

    // Điều kiện lọc slot (chỉ lấy slot chưa bị xóa mềm)
    const slotMatch: any = { isDeleted: false };
    if (facilityId) slotMatch.facilityId = new mongoose.Types.ObjectId(facilityId);
    else if (facilityIds && facilityIds.length > 0) slotMatch.facilityId = { $in: facilityIds.map(id => new mongoose.Types.ObjectId(id)) };
    if (vehicleTypeId) slotMatch.vehicleTypeId = new mongoose.Types.ObjectId(vehicleTypeId);

    // Pipeline: Aggregate slot theo tầng
    const pipeline: any[] = [
      { $match: slotMatch },
      {
        $group: {
          _id: { floorId: '$floorId', facilityId: '$facilityId' },
          total: { $sum: 1 },                      // Tổng số slot
          occupied: {                               // Số slot đang có xe
            $sum: { $cond: [{ $eq: ['$status', SlotStatus.OCCUPIED] }, 1, 0] },
          },
          reserved: {                               // Số slot đã đặt trước
            $sum: { $cond: [{ $eq: ['$status', SlotStatus.RESERVED] }, 1, 0] },
          },
          available: {                              // Số slot trống
            $sum: { $cond: [{ $eq: ['$status', SlotStatus.AVAILABLE] }, 1, 0] },
          },
          maintenance: {                            // Số slot đang bảo trì
            $sum: { $cond: [{ $eq: ['$status', SlotStatus.MAINTENANCE] }, 1, 0] },
          },
          locked: {                                 // Số slot bị tạm khóa
            $sum: { $cond: [{ $eq: ['$status', SlotStatus.LOCKED] }, 1, 0] },
          },
        },
      },
      // Join với collection Floor để lấy tên tầng
      {
        $lookup: {
          from: 'floors',
          localField: '_id.floorId',
          foreignField: '_id',
          as: 'floor',
        },
      },
      { $unwind: '$floor' },
      // Join với collection ParkingFacility để lấy tên bãi xe
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
          // Tỷ lệ lấp đầy thực tế = occupied / total (%)
          occupancyRate: {
            $cond: [
              { $gt: ['$total', 0] },
              { $round: [{ $multiply: [{ $divide: ['$occupied', '$total'] }, 100] }, 2] },
              0,
            ],
          },
          // Tỷ lệ lấp đầy hiệu quả = (occupied + reserved) / total (%)
          // Theo mô hình Reservation-Aware Capacity [P10]
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
      { $sort: { facilityName: 1, floorName: 1 } }, // Sắp xếp theo tên bãi → tên tầng
    ];

    const floors = await ParkingSlot.aggregate(pipeline);

    // ── Tính tổng kết toàn bộ hệ thống ──
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

    await setCache(cacheKey, result, 60); // 1 phút cache (real-time hơn một chút)
    return result;
  }

  /**
   * FR-6.4: Báo cáo khung giờ cao điểm
   *
   * Xác định các khung giờ có lượng xe vào/ra nhiều nhất trong ngày.
   * Phân bố hoạt động theo 24 giờ (0h → 23h) và xác định top 3 giờ cao điểm.
   *
   * Luồng xử lý:
   * 1. Aggregate check-in theo giờ trong ngày ($hour)
   * 2. Aggregate check-out theo giờ trong ngày
   * 3. Ghép vào bảng 24 giờ
   * 4. Xếp hạng và lấy top 3 giờ có tổng hoạt động cao nhất
   */
  static async getPeakHoursReport(filters: PeakHoursFilter) {
    const cacheKey = `report:peak:${Buffer.from(JSON.stringify(filters)).toString('base64')}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    const { facilityId, facilityIds, vehicleTypeId, startDate, endDate } = filters;

    // ── Xây dựng điều kiện lọc ──
    const matchStage: any = {};
    if (facilityId) matchStage.facilityId = new mongoose.Types.ObjectId(facilityId);
    else if (facilityIds && facilityIds.length > 0) matchStage.facilityId = { $in: facilityIds.map(id => new mongoose.Types.ObjectId(id)) };
    if (vehicleTypeId) matchStage.vehicleTypeId = new mongoose.Types.ObjectId(vehicleTypeId);

    // Lọc theo khoảng thời gian
    const dateMatch = buildDateMatch(startDate, endDate, 'checkInTime');
    Object.assign(matchStage, dateMatch);

    // ── Aggregate lượt xe VÀO theo giờ trong ngày ──
    const checkInByHour = await ParkingSession.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { hour: { $hour: '$checkInTime' } }, // Nhóm theo giờ (0-23)
          checkInCount: { $sum: 1 },
        },
      },
      { $sort: { '_id.hour': 1 } },
    ]);

    // ── Aggregate lượt xe RA theo giờ trong ngày ──
    const checkOutMatchStage: any = { ...matchStage };
    delete checkOutMatchStage.checkInTime;
    checkOutMatchStage.checkOutTime = { $ne: null }; // Chỉ tính session đã checkout
    if (startDate || endDate) {
      checkOutMatchStage.checkOutTime = { $ne: null };
      if (startDate) checkOutMatchStage.checkOutTime.$gte = new Date(startDate);
      if (endDate) checkOutMatchStage.checkOutTime.$lte = new Date(endDate);
    }

    const checkOutByHour = await ParkingSession.aggregate([
      { $match: checkOutMatchStage },
      {
        $group: {
          _id: { hour: { $hour: '$checkOutTime' } }, // Nhóm theo giờ (0-23)
          checkOutCount: { $sum: 1 },
        },
      },
      { $sort: { '_id.hour': 1 } },
    ]);

    // ── Xây dựng bảng phân bố 24 giờ ──
    const hourlyData = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      label: `${String(i).padStart(2, '0')}:00 - ${String(i).padStart(2, '0')}:59`,
      checkIn: 0,       // Số lượt xe vào trong khung giờ này
      checkOut: 0,       // Số lượt xe ra trong khung giờ này
      totalActivity: 0,  // Tổng hoạt động = checkIn + checkOut
    }));

    // Điền dữ liệu check-in vào bảng 24 giờ
    for (const item of checkInByHour) {
      hourlyData[item._id.hour].checkIn = item.checkInCount;
    }

    // Điền dữ liệu check-out vào bảng 24 giờ
    for (const item of checkOutByHour) {
      hourlyData[item._id.hour].checkOut = item.checkOutCount;
    }

    // Tính tổng hoạt động mỗi giờ
    for (const h of hourlyData) {
      h.totalActivity = h.checkIn + h.checkOut;
    }

    // ── Xác định top 3 giờ cao điểm (giờ có nhiều hoạt động nhất) ──
    const sorted = [...hourlyData].sort((a, b) => b.totalActivity - a.totalActivity);
    const peakHours = sorted.slice(0, 3).map((h) => ({
      hour: h.hour,
      label: h.label,
      totalActivity: h.totalActivity,
      checkIn: h.checkIn,
      checkOut: h.checkOut,
    }));

    // ── Tính tổng kết ──
    const totalActivity = hourlyData.reduce((sum, h) => sum + h.totalActivity, 0);
    const avgActivityPerHour = totalActivity / 24;

    const result = {
      summary: {
        totalActivity,                                              // Tổng hoạt động trong khoảng thời gian
        avgActivityPerHour: Math.round(avgActivityPerHour * 100) / 100, // Trung bình hoạt động mỗi giờ
        peakHours,                                                  // Top 3 giờ cao điểm
      },
      hourlyDistribution: hourlyData, // Phân bố hoạt động theo 24 giờ
    };

    await setCache(cacheKey, result, 300); // 5 phút cache
    return result;
  }

  // ─────────────────────────────────────────────────────
  // FR-6.3 MỞ RỘNG: Occupancy Heatmap theo tầng + loại xe
  // Thuật toán: Macroscopic Fundamental Diagram (MFD) [P2]
  // ─────────────────────────────────────────────────────

  /**
   * MFD Optimal Occupancy — ngưỡng lấp đầy tối ưu theo kích thước xe
   *
   * Dựa trên Macroscopic Fundamental Diagram (MFD) [P2]:
   * - MFD mô tả quan hệ "chuông ngửa" giữa mật độ (occupancy) và lưu lượng (flow).
   * - Optimal Occupancy O* là điểm mà flow đạt cực đại trước khi rơi vào congestion.
   * - Xe lớn chiếm diện tích nhiều hơn → O* thấp hơn (dễ tắc hơn khi cùng occupancy %).
   *
   * Giá trị O* theo loại xe (đơn giản hóa từ MFD):
   *   - small  (xe máy, xe đạp): O* = 85%  — slot nhỏ, mật độ cao vẫn lưu thông tốt
   *   - medium (ô tô sedan):     O* = 75%  — cần lối đi quay đầu
   *   - large  (SUV, xe tải):    O* = 70%  — bán kính quay lớn, dễ ùn ứ
   */
  private static MFD_OPTIMAL_OCCUPANCY: Record<string, number> = {
    small: 85,
    medium: 75,
    large: 70,
  };

  /** Ngưỡng mặc định nếu không xác định được slotSize */
  private static MFD_DEFAULT_OPTIMAL = 75;

  /**
   * Phân loại chế độ vận hành theo MFD dựa trên occupancy vs O*
   *
   * MFD chia thành 3 vùng:
   * 1. Free-flow (tự do):     occupancy < 0.85 × O*  → còn nhiều chỗ, xe ra vào dễ
   * 2. Capacity (tối ưu):     0.85×O* ≤ occupancy ≤ O* → gần tối ưu, flow cao nhất
   * 3. Congested (quá tải):   occupancy > O*           → quá mật độ tối ưu, flow giảm
   */
  private static classifyMFDRegime(
    effectiveOccupancyPct: number,
    optimalOccupancyPct: number
  ): 'free-flow' | 'capacity' | 'congested' {
    if (effectiveOccupancyPct > optimalOccupancyPct) return 'congested';
    if (effectiveOccupancyPct >= optimalOccupancyPct * 0.85) return 'capacity';
    return 'free-flow';
  }

  /**
   * FR-6.3 mở rộng: API Occupancy Heatmap theo tầng + loại xe
   *
   * Tạo ma trận heatmap 2 chiều (tầng × loại xe) với các chỉ số MFD:
   * - occupancyRate: tỷ lệ lấp đầy thực tế (%)
   * - effectiveOccupancy: (occupied + reserved) / total (%) [P10]
   * - optimalOccupancy: O* theo MFD [P2] tùy kích thước xe
   * - operatingRegime: free-flow | capacity | congested
   * - flowProxy: ước tính flow từ turnover gần đây (lượt checkout 24h)
   * - gap: effectiveOccupancy - optimalOccupancy (dương = quá tải)
   *
   * @param filters.facilityId - ID bãi xe (bắt buộc cho heatmap có ý nghĩa)
   */
  static async getOccupancyHeatmap(filters: OccupancyFilter) {
    const { facilityId, facilityIds, vehicleTypeId } = filters;

    // ── Bước 1: Aggregate slot theo (floorId, vehicleTypeId) ──
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
      // Join Floor
      {
        $lookup: {
          from: 'floors',
          localField: '_id.floorId',
          foreignField: '_id',
          as: 'floor',
        },
      },
      { $unwind: '$floor' },
      // Join ParkingFacility
      {
        $lookup: {
          from: 'parkingfacilities',
          localField: '_id.facilityId',
          foreignField: '_id',
          as: 'facility',
        },
      },
      { $unwind: '$facility' },
      // Join VehicleType
      {
        $lookup: {
          from: 'vehicletypes',
          localField: '_id.vehicleTypeId',
          foreignField: '_id',
          as: 'vehicleType',
        },
      },
      { $unwind: '$vehicleType' },
      // Project
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

    // ── Bước 2: Ước tính Flow Proxy từ turnover (24h gần nhất) ──
    // Flow trong MFD = số xe hoàn thành hành trình (checkout) trong đơn vị thời gian.
    // Ở đây ta dùng số lượt checkout 24h gần nhất làm proxy cho flow.
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

    // Tạo map để tra cứu nhanh flow theo (floorId, vehicleTypeId)
    const flowMap = new Map<string, number>();
    for (const f of flowAgg) {
      const key = `${f._id.floorId}_${f._id.vehicleTypeId}`;
      flowMap.set(key, f.turnover);
    }

    // ── Bước 3: Tính MFD metrics cho mỗi ô heatmap ──
    const heatmapCells = rawCells.map((cell: any) => {
      const occupancyRate =
        cell.total > 0 ? Math.round((cell.occupied / cell.total) * 10000) / 100 : 0;

      const effectiveOccupancy =
        cell.total > 0
          ? Math.round(((cell.occupied + cell.reserved) / cell.total) * 10000) / 100
          : 0;

      // O* theo MFD [P2] — dùng ngưỡng mặc định
      const optimalOccupancy = ReportService.MFD_DEFAULT_OPTIMAL;

      // Phân loại chế độ vận hành MFD
      const operatingRegime = ReportService.classifyMFDRegime(effectiveOccupancy, optimalOccupancy);

      // Gap = khoảng cách đến O* (dương = quá tải, âm = còn dư)
      const gap = Math.round((effectiveOccupancy - optimalOccupancy) * 100) / 100;

      // Flow proxy (turnover 24h)
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
        // Slot counts
        total: cell.total,
        occupied: cell.occupied,
        reserved: cell.reserved,
        available: cell.available,
        maintenance: cell.maintenance,
        locked: cell.locked,
        // MFD metrics
        occupancyRate,           // Tỷ lệ lấp đầy thực tế (%)
        effectiveOccupancy,      // (occupied + reserved) / total (%) [P10]
        optimalOccupancy,        // O* theo MFD [P2] (%)
        operatingRegime,         // free-flow | capacity | congested
        gap,                     // effectiveOccupancy - O* (dương = quá tải)
        flowProxy,               // Ước tính flow: lượt checkout 24h
      };
    });

    // ── Bước 4: Xây dựng axes cho heatmap matrix ──
    // Trục Y: danh sách tầng (duy nhất, giữ thứ tự)
    const floorAxis: { floorId: string; floorName: string }[] = [];
    const seenFloors = new Set<string>();
    for (const cell of heatmapCells) {
      const fid = cell.floorId.toString();
      if (!seenFloors.has(fid)) {
        seenFloors.add(fid);
        floorAxis.push({ floorId: fid, floorName: cell.floorName });
      }
    }

    // Trục X: danh sách loại xe (duy nhất, giữ thứ tự)
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

    // ── Bước 5: Tính tổng kết facility-level ──
    const totalSlots = heatmapCells.reduce((s: number, c: any) => s + c.total, 0);
    const totalOccupied = heatmapCells.reduce((s: number, c: any) => s + c.occupied, 0);
    const totalReserved = heatmapCells.reduce((s: number, c: any) => s + c.reserved, 0);
    const totalAvailable = heatmapCells.reduce((s: number, c: any) => s + c.available, 0);
    const totalFlow = heatmapCells.reduce((s: number, c: any) => s + c.flowProxy, 0);

    // Weighted average O* (trọng số theo số slot)
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

    // Đếm số ô theo regime
    const regimeCounts = {
      'free-flow': heatmapCells.filter((c: any) => c.operatingRegime === 'free-flow').length,
      capacity: heatmapCells.filter((c: any) => c.operatingRegime === 'capacity').length,
      congested: heatmapCells.filter((c: any) => c.operatingRegime === 'congested').length,
    };

    return {
      algorithm: 'MFD', // Macroscopic Fundamental Diagram [P2]
      description:
        'Occupancy heatmap theo tầng × loại xe với MFD-based Optimal Occupancy. ' +
        'O* (Optimal Occupancy) là điểm cực đại trên đường MFD — vượt O* sẽ gây ùn tắc.',
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
