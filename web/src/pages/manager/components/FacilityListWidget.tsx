import { Building2, Users, ArrowUpDown } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, AssignedFacility } from '../../../types/user.types';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '../../../components/ui/table';

interface FacilityListWidgetProps {
  managerFacilities: AssignedFacility[];
  staffList: User[];
  facilityRevenues: Record<string, number>;
}

export function FacilityListWidget({ managerFacilities, staffList, facilityRevenues }: FacilityListWidgetProps) {
  const navigate = useNavigate();
  const [sortAsc, setSortAsc] = useState(false);

  // Preload FacilitiesPage khi hover để giảm delay khi click
  const preloadFacilities = () => {
    import('../../shared/facilities/FacilitiesPage');
  };

  // Build facility data with revenue
  const facilityRows = useMemo(() => {
    const rows = managerFacilities.map((facility) => {
      const staffCount = staffList.filter((s) =>
        s.assignedFacilities?.some(
          (f: any) => (typeof f === 'string' ? f : (f as AssignedFacility)._id) === facility._id
        )
      ).length;

      let revenue = facilityRevenues[facility._id] || 0;

      return {
        ...facility,
        staffCount,
        revenue,
      };
    });

    // Sort by revenue (descending by default)
    return rows.sort((a, b) => (sortAsc ? a.revenue - b.revenue : b.revenue - a.revenue));
  }, [managerFacilities, staffList, facilityRevenues, sortAsc]);

  return (
    <div
      className="bg-white rounded-xl border border-gray-100 shadow-sm h-[400px] flex flex-col overflow-hidden"
      onMouseEnter={preloadFacilities}
    >
      <div className="px-5 pt-5 pb-3 flex-shrink-0">
        <h2 className="text-[16px] font-bold text-gray-900">
          Danh sách tòa nhà ({managerFacilities.length})
        </h2>
        <p className="text-[12px] text-gray-400 mt-0.5">Sắp xếp theo doanh thu</p>
      </div>

      <div className="flex-1 overflow-auto px-3 min-h-0">
        {managerFacilities.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <Building2 className="w-6 h-6 text-[#9FE870]" />
            <p className="text-[13px] text-gray-400">Chưa có tòa nhà nào</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[12px] py-2 px-3 w-[40px]">#</TableHead>
                <TableHead className="text-[12px] py-2 px-3">Tòa nhà</TableHead>
                <TableHead className="text-[12px] py-2 px-3 text-center">NV</TableHead>
                <TableHead className="text-[12px] py-2 px-3 text-center">Trạng thái</TableHead>
                <TableHead className="text-[12px] py-2 px-3 text-right">
                  <button
                    onClick={() => setSortAsc(!sortAsc)}
                    className="inline-flex items-center gap-1 hover:text-gray-900 transition-colors"
                  >
                    Doanh thu
                    <ArrowUpDown size={12} />
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {facilityRows.map((facility, idx) => (
                <TableRow
                  key={facility._id}
                  className="cursor-pointer group"
                  onClick={() =>
                    navigate('/manager/facilities', { state: { selectedFacilityId: facility._id } })
                  }
                >
                  <TableCell className="text-[12px] py-2.5 px-3 text-gray-400 tabular-nums">
                    {idx + 1}
                  </TableCell>
                  <TableCell className="text-[12px] py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: 'rgba(159,232,112,0.15)' }}
                      >
                        <Building2 size={13} style={{ color: '#9FE870' }} />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-800 truncate max-w-[140px]">
                          {facility.name}
                        </div>
                        <div className="text-[11px] text-gray-400">
                          {facility.openTime} – {facility.closeTime}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-[12px] py-2.5 px-3 text-center">
                    <div className="flex items-center justify-center gap-1 text-gray-500">
                      <Users size={12} />
                      <span className="tabular-nums">{facility.staffCount}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-[12px] py-2.5 px-3 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider`}
                      style={facility.status === 'active'
                        ? { background: 'rgba(159,232,112,0.15)', color: '#82C94E' }
                        : { background: '#f0f1f0', color: '#6b6e6b' }
                      }
                    >
                      {facility.status === 'active' ? 'Hoạt động' : 'Ngừng'}
                    </span>
                  </TableCell>
                  <TableCell className="text-[12px] py-2.5 px-3 text-right font-semibold text-gray-800 tabular-nums whitespace-nowrap">
                    {facility.revenue.toLocaleString('vi-VN')} đ
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
