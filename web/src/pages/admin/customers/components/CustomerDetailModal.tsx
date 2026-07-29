import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  X,
  User,
  Mail,
  Phone,
  Calendar,
  Lock,
  Unlock,
  CheckCircle2,
  AlertCircle,
  CarFront,
} from 'lucide-react';
import { User as UserType } from '../../../../types/user.types';
import { userService } from '../../../../services/user.service';

interface CustomerDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserType | null;
  onRefresh: () => void;
}

export function CustomerDetailModal({
  isOpen,
  onClose,
  user,
  onRefresh,
}: CustomerDetailModalProps) {
  const [isActionLoading, setIsActionLoading] = useState(false);

  const handleToggleLock = async () => {
    if (!user) return;
    setIsActionLoading(true);
    try {
      if (user.status === 'locked') {
        await userService.unlockUser(user._id);
        toast.success('Đã mở khóa tài khoản thành công');
      } else {
        await userService.lockUser(user._id);
        toast.success('Đã khóa tài khoản thành công');
      }
      onRefresh(); // Trigger refresh in parent to update status
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Thao tác thất bại');
    } finally {
      setIsActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <div className="flex items-center gap-1 text-emerald-600 text-xs font-bold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
            <CheckCircle2 size={14} /> Đang hoạt động
          </div>
        );
      case 'locked':
        return (
          <div className="flex items-center gap-1 text-red-600 text-xs font-bold bg-red-50 px-2.5 py-1 rounded-full border border-red-100">
            <Lock size={14} /> Bị khóa
          </div>
        );
      case 'inactive':
        return (
          <div className="flex items-center gap-1 text-gray-500 text-xs font-bold bg-gray-50 px-2.5 py-1 rounded-full border border-gray-100">
            <AlertCircle size={14} /> Chưa kích hoạt
          </div>
        );
      default:
        return <div className="text-gray-500">{status}</div>;
    }
  };

  if (!user || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 outline-none">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />

      {/* Modal Content */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden outline-none flex flex-col"
      >
        {/* Header Graphic */}
        <div className="h-32 bg-gradient-to-br from-[#062F28] to-[#124D43] relative overflow-hidden">
          <div className="absolute right-0 top-0 w-64 h-full bg-gradient-to-l from-white/10 to-transparent pointer-events-none"></div>
          <CarFront
            size={120}
            className="absolute -right-6 -bottom-6 text-white/10 pointer-events-none transform -rotate-12"
          />

          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors outline-none"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="px-8 pb-8 pt-0 relative">
          {/* Avatar (Overlapping header) */}
          <div className="w-24 h-24 bg-white rounded-2xl flex items-center justify-center shadow-lg border-4 border-white text-[#062F28] flex-shrink-0 -mt-12 mb-4 relative z-10">
            <User size={48} className="text-gray-300" />
          </div>

          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-2xl font-bold text-gray-900">{user.name}</h2>
            {getStatusBadge(user.status)}
          </div>

          <div className="text-gray-500 text-sm mb-6 flex items-center gap-2">
            <Calendar size={14} />
            Thành viên từ: {format(new Date(user.createdAt), 'dd/MM/yyyy')}
          </div>

          <div className="space-y-4 mb-8 bg-gray-50 p-4 rounded-2xl border border-gray-100">
            <div className="flex items-center gap-3 text-sm text-gray-700">
              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm text-gray-400">
                <Phone size={16} />
              </div>
              <div className="font-medium">{user.phone}</div>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-700">
              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm text-gray-400">
                <Mail size={16} />
              </div>
              <div className="font-medium">{user.email}</div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 px-4 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold text-sm transition-colors outline-none focus:ring-2 focus:ring-gray-200 focus:ring-offset-2"
            >
              Đóng
            </button>
            {user.status === 'locked' ? (
              <button
                onClick={handleToggleLock}
                disabled={isActionLoading}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl hover:bg-emerald-100 font-semibold text-sm transition-colors outline-none focus:ring-2 focus:ring-emerald-200 focus:ring-offset-2 disabled:opacity-50"
              >
                <Unlock size={18} /> Mở khóa
              </button>
            ) : (
              <button
                onClick={handleToggleLock}
                disabled={isActionLoading}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-red-50 text-red-600 border border-red-200 rounded-xl hover:bg-red-100 font-semibold text-sm transition-colors outline-none focus:ring-2 focus:ring-red-200 focus:ring-offset-2 disabled:opacity-50"
              >
                <Lock size={18} /> Khóa tài khoản
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
