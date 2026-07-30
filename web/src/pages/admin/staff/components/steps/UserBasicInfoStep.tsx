import { User, Mail, Phone, Shield } from 'lucide-react';

interface BasicData {
  name: string;
  email: string;
  phone: string;
  password: string;
}

interface UserBasicInfoStepProps {
  isEdit: boolean;
  basicData: BasicData;
  onChange: (updater: (prev: BasicData) => BasicData) => void;
  fieldErrors: Record<string, string>;
  setFieldErrors: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
}

const inputClass =
  'w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#9FE870] focus:bg-white transition-all';

/**
 * Step 1 of UserFormModal: collects name, email (create only), phone, password (create only).
 * Animation handled by parent UserFormModal motion.div wrapper.
 */
export function UserBasicInfoStep({
  isEdit,
  basicData,
  onChange,
  fieldErrors,
  setFieldErrors,
}: UserBasicInfoStepProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {/* Name */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          Họ và tên <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            required
            value={basicData.name}
            onChange={(e) => {
              onChange((p) => ({ ...p, name: e.target.value }));
              if (fieldErrors.name) setFieldErrors((p) => ({ ...p, name: '' }));
            }}
            className={`${inputClass} ${fieldErrors.name ? 'border-red-300 focus:ring-red-300' : ''}`}
            placeholder="Nhập họ và tên..."
          />
        </div>
        {fieldErrors.name && (
          <p className="text-xs text-red-500 mt-1.5">{fieldErrors.name}</p>
        )}
      </div>

      {/* Email — editable only on create */}
      {!isEdit ? (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Email đăng nhập <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="email"
              required
              value={basicData.email}
              onChange={(e) => {
                onChange((p) => ({ ...p, email: e.target.value }));
                if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: '' }));
              }}
              className={`${inputClass} ${fieldErrors.email ? 'border-red-300 focus:ring-red-300' : ''}`}
              placeholder="example@company.com"
            />
          </div>
          {fieldErrors.email && (
            <p className="text-xs text-red-500 mt-1.5">{fieldErrors.email}</p>
          )}
        </div>
      ) : (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Email đăng nhập
          </label>
          <div className="relative">
            <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
            <input
              type="email"
              disabled
              value={basicData.email}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-400 cursor-not-allowed"
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">Email không thể thay đổi sau khi tạo.</p>
        </div>
      )}

      {/* Phone */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          Số điện thoại <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="tel"
            required
            value={basicData.phone}
            onChange={(e) => {
              onChange((p) => ({ ...p, phone: e.target.value }));
              if (fieldErrors.phone) setFieldErrors((p) => ({ ...p, phone: '' }));
            }}
            className={`${inputClass} ${fieldErrors.phone ? 'border-red-300 focus:ring-red-300' : ''}`}
            placeholder="09xx xxx xxx"
          />
        </div>
        {fieldErrors.phone && (
          <p className="text-xs text-red-500 mt-1.5">{fieldErrors.phone}</p>
        )}
      </div>

      {/* Password — create only */}
      {!isEdit && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Mật khẩu khởi tạo <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Shield size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="password"
              required
              minLength={6}
              value={basicData.password}
              onChange={(e) => {
                onChange((p) => ({ ...p, password: e.target.value }));
                if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: '' }));
              }}
              className={`${inputClass} ${fieldErrors.password ? 'border-red-300 focus:ring-red-300' : ''}`}
              placeholder="Tối thiểu 6 ký tự"
            />
          </div>
          {fieldErrors.password ? (
            <p className="text-xs text-red-500 mt-1.5">{fieldErrors.password}</p>
          ) : (
            <p className="text-xs text-gray-400 mt-1.5">Mật khẩu cấp lần đầu cho nhân viên.</p>
          )}
        </div>
      )}
    </div>
  );
}
