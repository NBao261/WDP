import { GoogleGenerativeAI, FunctionDeclaration, SchemaType, Tool } from '@google/generative-ai';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { ChatHistory, IChatHistory } from '../models/chatHistory.model';
import { ReportService } from './report.service';
import { ParkingFacility } from '../models/parkingFacility.model';
import { Exception, ExceptionStatus, ExceptionType } from '../models/exception.model';
import { ParkingSession, SessionStatus } from '../models/parkingSession.model';
import { Feedback, FeedbackStatus } from '../models/feedback.model';
import { Reservation, ReservationStatus } from '../models/reservation.model';
import { Vehicle } from '../models/vehicle.model';
import { User } from '../models/user.model';
import { PricingPlan } from '../models/pricingPlan.model';
import { ParkingSlot } from '../models/parkingSlot.model';
import { Payment, PaymentMethod, PaymentStatus } from '../models/payment.model';
import { AppError } from '../middlewares/error.middleware';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { getCache, setCache } from '../config/redis';

// ─── Types ────────────────────────────────────────────────

interface ChatResponse {
  answer: string;
  data: Record<string, any>;
  chartType: string | null;
  processingTimeMs: number;
  conversationId: string;
}

interface TimeRange {
  startDate: string;
  endDate: string;
}

// ─── Gemini Client ────────────────────────────────────────

function getGenAI(): GoogleGenerativeAI {
  if (!env.GEMINI_API_KEY) {
    throw new AppError('GEMINI_API_KEY chưa được cấu hình. Vui lòng thêm vào file .env', 500);
  }
  return new GoogleGenerativeAI(env.GEMINI_API_KEY);
}

// ─── Dynamic System Prompt ────────────────────────────────

const BASE_SYSTEM_PROMPT = `Bạn là Trợ lý AI thông minh cho hệ thống Quản lý Bãi Đỗ Xe Thông Minh.

VAI TRÒ:
- Giúp Manager thống kê, phân tích dữ liệu bãi xe
- Đưa ra nhận xét, cảnh báo, khuyến nghị hành động dựa trên dữ liệu
- Trả lời câu hỏi về nghiệp vụ, quy trình, chính sách bãi xe

KHẢ NĂNG:
1. Truy vấn dữ liệu: doanh thu, lượt xe, tỷ lệ lấp đầy, giờ cao điểm, ngoại lệ, feedback, xe đang gửi, đặt chỗ, bảng giá, thanh toán, hiệu suất nhân viên bằng cách gọi các function tương ứng.
2. Phân tích & nhận xét: so sánh xu hướng, phát hiện bất thường, đề xuất cải thiện  
3. Tư vấn nghiệp vụ: giải thích quy trình, chính sách phí, cách xử lý ngoại lệ

QUY TẮC TRẢ LỜI & NHẬN XÉT:
1. Trả lời bằng tiếng Việt, ngắn gọn, chuyên nghiệp. Format số tiền VNĐ (VD: 2.500.000đ).
2. Khi doanh thu giảm > 20% so với kỳ trước → Cảnh báo + đề xuất nguyên nhân
3. Khi tỷ lệ lấp đầy > 85% → Cảnh báo gần đầy + đề xuất phân luồng
4. Khi ngoại lệ tăng đột biến → Cảnh báo + đề xuất kiểm tra quy trình
5. Luôn kết thúc bằng 1-2 khuyến nghị hành động cụ thể nếu có số liệu.
6. TUYỆT ĐỐI KHÔNG dùng từ "dữ liệu" trong câu trả lời (sai: "Dữ liệu hôm nay không có"). Trả lời tự nhiên (đúng: "Hôm nay chưa có lượt xe nào").
7. **QUAN TRỌNG — TẤT CẢ SỐ LIỆU PHẢI NẰM TRONG ANSWER**:
   - Đọc kỹ kết quả từ function, trích xuất các con số quan trọng và đưa VÀO trong phần "answer".
   - Sử dụng bảng markdown, danh sách hoặc bullet points để trình bày số liệu rõ ràng.
   - VÍ DỤ ĐÚNG: "### Doanh thu hôm nay\n| Tòa nhà | Doanh thu | Giao dịch |\n|---|---|---|\n| Tòa A | 5.200.000đ | 45 |\n| Tòa B | 3.100.000đ | 28 |\n\n**Tổng: 8.300.000đ**\n\n📌 Khuyến nghị: ..."
   - VÍ DỤ SAI: Chỉ trả lời "Đã lấy báo cáo doanh thu" mà không kèm con số.
   - Manager sẽ chỉ đọc phần "answer", KHÔNG đọc raw data. Vì vậy answer phải đầy đủ thông tin.
8. Trả về kết quả dưới dạng một JSON hợp lệ duy nhất với cấu trúc:
   {"answer": "câu trả lời đầy đủ số liệu, dùng markdown", "chartType": "bar|line|pie|table|null"}
   Không thêm bất kỳ text nào nằm ngoài JSON này.

HƯỚNG DẪN TRUY VẤN CHI TIẾT:
- Khi hỏi "xe nào đang đậu" / "ai đang gửi xe" → gọi get_active_sessions, trả bảng chi tiết biển số, loại xe, tầng, thời gian gửi, tên chủ xe.
- Khi hỏi "đặt chỗ" / "reservation" → gọi get_reservation_report.
- Khi hỏi "giao dịch" / "thanh toán" / "tiền mặt" / "QR" → gọi get_payment_details.
- Khi hỏi "giá" / "bảng giá" / "phí" → gọi get_pricing_info.
- Khi hỏi "nhân viên" / "staff" / "hiệu suất" → gọi get_staff_performance.
- Khi hỏi "ngoại lệ" / "chi tiết exception" → gọi get_exception_summary (có cả danh sách chi tiết).
- Khi hỏi "phản hồi" / "feedback" / "khách phàn nàn" → gọi get_feedback_report (có cả chi tiết từng feedback).
- Nếu chủ xe là "Khách vãng lai" nghĩa là xe check-in qua staff, không liên kết tài khoản driver.

KNOWLEDGE BASE (Kiến thức về hệ thống):
- Hệ thống quản lý bãi đỗ xe thông minh với 4 actor: Admin, Manager, Staff, Driver
- Models: ParkingFacility (tòa nhà), Floor (tầng), ParkingSlot (slot), VehicleType (loại xe)
- ParkingSession: ghi nhận lượt gửi xe (check-in → check-out)
- PricingPlan: bảng giá (flat_rate, duration_based, time_window)  
- Payment: thanh toán (cash, qr_pay, e_wallet, bank_card)
- Exception: ngoại lệ (lost_card, wrong_plate, overtime, wrong_zone, unpaid)
- Feedback: phản hồi khách hàng (lost_card, wrong_fee, hard_to_find, slot_occupied, other)
- Reservation: đặt chỗ trước (pending, confirmed, used, cancelled, expired)
- Thuật toán MFD (Macroscopic Fundamental Diagram) cho occupancy heatmap
`;

