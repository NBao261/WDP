import { X, AlertTriangle, Loader2 } from 'lucide-react';
import { useCreateExceptionLogic } from './useCreateExceptionLogic';
import { CreateExceptionForm } from './CreateExceptionForm';

interface CreateExceptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateExceptionModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateExceptionModalProps) {
  const logic = useCreateExceptionLogic(onClose, onSuccess);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[500px] overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-[#e8e9e8] flex justify-between items-center bg-gray-50/50">
          <div className="flex items-center gap-2 text-[#ef4444]">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="text-[18px] font-bold">Tạo Báo Cáo Sự Cố Mới</h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#6b6b6b] hover:text-black p-1.5 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <CreateExceptionForm logic={logic} />

        <div className="px-6 py-4 border-t border-[#e8e9e8] bg-gray-50/50 flex gap-3">
          <button
            onClick={onClose}
            disabled={logic.isSubmitting}
            className="flex-1 h-11 border border-[#e8e9e8] bg-white rounded-[8px] text-[#060606] font-bold hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            onClick={logic.handleSubmit}
            disabled={logic.isSubmitting || !logic.foundSession}
            className="flex-[2] h-11 bg-[#ef4444] text-white font-bold rounded-[8px] hover:bg-red-600 transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {logic.isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />} Tạo Sự Cố
          </button>
        </div>
      </div>
    </div>
  );
}
