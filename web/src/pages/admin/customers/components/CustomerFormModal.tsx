import { motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useEffect } from 'react';
import { X, RefreshCw, AlertCircle } from 'lucide-react';
import { User as UserType } from '../../../../types/user.types';
import { useCustomerForm } from '../hooks/useCustomerForm';
import { UserBasicInfoStep } from './steps/UserBasicInfoStep';

interface CustomerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: UserType;
  onSuccess: () => void;
}

export function CustomerFormModal({ isOpen, onClose, user, onSuccess }: CustomerFormModalProps) {
  const {
    isEdit,
    basicData,
    setBasicData,
    isSubmitting,
    error,
    handleSubmit,
    canSubmit,
  } = useCustomerForm(isOpen, user, onSuccess, onClose);

  useEffect(() => {
    if (!isOpen) {
      document.body.style.pointerEvents = '';
      document.body.style.overflow = '';
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={!isSubmitting ? onClose : undefined}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl flex flex-col"
        style={{ maxHeight: 'min(92vh, 700px)' }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 shrink-0 rounded-t-2xl">
          <div>
            <h2 className="text-lg font-bold text-[#062F28]">
              {isEdit ? 'Chỉnh sửa Khách hàng' : 'Thêm Khách hàng mới'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {isEdit ? user?.email : 'Điền thông tin để tạo tài khoản Khách hàng'}
            </p>
          </div>
          <button
            onClick={!isSubmitting ? onClose : undefined}
            disabled={isSubmitting}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-40"
          >
            <X size={20} />
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mx-6 mt-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 shrink-0">
            <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
            <p className="text-xs text-red-700 leading-relaxed">{error}</p>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          <UserBasicInfoStep
            isEdit={isEdit}
            basicData={basicData}
            onChange={setBasicData}
          />
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end items-center gap-3 bg-gray-50/50 shrink-0 rounded-b-2xl">
          <button
            type="button"
            onClick={!isSubmitting ? onClose : undefined}
            disabled={isSubmitting}
            className="px-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-70"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit() || isSubmitting}
            className={`px-5 py-2.5 text-sm font-bold rounded-xl transition-colors shadow-sm flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed bg-[#9FE870] hover:bg-[#9FE870]/90 text-[#062F28]`}
          >
            {isSubmitting ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                Đang lưu...
              </>
            ) : isEdit ? (
              'Lưu thay đổi'
            ) : (
              'Tạo khách hàng'
            )}
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