/**
 * Xây dựng system prompt động theo scope Manager.
 * Inject danh sách tòa nhà để AI biết phạm vi truy cập.
 */
async function buildSystemPrompt(facilityScope?: string[]): Promise<string> {
  if (!facilityScope || facilityScope.length === 0) {
    return BASE_SYSTEM_PROMPT;
  }

  const facilities = await ParkingFacility.find({
    _id: { $in: facilityScope.map((id) => new mongoose.Types.ObjectId(id)) },
    status: 'active',
  })
    .select('_id name address')
    .lean();

  if (facilities.length === 0) {
    return BASE_SYSTEM_PROMPT;
  }

  const facilityList = facilities
    .map((f: any) => `- ${f.name} (địa chỉ: ${f.address || 'N/A'})`)
    .join('\n');

  return `${BASE_SYSTEM_PROMPT}

PHẠM VI QUẢN LÝ CỦA MANAGER HIỆN TẠI:
Bạn chỉ được trả lời và truy vấn dữ liệu về các tòa nhà sau:
${facilityList}

QUY TẮC BẢO MẬT & PHẠM VI:
- CHỈ trả lời câu hỏi liên quan đến các tòa nhà được liệt kê ở trên.
- Nếu Manager hỏi về tòa nhà không có trong danh sách → trả lời: "Xin lỗi, bạn không có quyền truy cập thông tin của tòa nhà này. Bạn chỉ có thể xem báo cáo của: ${facilities.map((f: any) => f.name).join(', ')}."
- Khi Manager hỏi chung (không chỉ định tòa nhà cụ thể), hãy trả lời tổng hợp cho TẤT CẢ các tòa nhà trong phạm vi.
- Khi so sánh, chỉ so sánh giữa các tòa nhà trong phạm vi.
`;
}

// ─── Time Range Resolver ──────────────────────────────────

/**
 * Resolve khoảng thời gian từ preset string hoặc custom dates.
 * Hỗ trợ: preset cố định, last_N_days (dynamic), all_time, và custom start/end dates.
 */
function resolveTimeRange(
  timeRangeStr: string | null | undefined,
  customStartDate?: string,
  customEndDate?: string
): TimeRange {
  // Ưu tiên custom dates nếu có
  if (customStartDate || customEndDate) {
    const now = new Date();
    const start = customStartDate ? new Date(customStartDate) : new Date(0); // epoch nếu không có start
    const end = customEndDate ? new Date(customEndDate) : new Date(now);
    // Đảm bảo end date bao gồm hết ngày
    if (customEndDate && !customEndDate.includes('T')) {
      end.setHours(23, 59, 59, 999);
    }
    if (customStartDate && !customStartDate.includes('T')) {
      start.setHours(0, 0, 0, 0);
    }
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Dynamic last_N_days pattern (ví dụ: last_2_days, last_5_days, last_14_days)
  const lastNDaysMatch = timeRangeStr?.match(/^last_(\d+)_days$/);
  if (lastNDaysMatch) {
    const n = parseInt(lastNDaysMatch[1], 10);
    const start = new Date(today);
    start.setDate(start.getDate() - n);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    return { startDate: start.toISOString(), endDate: endOfDay.toISOString() };
  }

  switch (timeRangeStr) {
    case 'today': {
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);
      return { startDate: today.toISOString(), endDate: endOfDay.toISOString() };
    }
    case 'yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const endYesterday = new Date(yesterday);
      endYesterday.setHours(23, 59, 59, 999);
      return { startDate: yesterday.toISOString(), endDate: endYesterday.toISOString() };
    }
    case 'this_week': {
      const startOfWeek = new Date(today);
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1);
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);
      return { startDate: startOfWeek.toISOString(), endDate: endOfDay.toISOString() };
    }
    case 'last_week': {
      const startOfLastWeek = new Date(today);
      startOfLastWeek.setDate(startOfLastWeek.getDate() - startOfLastWeek.getDay() - 6);
      const endOfLastWeek = new Date(startOfLastWeek);
      endOfLastWeek.setDate(endOfLastWeek.getDate() + 6);
      endOfLastWeek.setHours(23, 59, 59, 999);
      return { startDate: startOfLastWeek.toISOString(), endDate: endOfLastWeek.toISOString() };
    }
    case 'this_month': {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);
      return { startDate: startOfMonth.toISOString(), endDate: endOfDay.toISOString() };
    }
    case 'last_month': {
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      endOfLastMonth.setHours(23, 59, 59, 999);
      return { startDate: startOfLastMonth.toISOString(), endDate: endOfLastMonth.toISOString() };
    }
    case 'this_year': {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);
      return { startDate: startOfYear.toISOString(), endDate: endOfDay.toISOString() };
    }
    case 'last_year': {
      const startOfLastYear = new Date(now.getFullYear() - 1, 0, 1);
      const endOfLastYear = new Date(now.getFullYear() - 1, 11, 31);
      endOfLastYear.setHours(23, 59, 59, 999);
      return { startDate: startOfLastYear.toISOString(), endDate: endOfLastYear.toISOString() };
    }
    case 'all_time': {
      // Lấy từ đầu hệ thống (epoch) đến hiện tại
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);
      return { startDate: new Date(0).toISOString(), endDate: endOfDay.toISOString() };
    }
    default: {
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);
      return { startDate: today.toISOString(), endDate: endOfDay.toISOString() };
    }
  }
}

// ─── Regex Escape Helper ──────────────────────────────────

