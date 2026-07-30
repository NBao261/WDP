import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import {
  X,
  User,
  Shield,
  Key,
  ChevronRight,
  ChevronLeft,
  Check,
  RefreshCw,
  AlertCircle,
  Building2,
} from 'lucide-react';
import { User as UserType } from '../../../../types/user.types';
import { useUserForm } from '../hooks/useUserForm';
import { UserBasicInfoStep } from './steps/UserBasicInfoStep';
import { UserRoleStep } from './steps/UserRoleStep';
import { UserPermissionsStep } from './steps/UserPermissionsStep';
import { UserAssignFacilitiesStep } from './steps/UserAssignFacilitiesStep';

interface StaffFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: UserType;
  onSuccess: () => void;
}

const STEP_ICONS = { 1: User, 2: Shield, 3: Key, 4: Building2 } as const;

export function StaffFormModal({ isOpen, onClose, user, onSuccess }: StaffFormModalProps) {
  const {
    isEdit,
    currentStep,
    setCurrentStep,
    basicData,
    setBasicData,
    selectedRole,
    setSelectedRole,
    selectedFacilityIds,
    setSelectedFacilityIds,
    customPerms,
    basePerms,
    handleTogglePerm,
    isLoadingPerms,
    isSubmitting,
    error,
    handleSubmit,
    fieldErrors,
    setFieldErrors,
    validateStep1,
    totalSteps,
    steps,
    showFacilityStep,
  } = useUserForm(isOpen, user, onSuccess, onClose);

  if (!isOpen) return null;

  // Xác định step ID của bước Assign Facilities
  const facilityStepId = isEdit ? 4 : 3;
  const isOnFacilityStep = showFacilityStep && currentStep === facilityStepId;

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
        className="relative w-full max-w-5xl bg-white rounded-2xl shadow-xl flex flex-col"
        style={{ maxHeight: 'min(92vh, 700px)' }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 shrink-0 rounded-t-2xl">
          <div>
            <h2 className="text-lg font-bold text-[#062F28]">
              {isEdit ? 'Chỉnh sửa tài khoản' : 'Thêm tài khoản mới'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {isEdit ? user?.email : 'Tạo tài khoản Manager hoặc Staff'}
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

        {/* Step Indicator */}
        <div className="px-6 py-3 border-b border-gray-100 bg-gray-50/30 shrink-0">
          <div className="flex items-center gap-1">
            {steps.map((step, idx) => {
              const stepId = step.id as keyof typeof STEP_ICONS;
              const Icon = STEP_ICONS[stepId] ?? User;
              const isActive = currentStep === step.id;
              const isDone = currentStep > step.id;
              return (
                <div key={step.id} className="flex items-center gap-1 flex-1">
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex-1
                      ${isActive ? 'bg-[#9FE870] text-[#062F28]' : isDone ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'}`}
                  >
                    {isDone ? <Check size={12} strokeWidth={3} /> : <Icon size={12} />}
                    <span className="hidden sm:inline">{step.label}</span>
                    <span className="sm:hidden">{step.id}</span>
                  </div>
                  {idx < steps.length - 1 && (
                    <ChevronRight size={14} className="text-gray-300 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mx-6 mt-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 shrink-0">
            <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
            <p className="text-xs text-red-700 leading-relaxed">{error}</p>
          </div>
        )}

        {/* Scrollable Step Content */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-6">
            <AnimatePresence mode="wait" initial={false}>
              {currentStep === 1 && (
                <motion.div
                  key="step-1"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.15 }}
                >
                  <UserBasicInfoStep
                    isEdit={isEdit}
                    basicData={basicData}
                    onChange={setBasicData}
                    fieldErrors={fieldErrors}
                    setFieldErrors={setFieldErrors}
                  />
                </motion.div>
              )}
              {currentStep === 2 && (
                <motion.div
                  key="step-2"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.15 }}
                >
                  <UserRoleStep
                    isEdit={isEdit}
                    selectedRole={selectedRole}
                    currentRoleLabel={user?.role}
                    onChange={setSelectedRole}
                  />
                </motion.div>
              )}
              {/* Step Quyền bổ sung — chỉ khi Edit */}
              {currentStep === 3 && isEdit && (
                <motion.div
                  key="step-3"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.15 }}
                >
                  <UserPermissionsStep
                    customPerms={customPerms}
                    basePerms={basePerms}
                    onToggle={handleTogglePerm}
                    isLoading={isLoadingPerms}
                  />
                </motion.div>
              )}
              {/* Step Phân công bãi xe — khi Create (step 3) hoặc Edit (step 4) */}
              {currentStep === facilityStepId && showFacilityStep && (
                <motion.div
                  key={`step-facility`}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.15 }}
                >
                  <UserAssignFacilitiesStep
                    selectedFacilityIds={selectedFacilityIds}
                    onChange={setSelectedFacilityIds}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-between items-center gap-3 bg-gray-50/50 shrink-0 rounded-b-2xl">
          <div>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep((s) => (s - 1) as 1 | 2 | 3 | 4)}
                disabled={isSubmitting}
                className="px-4 py-2.5 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <ChevronLeft size={16} />
                Quay lại
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={!isSubmitting ? onClose : undefined}
              disabled={isSubmitting}
              className="px-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-70"
            >
              Hủy
            </button>
            {currentStep < totalSteps ? (
              <button
                type="button"
                onClick={() => {
                  if (currentStep === 1) {
                    if (!validateStep1()) return;
                  }
                  setCurrentStep((s) => (s + 1) as 1 | 2 | 3 | 4);
                }}
                className="px-5 py-2.5 text-sm font-bold text-[#062F28] bg-[#9FE870] hover:bg-[#9FE870]/90 rounded-xl transition-colors shadow-sm flex items-center gap-1.5"
              >
                Tiếp theo
                <ChevronRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={`px-5 py-2.5 text-sm font-bold rounded-xl transition-colors shadow-sm flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed
                  ${
                    !isEdit && isOnFacilityStep && selectedFacilityIds.length === 0
                      ? 'bg-amber-200 hover:bg-amber-300 text-amber-900' // Cảnh báo nhẹ khi không gán
                      : 'bg-[#9FE870] hover:bg-[#9FE870]/90 text-[#062F28]'
                  }
                `}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Đang lưu...
                  </>
                ) : isEdit ? (
                  'Lưu thay đổi'
                ) : isOnFacilityStep && selectedFacilityIds.length === 0 ? (
                  'Tạo tài khoản (Chưa gán tòa nhà)'
                ) : isOnFacilityStep && selectedFacilityIds.length > 0 ? (
                  'Phân công & Tạo tài khoản'
                ) : (
                  'Tạo tài khoản'
                )}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
