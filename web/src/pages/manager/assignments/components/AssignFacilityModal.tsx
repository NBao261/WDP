import { X, MapPin, Square, CheckSquare, AlertCircle, CheckCircle } from 'lucide-react';
import { useState } from 'react';
import { userService } from '../../../../services/user.service';
import { User, AssignedFacility } from '../../../../types/user.types';
import { toast } from 'sonner';
import { Loading } from '../../../../components/ui/Loading';

interface AssignModalProps {
  staff: User;
  managerFacilities: AssignedFacility[];
  onClose: () => void;
  onSuccess: () => void;
}

export function AssignFacilityModal({
  staff,
  managerFacilities,
  onClose,
  onSuccess,
}: AssignModalProps) {
  const currentIds = (staff.assignedFacilities ?? []).map((f: any) =>
    typeof f === 'string' ? f : (f as AssignedFacility)._id
  );
  const [selectedIds, setSelectedIds] = useState<string[]>(currentIds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggle = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await userService.assignFacilities(staff._id, selectedIds);
      toast.success(`Đã cập nhật phân công tòa nhà cho ${staff.name}`);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Không thể lưu phân công. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col"
        style={{ maxHeight: '80vh' }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-[#060606]">Phân công Tòa nhà</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Nhân viên: <strong>{staff.name}</strong>
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        {/* Facility list */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
          {managerFacilities.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-6">
              Bạn chưa được phân công tòa nhà nào.
            </p>
          )}
          {managerFacilities.map((facility) => {
            const selected = selectedIds.includes(facility._id);
            return (
              <button
                key={facility._id}
                type="button"
                onClick={() => toggle(facility._id)}
                className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start gap-3 ${
                  selected
                    ? 'bg-[#f0f9dc] border-[#d7ee46]'
                    : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {selected ? (
                    <CheckSquare className="w-4 h-4 text-[#5a9e0f]" />
                  ) : (
                    <Square className="w-4 h-4 text-gray-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-xs text-[#060606] truncate">{facility.name}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
                    <p className="text-[11px] text-gray-400 truncate">{facility.address}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-4 mb-2 p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
          </div>
        )}

        {/* Footer */}
        <div className="px-4 py-3.5 border-t border-gray-100 flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 text-sm font-bold bg-[#d7ee46] text-[#060606] rounded-xl hover:bg-[#c4dc32] transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {saving ? (
              <Loading variant="inline" size="sm" text="Đang lưu..." />
            ) : (
              <>
                <CheckCircle size={14} /> Lưu phân công
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