/**
 * Escape ký tự đặc biệt trong regex để tránh lỗi khi tên toà nhà
 * chứa ký tự như [ ] ( ) . * + ? ^ $ { } | \
 * Ví dụ: "Vinhome - 1 [Test]" → "Vinhome \- 1 \[Test\]"
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Facility Name Resolver ───────────────────────────────

async function resolveFacilityId(
  facilityName: string | null | undefined,
  facilityScope?: string[]
): Promise<string | null | undefined> {
  if (!facilityName) return undefined;

  // Escape ký tự đặc biệt regex trong tên toà nhà
  const escapedName = escapeRegex(facilityName);
  const query: any = { name: { $regex: escapedName, $options: 'i' } };
  if (facilityScope && facilityScope.length > 0) {
    query._id = { $in: facilityScope.map((id) => new mongoose.Types.ObjectId(id)) };
  }

  try {
    const facility = await ParkingFacility.findOne(query).select('_id name');
    if (!facility) {
      logger.warn(`[Chatbot] Facility not found: "${facilityName}"`, { escapedName, scopeCount: facilityScope?.length });
      return null;
    }
    return facility._id?.toString();
  } catch (err: any) {
    logger.error(`[Chatbot] Error resolving facility name: "${facilityName}"`, { error: err.message });
    return null;
  }
}

async function queryWithScope(
  handler: (args: any, facilityId?: string) => Promise<any>,
  args: any,
  facilityId: string | null | undefined,
  facilityScope?: string[]
): Promise<any> {
  if (facilityId === null) {
    return { error: 'Không tìm thấy tòa nhà này hoặc bạn không có quyền truy cập dữ liệu của tòa nhà này.' };
  }
  if (facilityId) {
    const facility = await ParkingFacility.findById(facilityId).select('name').lean();
    const result = await handler(args, facilityId);
    if (result.error) return result;
    return { ...result, facilityName: facility?.name || 'Không rõ' };
  }
  if (facilityScope && facilityScope.length > 0) {
    if (facilityScope.length === 1) {
      const facility = await ParkingFacility.findById(facilityScope[0]).select('name').lean();
      const result = await handler(args, facilityScope[0]);
      if (result.error) return result;
      return { ...result, facilityName: facility?.name || 'Không rõ' };
    }
    const [facilities, ...results] = await Promise.all([
      ParkingFacility.find({
        _id: { $in: facilityScope.map((id) => new mongoose.Types.ObjectId(id)) },
      }).select('_id name').lean(),
      ...facilityScope.map((fId) => handler(args, fId).catch((err: any) => {
        logger.warn(`[Chatbot] Handler failed for facility ${fId}`, { error: err.message });
        return null;
      })),
    ]);
    const nameMap = new Map<string, string>(facilities.map((f: any) => [f._id.toString(), f.name]));
    return mergeMultiFacilityData(results.filter(Boolean), facilityScope, nameMap);
  }
  const allFacilities = await ParkingFacility.find({ status: 'active' }).select('_id name').lean();
  if (allFacilities.length === 0) return handler(args);
  if (allFacilities.length === 1) {
    const result = await handler(args, allFacilities[0]._id.toString());
    if (result.error) return result;
    return { ...result, facilityName: allFacilities[0].name };
  }
  const allIds = allFacilities.map((f: any) => f._id.toString());
  const results = await Promise.all(allIds.map((fId: string) => handler(args, fId).catch((err: any) => {
    logger.warn(`[Chatbot] Handler failed for facility ${fId}`, { error: err.message });
    return null;
  })));
  const nameMap = new Map(allFacilities.map((f: any) => [f._id.toString(), f.name]));
  return mergeMultiFacilityData(results.filter(Boolean), allIds, nameMap);
}

function mergeMultiFacilityData(results: any[], facilityIds: string[], nameMap: Map<string, string>): any {
  if (results.length === 0) return {};
  if (results.length === 1) {
    return { ...results[0], facilityName: nameMap.get(facilityIds[0]) || 'Không rõ' };
  }
  const perFacility = results.map((result, index) => ({
    facilityName: nameMap.get(facilityIds[index]) || `Tòa ${index + 1}`,
    ...(result || {}),
  }));
  const merged: any = { facilitiesIncluded: facilityIds.length, perFacility };
  const firstResult = results[0];
  if (firstResult?.summary) {
    const mergedSummary: any = {};
    const summaryKeys = Object.keys(firstResult.summary);
    for (const key of summaryKeys) {
      const values = results.map((r) => r?.summary?.[key]).filter((v) => v != null);
      if (values.every((v) => typeof v === 'number')) {
        mergedSummary[key] = values.reduce((sum: number, v: number) => sum + v, 0);
      } else {
        mergedSummary[key] = values[0];
      }
    }
    merged.summary = mergedSummary;
  }
  return merged;
}

// ─── Data Handlers ─────────────────────────────────────────

async function handleRevenueReport(args: any, facilityId?: string) {
  const timeRange = resolveTimeRange(args.timeRange, args.customStartDate, args.customEndDate);
  return ReportService.getRevenueReport({ facilityId, startDate: timeRange.startDate, endDate: timeRange.endDate, groupBy: 'day' });
}
async function handleTrafficReport(args: any, facilityId?: string) {
  const timeRange = resolveTimeRange(args.timeRange, args.customStartDate, args.customEndDate);
  return ReportService.getTrafficReport({ facilityId, startDate: timeRange.startDate, endDate: timeRange.endDate, groupBy: 'day' });
}
async function handleOccupancyReport(args: any, facilityId?: string) {
  return ReportService.getOccupancyReport({ facilityId });
}
async function handlePeakHours(args: any, facilityId?: string) {
  const timeRange = resolveTimeRange(args.timeRange, args.customStartDate, args.customEndDate);
  return ReportService.getPeakHoursReport({ facilityId, startDate: timeRange.startDate, endDate: timeRange.endDate });
}
async function handleFacilityInfo(args: any, facilityId?: string) {
  if (facilityId) {
    const facility = await ParkingFacility.findById(facilityId);
    return facility ? facility.toObject() : { error: 'Không tìm thấy bãi xe' };
  }
  const facilities = await ParkingFacility.find({ status: 'active' }).select('name address openTime closeTime status totalSlots');
  return { facilities, total: facilities.length };
}
async function handleExceptionSummary(args: any, facilityId?: string) {
  const timeRange = resolveTimeRange(args.timeRange, args.customStartDate, args.customEndDate);
  const matchStage: any = { createdAt: { $gte: new Date(timeRange.startDate), $lte: new Date(timeRange.endDate) } };
  if (facilityId) {
    const sessionIds = await ParkingSession.find({ facilityId }).select('_id').then((sessions) => sessions.map((s) => s._id));
    matchStage.sessionId = { $in: sessionIds };
  }
  const [byType, byStatus, total, recentExceptions] = await Promise.all([
    Exception.aggregate([{ $match: matchStage }, { $group: { _id: '$type', count: { $sum: 1 } } }]),
    Exception.aggregate([{ $match: matchStage }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Exception.countDocuments(matchStage),
    Exception.aggregate([
      { $match: matchStage },
      { $lookup: { from: 'parkingsessions', localField: 'sessionId', foreignField: '_id', as: 'session' } },
      { $unwind: { path: '$session', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'users', localField: 'resolvedByStaffId', foreignField: '_id', as: 'resolvedBy' } },
      { $unwind: { path: '$resolvedBy', preserveNullAndEmptyArrays: true } },
      { $project: {
        _id: 0,
        type: 1,
        description: 1,
        licensePlate: '$session.licensePlate',
        status: 1,
        source: 1,
        resolvedByStaff: { $ifNull: ['$resolvedBy.name', null] },
        staffNote: 1,
        surcharge: 1,
        createdAt: 1,
      }},
      { $sort: { createdAt: -1 } },
      { $limit: 15 },
    ]),
  ]);
  return {
    total,
    byType: byType.map((item: any) => ({ type: item._id, count: item.count })),
    byStatus: byStatus.map((item: any) => ({ status: item._id, count: item.count })),
    recentExceptions,
  };
}
async function handleActiveSessions(args: any, facilityId?: string) {
  const filter: any = { status: { $in: [SessionStatus.ACTIVE, SessionStatus.EXCEPTION] } };
  if (facilityId) filter.facilityId = new mongoose.Types.ObjectId(facilityId);

  // Summary counts
  const [total, byVehicleType, byFloor] = await Promise.all([
    ParkingSession.countDocuments(filter),
    ParkingSession.aggregate([
      { $match: filter },
      { $lookup: { from: 'vehicletypes', localField: 'vehicleTypeId', foreignField: '_id', as: 'vehicleType' } },
      { $unwind: '$vehicleType' },
      { $group: { _id: '$vehicleType.name', count: { $sum: 1 } } },
    ]),
    ParkingSession.aggregate([
      { $match: filter },
      { $lookup: { from: 'floors', localField: 'floorId', foreignField: '_id', as: 'floor' } },
      { $unwind: '$floor' },
      { $group: { _id: '$floor.name', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
  ]);

  // Detailed list with lookups
  const detailedSessions = await ParkingSession.aggregate([
    { $match: filter },
    { $lookup: { from: 'vehicletypes', localField: 'vehicleTypeId', foreignField: '_id', as: 'vt' } },
    { $unwind: '$vt' },
    { $lookup: { from: 'floors', localField: 'floorId', foreignField: '_id', as: 'fl' } },
    { $unwind: '$fl' },
    { $lookup: { from: 'parkingslots', localField: 'slotId', foreignField: '_id', as: 'sl' } },
    { $unwind: { path: '$sl', preserveNullAndEmptyArrays: true } },
    // Lookup driver via licensePlate → vehicles → users
    { $lookup: { from: 'vehicles', localField: 'licensePlate', foreignField: 'licensePlate', as: 'vehicle' } },
    { $unwind: { path: '$vehicle', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'users', localField: 'vehicle.userId', foreignField: '_id', as: 'driver' } },
    { $unwind: { path: '$driver', preserveNullAndEmptyArrays: true } },
    { $project: {
      _id: 0,
      licensePlate: 1,
      vehicleType: '$vt.name',
      floor: '$fl.name',
      slotCode: '$sl.code',
      checkInTime: 1,
      driverName: { $ifNull: ['$driver.name', 'Khách vãng lai'] },
      status: 1,
    }},
    { $sort: { checkInTime: -1 } },
    { $limit: 30 },
  ]);

  // Calculate parking duration for each session
  const now = new Date();
  const details = detailedSessions.map((s: any) => {
    const diffMs = now.getTime() - new Date(s.checkInTime).getTime();
    const hours = Math.floor(diffMs / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);
    const days = Math.floor(hours / 24);
    const remainHours = hours % 24;
    const duration = days > 0 ? `${days} ngày ${remainHours} giờ` : `${hours} giờ ${minutes} phút`;
    return { ...s, parkingDuration: duration };
  });

  return {
    totalActiveSessions: total,
    byVehicleType: byVehicleType.map((item: any) => ({ vehicleType: item._id, count: item.count })),
    byFloor: byFloor.map((item: any) => ({ floor: item._id, count: item.count })),
    details,
  };
}

async function handleReservationReport(args: any, facilityId?: string) {
  const timeRange = resolveTimeRange(args.timeRange, args.customStartDate, args.customEndDate);
  const filter: any = { createdAt: { $gte: new Date(timeRange.startDate), $lte: new Date(timeRange.endDate) } };
  if (facilityId) filter.facilityId = new mongoose.Types.ObjectId(facilityId);

  const [total, byStatus, recentReservations] = await Promise.all([
    Reservation.countDocuments(filter),
    Reservation.aggregate([
      { $match: filter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Reservation.aggregate([
      { $match: filter },
      { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'vehicletypes', localField: 'vehicleTypeId', foreignField: '_id', as: 'vt' } },
      { $unwind: { path: '$vt', preserveNullAndEmptyArrays: true } },
      { $project: {
        _id: 0,
        code: 1,
        licensePlate: 1,
        driverName: { $ifNull: ['$user.name', 'N/A'] },
        vehicleType: '$vt.name',
        startTime: 1,
        status: 1,
        cancellationFee: 1,
        createdAt: 1,
      }},
      { $sort: { createdAt: -1 } },
      { $limit: 20 },
    ]),
  ]);

  const statusMap: any = {};
  byStatus.forEach((s: any) => { statusMap[s._id] = s.count; });
  const cancelled = statusMap['cancelled'] || 0;
  const cancellationRate = total > 0 ? ((cancelled / total) * 100).toFixed(1) + '%' : '0%';

  return {
    summary: { total, ...statusMap },
    cancellationRate,
    recentReservations,
  };
}

async function handlePaymentDetails(args: any, facilityId?: string) {
  const timeRange = resolveTimeRange(args.timeRange, args.customStartDate, args.customEndDate);
  const payFilter: any = { createdAt: { $gte: new Date(timeRange.startDate), $lte: new Date(timeRange.endDate) } };
  if (args.paymentMethod) payFilter.method = args.paymentMethod;
  if (args.paymentStatus) payFilter.status = args.paymentStatus;

  // Build pipeline with facility filter
  const basePipeline: any[] = [
    { $match: payFilter },
    { $lookup: { from: 'parkingsessions', localField: 'sessionId', foreignField: '_id', as: 'session' } },
    { $unwind: '$session' },
  ];
  if (facilityId) {
    basePipeline.push({ $match: { 'session.facilityId': new mongoose.Types.ObjectId(facilityId) } });
  }

  const [byStatus, byMethod, recentPayments] = await Promise.all([
    Payment.aggregate([
      ...basePipeline,
      { $group: { _id: '$status', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } },
    ]),
    Payment.aggregate([
      ...basePipeline,
      { $match: { status: 'completed' } },
      { $group: { _id: '$method', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } },
    ]),
    Payment.aggregate([
      ...basePipeline,
      { $lookup: { from: 'vehicletypes', localField: 'session.vehicleTypeId', foreignField: '_id', as: 'vt' } },
      { $unwind: { path: '$vt', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'users', localField: 'staffId', foreignField: '_id', as: 'staff' } },
      { $unwind: { path: '$staff', preserveNullAndEmptyArrays: true } },
      { $project: {
        _id: 0,
        transactionCode: 1,
        amount: 1,
        method: 1,
        status: 1,
        licensePlate: '$session.licensePlate',
        vehicleType: '$vt.name',
        staffName: { $ifNull: ['$staff.name', 'N/A'] },
        createdAt: 1,
      }},
      { $sort: { createdAt: -1 } },
      { $limit: 20 },
    ]),
  ]);

  const totalAll = byStatus.reduce((s: number, i: any) => s + i.count, 0);
  const totalAmount = byStatus.filter((i: any) => i._id === 'completed').reduce((s: number, i: any) => s + i.totalAmount, 0);

  return {
    summary: {
      totalTransactions: totalAll,
      totalCompletedAmount: totalAmount,
      byStatus: byStatus.map((s: any) => ({ status: s._id, count: s.count, amount: Math.round(s.totalAmount) })),
    },
    byMethod: byMethod.map((m: any) => ({ method: m._id, count: m.count, amount: Math.round(m.totalAmount) })),
    recentPayments,
  };
}

async function handlePricingInfo(args: any, facilityId?: string) {
  const filter: any = { status: 'active', isDeleted: { $ne: true } };
  if (facilityId) filter.facilityId = new mongoose.Types.ObjectId(facilityId);

  const plans = await PricingPlan.aggregate([
    { $match: filter },
    { $lookup: { from: 'vehicletypes', localField: 'vehicleTypeId', foreignField: '_id', as: 'vt' } },
    { $unwind: '$vt' },
    { $lookup: { from: 'parkingfacilities', localField: 'facilityId', foreignField: '_id', as: 'fac' } },
    { $unwind: '$fac' },
    { $project: {
      _id: 0,
      name: 1,
      vehicleType: '$vt.name',
      facilityName: '$fac.name',
      feeType: 1,
      feeMethod: 1,
      rates: 1,
      overnightFee: 1,
      overtimeFeePerHour: 1,
      lostCardFee: 1,
      gracePeriodMinutes: 1,
      maxDailyFee: 1,
    }},
    { $sort: { facilityName: 1, vehicleType: 1 } },
  ]);

  return { totalPlans: plans.length, plans };
}

async function handleStaffPerformance(args: any, facilityId?: string) {
  const timeRange = resolveTimeRange(args.timeRange, args.customStartDate, args.customEndDate);
  const sessionFilter: any = { checkInTime: { $gte: new Date(timeRange.startDate), $lte: new Date(timeRange.endDate) } };
  if (facilityId) sessionFilter.facilityId = new mongoose.Types.ObjectId(facilityId);

  const [byCheckIn, byCheckOut, byExceptionResolved] = await Promise.all([
    // Top staff by check-in count
    ParkingSession.aggregate([
      { $match: sessionFilter },
      { $lookup: { from: 'users', localField: 'staffInId', foreignField: '_id', as: 'staff' } },
      { $unwind: '$staff' },
      { $group: { _id: '$staff.name', checkInCount: { $sum: 1 } } },
      { $sort: { checkInCount: -1 } },
      { $limit: 10 },
    ]),
    // Top staff by check-out count
    ParkingSession.aggregate([
      { $match: { ...sessionFilter, checkOutTime: { $ne: null }, staffOutId: { $ne: null } } },
      { $lookup: { from: 'users', localField: 'staffOutId', foreignField: '_id', as: 'staff' } },
      { $unwind: '$staff' },
      { $group: { _id: '$staff.name', checkOutCount: { $sum: 1 } } },
      { $sort: { checkOutCount: -1 } },
      { $limit: 10 },
    ]),
    // Top staff by exception resolved
    Exception.aggregate([
      { $match: { status: ExceptionStatus.RESOLVED, resolvedByStaffId: { $ne: null }, updatedAt: { $gte: new Date(timeRange.startDate), $lte: new Date(timeRange.endDate) } } },
      { $lookup: { from: 'users', localField: 'resolvedByStaffId', foreignField: '_id', as: 'staff' } },
      { $unwind: '$staff' },
      { $group: { _id: '$staff.name', resolvedCount: { $sum: 1 } } },
      { $sort: { resolvedCount: -1 } },
      { $limit: 10 },
    ]),
  ]);

  return {
    byCheckIn: byCheckIn.map((s: any) => ({ staffName: s._id, checkInCount: s.checkInCount })),
    byCheckOut: byCheckOut.map((s: any) => ({ staffName: s._id, checkOutCount: s.checkOutCount })),
    byExceptionResolved: byExceptionResolved.map((s: any) => ({ staffName: s._id, resolvedCount: s.resolvedCount })),
  };
}

async function handleFeedbackReport(args: any, facilityId?: string) {
  const timeRange = resolveTimeRange(args.timeRange, args.customStartDate, args.customEndDate);
  const filter: any = { createdAt: { $gte: new Date(timeRange.startDate), $lte: new Date(timeRange.endDate) } };
  if (facilityId) filter.facilityId = new mongoose.Types.ObjectId(facilityId);

  const feedbacks = await Feedback.find(filter).sort({ createdAt: -1 }).limit(100).lean();
  const summary = {
    totalFeedbacks: feedbacks.length,
    byStatus: feedbacks.reduce((acc: any, f: any) => { acc[f.status] = (acc[f.status] || 0) + 1; return acc; }, {}),
    byType: feedbacks.reduce((acc: any, f: any) => { acc[f.type] = (acc[f.type] || 0) + 1; return acc; }, {}),
  };

  // Detailed recent feedbacks with driver name and facility name
  const recentFeedbacks = await Feedback.aggregate([
    { $match: filter },
    { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'parkingfacilities', localField: 'facilityId', foreignField: '_id', as: 'fac' } },
    { $unwind: { path: '$fac', preserveNullAndEmptyArrays: true } },
    { $project: {
      _id: 0,
      type: 1,
      description: 1,
      status: 1,
      driverName: { $ifNull: ['$user.name', 'N/A'] },
      facilityName: { $ifNull: ['$fac.name', 'N/A'] },
      responseNote: 1,
      createdAt: 1,
    }},
    { $sort: { createdAt: -1 } },
    { $limit: 15 },
  ]);

  return { summary, recentFeedbacks };
}

// ─── Gemini Tools (Function Declarations) ─────────────────

const timeRangeDesc = "Khoảng thời gian. Giá trị preset: today, yesterday, this_week, last_week, this_month, last_month, this_year, last_year, last_7_days, last_30_days, last_N_days (thay N bằng số ngày, ví dụ: last_2_days, last_3_days, last_14_days), all_time (tất cả). Nếu user yêu cầu khoảng thời gian cụ thể (ví dụ: từ ngày 1/6 đến 15/6) thì KHÔNG dùng timeRange, hãy dùng customStartDate và customEndDate thay thế.";
const customDateDesc = "Ngày bắt đầu/kết thúc tùy chỉnh theo format YYYY-MM-DD (ví dụ: 2026-06-01). Chỉ dùng khi user yêu cầu khoảng thời gian cụ thể không nằm trong các preset.";

const reportTools: Tool[] = [{
  functionDeclarations: [
    {
      name: "get_revenue_report",
      description: "Lấy báo cáo doanh thu theo khoảng thời gian và bãi xe",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          timeRange: { type: SchemaType.STRING, description: timeRangeDesc },
          customStartDate: { type: SchemaType.STRING, description: customDateDesc },
          customEndDate: { type: SchemaType.STRING, description: customDateDesc },
          facilityName: { type: SchemaType.STRING, description: "Tên tòa nhà/bãi xe (optional)" },
        }
      }
    },
    {
      name: "get_traffic_report",
      description: "Lấy báo cáo lượt xe vào/ra theo khoảng thời gian",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          timeRange: { type: SchemaType.STRING, description: timeRangeDesc },
          customStartDate: { type: SchemaType.STRING, description: customDateDesc },
          customEndDate: { type: SchemaType.STRING, description: customDateDesc },
          facilityName: { type: SchemaType.STRING },
        }
      }
    },
    {
      name: "get_occupancy_report",
      description: "Lấy báo cáo tỷ lệ lấp đầy hiện tại của bãi xe",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          facilityName: { type: SchemaType.STRING },
        }
      }
    },
    {
      name: "get_peak_hours_report",
      description: "Lấy báo cáo khung giờ cao điểm (nhiều xe vào ra nhất)",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          timeRange: { type: SchemaType.STRING, description: timeRangeDesc },
          customStartDate: { type: SchemaType.STRING, description: customDateDesc },
          customEndDate: { type: SchemaType.STRING, description: customDateDesc },
          facilityName: { type: SchemaType.STRING },
        }
      }
    },
    {
      name: "get_exception_summary",
      description: "Tóm tắt và liệt kê chi tiết các trường hợp ngoại lệ (mất thẻ, sai biển số, quá giờ, sai zone, chưa thanh toán). Trả về tổng số, phân loại theo type/status, và danh sách 15 ngoại lệ gần nhất kèm biển số xe, ai xử lý, ghi chú.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          timeRange: { type: SchemaType.STRING, description: timeRangeDesc },
          customStartDate: { type: SchemaType.STRING, description: customDateDesc },
          customEndDate: { type: SchemaType.STRING, description: customDateDesc },
          facilityName: { type: SchemaType.STRING },
        }
      }
    },
    {
      name: "get_active_sessions",
      description: "Lấy danh sách chi tiết xe đang gửi trong bãi: biển số, loại xe, tầng, slot, thời gian vào, thời gian đã gửi, tên chủ xe. Dùng khi manager hỏi: ai đang gửi xe, xe nào đang đậu, liệt kê xe trong bãi, có bao nhiêu xe.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          facilityName: { type: SchemaType.STRING },
        }
      }
    },
    {
      name: "get_feedback_report",
      description: "Lấy báo cáo phản hồi của khách hàng kèm danh sách chi tiết: loại phản hồi, mô tả, tên khách, tòa nhà, trạng thái xử lý, ghi chú phản hồi.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          timeRange: { type: SchemaType.STRING, description: timeRangeDesc },
          customStartDate: { type: SchemaType.STRING, description: customDateDesc },
          customEndDate: { type: SchemaType.STRING, description: customDateDesc },
          facilityName: { type: SchemaType.STRING },
        }
      }
    },
    {
      name: "get_facility_info",
      description: "Lấy thông tin của các tòa nhà / bãi xe",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          facilityName: { type: SchemaType.STRING },
        }
      }
    },
    {
      name: "get_reservation_report",
      description: "Thống kê đặt chỗ trước (reservation): tổng số, phân theo trạng thái (pending/confirmed/used/cancelled/expired), tỷ lệ hủy, danh sách đặt chỗ gần đây kèm biển số, tên khách, loại xe.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          timeRange: { type: SchemaType.STRING, description: timeRangeDesc },
          customStartDate: { type: SchemaType.STRING, description: customDateDesc },
          customEndDate: { type: SchemaType.STRING, description: customDateDesc },
          facilityName: { type: SchemaType.STRING },
        }
      }
    },
    {
      name: "get_payment_details",
      description: "Lấy chi tiết giao dịch thanh toán: tổng số giao dịch, phân theo phương thức (tiền mặt/QR/ví điện tử/thẻ ngân hàng), phân theo trạng thái, danh sách giao dịch gần đây kèm mã giao dịch, số tiền, biển số xe, nhân viên thu.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          timeRange: { type: SchemaType.STRING, description: timeRangeDesc },
          customStartDate: { type: SchemaType.STRING, description: customDateDesc },
          customEndDate: { type: SchemaType.STRING, description: customDateDesc },
          facilityName: { type: SchemaType.STRING },
          paymentMethod: { type: SchemaType.STRING, description: "Lọc theo phương thức: cash, qr_pay, e_wallet, bank_card" },
          paymentStatus: { type: SchemaType.STRING, description: "Lọc theo trạng thái: pending, completed, failed, refunded" },
        }
      }
    },
    {
      name: "get_pricing_info",
      description: "Tra cứu bảng giá gửi xe: giá theo loại xe, theo tòa nhà, phí qua đêm, phí mất thẻ, phí quá giờ, ưu đãi giờ miễn phí. Dùng khi hỏi về giá cả, bảng phí, chi phí gửi xe.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          facilityName: { type: SchemaType.STRING },
        }
      }
    },
    {
      name: "get_staff_performance",
      description: "Thống kê hiệu suất nhân viên (staff): top staff check-in nhiều nhất, top staff check-out nhiều nhất, top staff xử lý ngoại lệ nhiều nhất. Dùng khi hỏi về hiệu suất, đánh giá nhân viên.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          timeRange: { type: SchemaType.STRING, description: timeRangeDesc },
          customStartDate: { type: SchemaType.STRING, description: customDateDesc },
          customEndDate: { type: SchemaType.STRING, description: customDateDesc },
          facilityName: { type: SchemaType.STRING },
        }
      }
    },
  ]
}];

const FUNCTION_HANDLERS: Record<string, (args: any, facilityId?: string) => Promise<any>> = {
  get_revenue_report: handleRevenueReport,
  get_traffic_report: handleTrafficReport,
  get_occupancy_report: handleOccupancyReport,
  get_peak_hours_report: handlePeakHours,
  get_exception_summary: handleExceptionSummary,
  get_active_sessions: handleActiveSessions,
  get_feedback_report: handleFeedbackReport,
  get_facility_info: handleFacilityInfo,
  get_reservation_report: handleReservationReport,
  get_payment_details: handlePaymentDetails,
  get_pricing_info: handlePricingInfo,
  get_staff_performance: handleStaffPerformance,
};

// ─── Quick Reply Suggestions ──────────────────────────────

const QUICK_REPLIES = {
  overview: ['Tình hình hôm nay thế nào?', 'Tóm tắt tuần này cho tôi'],
  revenue: ['Doanh thu hôm nay bao nhiêu?', 'So sánh doanh thu tuần này với tuần trước', 'Tòa nhà nào doanh thu cao nhất tháng này?'],
  traffic: ['Tuần này có bao nhiêu lượt xe?', 'Giờ nào đông nhất hôm nay?', 'So sánh lượt xe hôm nay và hôm qua'],
  operations: ['Tỷ lệ lấp đầy bãi xe hiện tại?', 'Xe nào đang đậu trong bãi?', 'Tóm tắt ngoại lệ tuần này'],
  reservations: ['Thống kê đặt chỗ tháng này', 'Tỷ lệ hủy đặt chỗ tuần này bao nhiêu?'],
  payments: ['Liệt kê giao dịch gần đây', 'Tỷ lệ thanh toán tiền mặt vs QR?'],
  pricing: ['Bảng giá gửi xe hiện tại', 'Giá gửi xe ô tô bao nhiêu?'],
  staff: ['Staff nào check-in nhiều nhất?', 'Hiệu suất nhân viên tuần này'],
  insights: ['Có vấn đề gì cần chú ý không?', 'Phân tích xu hướng doanh thu 30 ngày qua', 'Khách hàng phàn nàn gì gần đây?'],
};

// ─── Conversation Title Generator ─────────────────────────

/**
 * Tạo tiêu đề ngắn gọn cho conversation dựa trên tin nhắn đầu tiên.
 * Dùng Gemini để tóm tắt thành ≤8 từ.
 */
