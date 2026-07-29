import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { publicService } from '../../../../services/public.service';
import { PricingPlan } from '../../../../services/pricing.service';
import { X, Check } from 'lucide-react';

import { Loading } from '../../../../components/ui/Loading';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  facilityId: string | null;
  facilityName: string;
}

export const PricingModal: React.FC<PricingModalProps> = ({
  isOpen,
  onClose,
  facilityId,
  facilityName,
}) => {
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && facilityId) {
      setLoading(true);
      publicService
        .getPricing(facilityId)
        .then((res) => setPlans(res.data || []))
        .catch((err) => console.error(err))
        .finally(() => setLoading(false));
    }
  }, [isOpen, facilityId]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        />

        {/* Modal Content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-white z-10 relative shadow-sm">
            <div>
              <h3 className="text-2xl font-bold text-slate-900 font-outfit">Bảng Giá Dịch Vụ</h3>
              <p className="text-sm font-medium text-slate-500 mt-1">{facilityName}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2.5 bg-slate-50 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-all"
            >
              <X size={20} strokeWidth={2.5} />
            </button>
          </div>

          {/* Body */}
          <div className="p-8 overflow-y-auto custom-scrollbar bg-slate-50/50">
            {loading ? (
              <Loading text="Đang tải bảng giá..." />
            ) : plans.length === 0 ? (
              <div className="text-center py-12 text-slate-500 bg-white rounded-2xl border border-dashed border-slate-200">
                Chưa có bảng giá nào được thiết lập cho bãi xe này.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {plans.map((plan) => (
                  <div
                    key={plan._id}
                    className="bg-white border border-slate-200 rounded-2xl p-6 hover:border-accent-dark/40 hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="text-lg font-bold text-slate-900">{plan.name}</h4>
                      <span className="bg-accent/20 text-accent-dark text-xs font-bold px-3 py-1 rounded-full">
                        {(plan.vehicleTypeId as any)?.name}
                      </span>
                    </div>
                    <div className="mb-5 pb-5 border-b border-slate-100">
                      <span className="text-3xl font-black text-emerald-600 tracking-tight">
                        {plan.rates?.[0]?.amount?.toLocaleString('vi-VN') || 0}₫
                      </span>
                      <span className="text-slate-500 text-sm font-medium">
                        {' '}
                        / {plan.firstBlockHours ? plan.firstBlockHours * 60 : 0} phút đầu
                      </span>
                    </div>
                    <ul className="space-y-3 text-sm font-medium text-slate-600">
                      <li className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                          <Check size={12} className="text-emerald-600" strokeWidth={3} />
                        </div>
                        Quá giờ: {plan.overtimeFeePerHour?.toLocaleString('vi-VN') || 0}₫ / giờ
                      </li>
                      <li className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                          <Check size={12} className="text-emerald-600" strokeWidth={3} />
                        </div>
                        Tối đa {plan.maxDailyFee?.toLocaleString('vi-VN') || 0}₫ / ngày
                      </li>
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
