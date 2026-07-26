// ─── Validation Schemas ────────────────────────────────
// Barrel export cho tất cả validation schemas

// Common (dùng chung)
export * from './common.validation';

// Auth (FR-18.1: Register, Login, RefreshToken)
export * from './auth.validation';

// User (FR-18: User CRUD)
export * from './user.validation';

// Facility (FR-1: Tòa nhà)
export * from './facility.validation';

// VehicleType (FR-2: Loại phương tiện)
export * from './vehicleType.validation';

// Floor (FR-3: Phân tầng)
export * from './floor.validation';

// Slot (FR-4: Slot đỗ xe)
export * from './slot.validation';

// Pricing (FR-5: Bảng giá)
export * from './pricing.validation';

// Role (FR-19: Phân quyền)
export * from './role.validation';

// Config (FR-20: Cấu hình hệ thống)
export * from './config.validation';

// Session (FR-9: Lượt gửi xe)
export * from './session.validation';

// Exception (FR-11: Ngoại lệ)
export * from './exception.validation';

// Feedback (FR-13: Phản hồi)
export * from './feedback.validation';

// Reservation (FR-7: Đặt chỗ)
export * from './reservation.validation';

// Payment (FR-10: Thanh toán)
export * from './payment.validation';

// AI Chatbot (FR-6.5: AI)
export * from './ai.validation';

// Report (FR-6: Báo cáo)
export * from './report.validation';
