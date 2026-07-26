// ─── Permission Constants ──────────────────────────────
// Danh sách quyền chuẩn hóa theo SRS Permission Matrix (mục 3.1 → 3.8)
// Format: module:action
// FR-19.2: Nhóm quyền × Actions (Read, Create, Update, Delete, Export)

export const PERMISSIONS = {
  // ── 3.1 Module Quản lý Tòa nhà & Cơ sở vật chất ──
  FACILITY_READ: 'facility:read',
  FACILITY_CREATE: 'facility:create',
  FACILITY_UPDATE: 'facility:update',
  FACILITY_DELETE: 'facility:delete',
  FLOOR_MANAGE: 'floor:manage',
  VEHICLE_TYPE_READ: 'vehicle_type:read',
  VEHICLE_TYPE_MANAGE: 'vehicle_type:manage',

  // ── 3.2 Module Quản lý Slot đỗ xe ──
  SLOT_READ: 'slot:read',
  SLOT_CREATE: 'slot:create',
  SLOT_UPDATE_STATUS: 'slot:update_status',
  SLOT_DELETE: 'slot:delete',
  SLOT_RESERVE: 'slot:reserve', // Driver only

  // ── 3.3 Module Bảng giá & Chính sách phí ──
  PRICING_READ: 'pricing:read',
  PRICING_CREATE: 'pricing:create',
  PRICING_UPDATE: 'pricing:update',
  PRICING_DELETE: 'pricing:delete',

  // ── 3.4 Module Lượt gửi xe (Parking Session) ──
  SESSION_CREATE: 'session:create',
  SESSION_READ: 'session:read',
  SESSION_CLOSE: 'session:close',
  SESSION_EXCEPTION: 'session:exception',

  // ── 3.5 Module Thanh toán ──
  PAYMENT_COLLECT: 'payment:collect',
  PAYMENT_ONLINE: 'payment:online',
  PAYMENT_HISTORY: 'payment:history',

  // ── 3.6 Module Báo cáo & Thống kê ──
  REPORT_REVENUE: 'report:revenue',
  REPORT_TRAFFIC: 'report:traffic',
  REPORT_OCCUPANCY: 'report:occupancy',
  REPORT_PEAK_HOURS: 'report:peak_hours',
  REPORT_EXCEPTIONS: 'report:exceptions',

  // ── 3.7 Module Quản trị hệ thống ──
  USER_MANAGE: 'user:manage',
  USER_ASSIGN_FACILITY: 'user:assign_facility',
  ROLE_MANAGE: 'role:manage',
  CONFIG_MANAGE: 'config:manage',
  LOG_VIEW: 'log:view',

  // ── 3.8 Module Phản hồi & Sự cố ──
  FEEDBACK_CREATE: 'feedback:create',
  FEEDBACK_READ: 'feedback:read',
  FEEDBACK_PROCESS: 'feedback:process',

  // ── 3.9 Module AI Features ──
  AI_CHATBOT: 'ai:chatbot',
  AI_PRICING_SUGGESTION: 'ai:pricing_suggestion',
  AI_MANAGE: 'ai:manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// ─── All permissions as flat array ─────────────────────
export const ALL_PERMISSIONS: string[] = Object.values(PERMISSIONS);

// ─── Default permissions per role ──────────────────────
// Mapped from SRS Permission Matrix (mục 3.1 → 3.8)
// PQ-02: Admin kế thừa toàn bộ quyền Manager; Manager KHÔNG kế thừa Staff

export const DEFAULT_PERMISSIONS: Record<string, string[]> = {
  // ACT-04: System Administrator — full access (trừ driver-only actions)
  admin: [
    // Tòa nhà
    PERMISSIONS.FACILITY_READ,
    PERMISSIONS.FACILITY_CREATE,
    PERMISSIONS.FACILITY_UPDATE,
    PERMISSIONS.FACILITY_DELETE,
    PERMISSIONS.FLOOR_MANAGE,
    PERMISSIONS.VEHICLE_TYPE_READ,
    PERMISSIONS.VEHICLE_TYPE_MANAGE,
    // Slot
    PERMISSIONS.SLOT_READ,
    PERMISSIONS.SLOT_CREATE,
    PERMISSIONS.SLOT_UPDATE_STATUS,
    PERMISSIONS.SLOT_DELETE,
    // Bảng giá
    PERMISSIONS.PRICING_READ,
    PERMISSIONS.PRICING_CREATE,
    PERMISSIONS.PRICING_UPDATE,
    PERMISSIONS.PRICING_DELETE,
    // Session (xem + xử lý ngoại lệ, KHÔNG tạo/kết thúc session)
    PERMISSIONS.SESSION_READ,
    PERMISSIONS.SESSION_EXCEPTION,
    // Thanh toán (xem lịch sử)
    PERMISSIONS.PAYMENT_HISTORY,
    // Báo cáo (full)
    PERMISSIONS.REPORT_REVENUE,
    PERMISSIONS.REPORT_TRAFFIC,
    PERMISSIONS.REPORT_OCCUPANCY,
    PERMISSIONS.REPORT_PEAK_HOURS,
    PERMISSIONS.REPORT_EXCEPTIONS,
    // Quản trị hệ thống (full)
    PERMISSIONS.USER_MANAGE,
    PERMISSIONS.USER_ASSIGN_FACILITY,
    PERMISSIONS.ROLE_MANAGE,
    PERMISSIONS.CONFIG_MANAGE,
    PERMISSIONS.LOG_VIEW,
    // Phản hồi (xem + xử lý)
    PERMISSIONS.FEEDBACK_READ,
    PERMISSIONS.FEEDBACK_PROCESS,
    // AI Features (full)
    PERMISSIONS.AI_CHATBOT,
    PERMISSIONS.AI_PRICING_SUGGESTION,
    PERMISSIONS.AI_MANAGE,
  ],

  // ACT-01: Parking Manager — quản lý vận hành, KHÔNG quản trị hệ thống
  manager: [
    // Tòa nhà (full CRUD)
    PERMISSIONS.FACILITY_READ,
    PERMISSIONS.FACILITY_CREATE,
    PERMISSIONS.FACILITY_UPDATE,
    PERMISSIONS.FACILITY_DELETE,
    PERMISSIONS.FLOOR_MANAGE,
    PERMISSIONS.VEHICLE_TYPE_READ,
    PERMISSIONS.VEHICLE_TYPE_MANAGE,
    // Slot (full CRUD)
    PERMISSIONS.SLOT_READ,
    PERMISSIONS.SLOT_CREATE,
    PERMISSIONS.SLOT_UPDATE_STATUS,
    PERMISSIONS.SLOT_DELETE,
    // Bảng giá (full CRUD)
    PERMISSIONS.PRICING_READ,
    PERMISSIONS.PRICING_CREATE,
    PERMISSIONS.PRICING_UPDATE,
    PERMISSIONS.PRICING_DELETE,
    // Session (xem + xử lý ngoại lệ)
    PERMISSIONS.SESSION_READ,
    PERMISSIONS.SESSION_EXCEPTION,
    // Thanh toán (xem lịch sử)
    PERMISSIONS.PAYMENT_HISTORY,
    // Báo cáo (full)
    PERMISSIONS.REPORT_REVENUE,
    PERMISSIONS.REPORT_TRAFFIC,
    PERMISSIONS.REPORT_OCCUPANCY,
    PERMISSIONS.REPORT_PEAK_HOURS,
    PERMISSIONS.REPORT_EXCEPTIONS,
    // Phản hồi (xem + xử lý)
    PERMISSIONS.FEEDBACK_READ,
    PERMISSIONS.FEEDBACK_PROCESS,
    // Quản lý nhân sự (phân công tòa nhà cho Staff — FR-18.6)
    PERMISSIONS.USER_ASSIGN_FACILITY,
    // AI Features
    PERMISSIONS.AI_CHATBOT,
    PERMISSIONS.AI_PRICING_SUGGESTION,
    PERMISSIONS.AI_MANAGE,
    // Audit logs (xem)
    PERMISSIONS.LOG_VIEW,
  ],

  // ACT-02: Parking Staff — vận hành trực tiếp tại bãi xe
  staff: [
    // Tòa nhà (chỉ xem)
    PERMISSIONS.FACILITY_READ,
    // Loại xe (chỉ xem)
    PERMISSIONS.VEHICLE_TYPE_READ,
    // Slot (xem + cập nhật trạng thái giới hạn)
    PERMISSIONS.SLOT_READ,
    PERMISSIONS.SLOT_UPDATE_STATUS, // giới hạn: chỉ chuyển sang maintenance
    // Bảng giá (chỉ xem)
    PERMISSIONS.PRICING_READ,
    // Session (tạo + xem + kết thúc + xử lý ngoại lệ)
    PERMISSIONS.SESSION_CREATE,
    PERMISSIONS.SESSION_READ,
    PERMISSIONS.SESSION_CLOSE,
    PERMISSIONS.SESSION_EXCEPTION,
    // Thanh toán (thu phí tại bãi + xem lịch sử ca mình)
    PERMISSIONS.PAYMENT_COLLECT,
    PERMISSIONS.PAYMENT_HISTORY,
    // Phản hồi (xem liên quan)
    PERMISSIONS.FEEDBACK_READ,
  ],

  // ACT-03: Parking User / Driver — người gửi xe
  driver: [
    // Tòa nhà (xem giới hạn — qua public API)
    PERMISSIONS.FACILITY_READ,
    // Loại xe (chỉ xem)
    PERMISSIONS.VEHICLE_TYPE_READ,
    // Slot (xem số lượng trống + đặt chỗ)
    PERMISSIONS.SLOT_READ,
    PERMISSIONS.SLOT_RESERVE,
    // Bảng giá (xem)
    PERMISSIONS.PRICING_READ,
    // Session (xem của mình + tạo báo cáo sự cố)
    PERMISSIONS.SESSION_READ,
    PERMISSIONS.SESSION_EXCEPTION,
    // Thanh toán (online + xem lịch sử của mình)
    PERMISSIONS.PAYMENT_ONLINE,
    PERMISSIONS.PAYMENT_HISTORY,
    // Phản hồi (tạo + xem của mình)
    PERMISSIONS.FEEDBACK_CREATE,
    PERMISSIONS.FEEDBACK_READ,
  ],
};