async function generateConversationTitle(firstMessage: string): Promise<string> {
  try {
    const ai = getGenAI();
    const model = ai.getGenerativeModel({ model: env.GEMINI_MODEL });
    const result = await model.generateContent(
      `Tóm tắt câu sau thành tiêu đề ngắn gọn (tối đa 8 từ tiếng Việt), không dùng dấu ngoặc kép, không giải thích:\n"${firstMessage}"`
    );
    const title = result.response.text().trim().replace(/^["']|["']$/g, '');
    return title.length > 100 ? title.substring(0, 100) : title;
  } catch (err: any) {
    logger.warn('[Chatbot] Failed to generate conversation title', { error: err.message });
    // Fallback: cắt tin nhắn đầu tiên làm title
    return firstMessage.length > 50 ? firstMessage.substring(0, 50) + '...' : firstMessage;
  }
}

// ─── Retry Helper ─────────────────────────────────────────

/**
 * Retry một async function với exponential backoff.
 * Chỉ retry khi gặp transient errors (429, 503, network).
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 2000
): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const isRetryable =
        err.message?.includes('429') ||
        err.message?.includes('503') ||
        err.message?.includes('UNAVAILABLE') ||
        err.message?.includes('DEADLINE_EXCEEDED');
      if (!isRetryable || attempt === maxRetries) {
        throw err;
      }
      const delay = baseDelayMs * Math.pow(2, attempt);
      logger.warn(`[Chatbot] Retrying Gemini call (attempt ${attempt + 1}/${maxRetries})`, {
        error: err.message,
        delayMs: delay,
      });
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

// ─── Main Service ─────────────────────────────────────────

export class ChatbotService {
  static async processQuery(
    userId: string,
    message: string,
    facilityScope?: string[],
    conversationId?: string
  ): Promise<ChatResponse> {
    const startTime = Date.now();
    const isNewConversation = !conversationId;
    const convId = conversationId || `conv_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    try {
      // --- AI Caching (FR-19) ---
      let cacheKey = '';
      if (isNewConversation) {
        const normalizedMsg = message.toLowerCase().replace(/[^\w\s\u00C0-\u1EF9]/gi, '').trim();
        const scopeKey = facilityScope ? facilityScope.sort().join(',') : 'ALL';
        cacheKey = `ai_cache:${crypto.createHash('md5').update(normalizedMsg + '_' + scopeKey).digest('hex')}`;
        
        const cachedResponse = await getCache(cacheKey);
        if (cachedResponse) {
          logger.info(`[Chatbot] Cache HIT for message: "${message}"`);
          return {
            ...cachedResponse,
            conversationId: convId,
            processingTimeMs: Date.now() - startTime,
          };
        }
      }
      
      // Xây dựng system prompt động theo scope Manager
      const systemPrompt = await buildSystemPrompt(facilityScope);

      const ai = getGenAI();
      const model = ai.getGenerativeModel({
        model: env.GEMINI_MODEL,
        tools: reportTools,
        systemInstruction: systemPrompt,
      });

      // Load up to 10 recent messages for this conversation context
      const historyDocs = await ChatHistory.find({ userId, conversationId: convId })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();
      
      const history = historyDocs.reverse().flatMap((doc) => [
        { role: 'user' as const, parts: [{ text: doc.message }] },
        { role: 'model' as const, parts: [{ text: doc.response }] }
      ]);

      const chat = model.startChat({ history });

      // Send the user message with retry
      let result = await withRetry(() => chat.sendMessage([{ text: message }]));
      let functionCalls = result.response.functionCalls();
      let accumulatedData: any = {};

      // Handle multi-turn function calls (AI có thể gọi nhiều lượt)
      const MAX_FUNCTION_CALL_ROUNDS = 3;
      let round = 0;
      while (functionCalls && functionCalls.length > 0 && round < MAX_FUNCTION_CALL_ROUNDS) {
        round++;
        const functionResponses: Array<{ functionResponse: { name: string; response: any } }> = [];
        
        for (const call of functionCalls) {
          const handler = FUNCTION_HANDLERS[call.name];
          if (handler) {
            try {
              const facilityId = await resolveFacilityId((call.args as any).facilityName, facilityScope);
              const data = await queryWithScope(handler, call.args, facilityId, facilityScope);
              accumulatedData[call.name] = data;
              
              functionResponses.push({
                functionResponse: {
                  name: call.name,
                  response: data
                }
              });
            } catch (err: any) {
              logger.error(`[Chatbot] Function ${call.name} error`, { error: err.message });
              functionResponses.push({
                functionResponse: {
                  name: call.name,
                  response: { error: err.message }
                }
              });
            }
          }
        }
        
        // Send function responses back to the model
        if (functionResponses.length > 0) {
          result = await withRetry(() => chat.sendMessage(functionResponses));
          functionCalls = result.response.functionCalls();
        } else {
          break;
        }
      }

      const responseText = result.response.text();
      let answer = responseText;
      let chartType = null;

      // Try to parse JSON from the response text
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.answer) answer = parsed.answer;
          if (parsed.chartType) chartType = parsed.chartType;
        }
      } catch (e) {
        // Fallback to raw text if it didn't return valid JSON
      }

      const processingTimeMs = Date.now() - startTime;

      // Check if this is the first message in the conversation
      const existingCount = await ChatHistory.countDocuments({ userId, conversationId: convId });
      const isFirstMessage = existingCount === 0;

      // Generate title for new conversations
      let title = '';
      if (isFirstMessage) {
        title = await generateConversationTitle(message);
      }

      // Save history
      try {
        const validScope = facilityScope?.filter((id) => id && mongoose.Types.ObjectId.isValid(id));
        await ChatHistory.create({
          userId: new mongoose.Types.ObjectId(userId),
          conversationId: convId,
          title: isFirstMessage ? title : undefined,
          isFirstMessage,
          message,
          intent: Object.keys(accumulatedData).join(',') || 'general_query',
          entities: {},
          response: answer,
          responseData: accumulatedData,
          chartType: chartType || null,
          processingTimeMs,
          facilityScope: validScope && validScope.length > 0 ? validScope.map((id) => new mongoose.Types.ObjectId(id)) : [],
        });
      } catch (saveErr: any) {
        logger.error('[Chatbot] Failed to save chat history', { error: saveErr.message, userId });
      }

      // Save to cache (TTL 5 mins) if new conversation to save Gemini quota
      if (isNewConversation && cacheKey) {
        await setCache(cacheKey, {
          answer,
          data: accumulatedData,
          chartType,
        }, 300);
      }

      return {
        answer,
        data: accumulatedData,
        chartType,
        processingTimeMs,
        conversationId: convId,
      };
    } catch (error: any) {
      logger.error('[Chatbot] processQuery error', { error: error.message, stack: error.stack });
      if (error.message?.includes('429') || error.message?.includes('quota')) {
        throw new AppError('AI Chatbot đang quá tải. Vui lòng thử lại sau 30 giây.', 429);
      }
      if (error.message?.includes('503') || error.message?.includes('Service Unavailable') || error.message?.includes('high demand')) {
        throw new AppError('Hệ thống AI (Google Gemini) đang quá tải do lượng truy cập cao. Vui lòng thử lại sau 1-2 phút.', 503);
      }
      if (error.message?.includes('API_KEY')) {
        throw new AppError('Chatbot AI chưa được cấu hình. Vui lòng liên hệ Admin.', 503);
      }
      throw new AppError(`Chatbot gặp lỗi: ${error.message}`, 500);
    }
  }

  static async getChatHistory(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      ChatHistory.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ChatHistory.countDocuments({ userId }),
    ]);
    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  static async clearChatHistory(userId: string) {
    const result = await ChatHistory.deleteMany({ userId });
    return { deletedCount: result.deletedCount };
  }

  static getQuickReplies() {
    return QUICK_REPLIES;
  }

  static async getConversations(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    
    // Lấy danh sách conversationId duy nhất, kèm title từ tin nhắn đầu tiên
    const pipeline = [
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $sort: { createdAt: -1 } },
      { $group: { 
          _id: '$conversationId', 
          lastMessage: { $first: '$message' },
          lastResponse: { $first: '$response' },
          updatedAt: { $first: '$createdAt' },
          // Lấy title từ record có isFirstMessage = true (hoặc fallback record đầu tiên theo createdAt ASC)
          titles: { $push: { title: '$title', isFirst: '$isFirstMessage' } },
        }
      },
      { $sort: { updatedAt: -1 } },
      { $skip: skip },
      { $limit: limit }
    ];
    
    const countPipeline = [
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: '$conversationId' } },
      { $count: 'total' }
    ];

    const [data, countResult] = await Promise.all([
      ChatHistory.aggregate(pipeline as any),
      ChatHistory.aggregate(countPipeline as any)
    ]);

    const total = countResult[0]?.total || 0;

    return {
      data: data.map(d => {
        // Tìm title từ record đầu tiên (isFirstMessage = true)
        const firstMsgRecord = d.titles?.find((t: any) => t.isFirst && t.title);
        const title = firstMsgRecord?.title || d.lastMessage?.substring(0, 50) || 'Cuộc hội thoại';

        return {
          conversationId: d._id,
          title,
          lastMessage: d.lastMessage,
          lastResponse: d.lastResponse,
          updatedAt: d.updatedAt,
        };
      }),
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  static async getConversationMessages(userId: string, conversationId: string) {
    const data = await ChatHistory.find({ userId, conversationId })
      .sort({ createdAt: 1 })
      .lean();
    return data;
  }

  static async deleteConversation(userId: string, conversationId: string) {
    const result = await ChatHistory.deleteMany({ userId, conversationId });
    return { deletedCount: result.deletedCount };
  }

  /**
   * Đổi tên (title) của conversation.
   * Cập nhật title trên record đầu tiên (isFirstMessage = true).
   */
  static async renameConversation(userId: string, conversationId: string, newTitle: string) {
    // Tìm record đầu tiên của conversation
    const firstRecord = await ChatHistory.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      conversationId,
      isFirstMessage: true,
    });

    if (!firstRecord) {
      // Fallback: cập nhật record cũ nhất nếu không có isFirstMessage
      const oldestRecord = await ChatHistory.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        conversationId,
      }).sort({ createdAt: 1 });

      if (!oldestRecord) {
        throw new AppError('Không tìm thấy cuộc hội thoại này.', 404);
      }

      oldestRecord.title = newTitle.trim();
      oldestRecord.isFirstMessage = true;
      await oldestRecord.save();
      return { conversationId, title: newTitle.trim() };
    }

    firstRecord.title = newTitle.trim();
    await firstRecord.save();
    return { conversationId, title: newTitle.trim() };
  }
}
