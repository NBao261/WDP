import { useState } from 'react';
import { Map, ChevronDown, ChevronRight } from 'lucide-react';
import { OccupancyReportData } from '../../../../services/report.service';

interface Props {
  occupancyData: OccupancyReportData | null;
}

export function FacilityLeaderboardWidget({ occupancyData }: Props) {
  const floors = occupancyData?.byFloor || [];

  // Track which facilities are expanded
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleExpand = (facilityId: string) => {
    setExpanded((prev) => ({ ...prev, [facilityId]: !prev[facilityId] }));
  };

  type FacilityStat = {
    facilityId: string;
    facilityName: string;
    floorCount: number;
    total: number;
    occupied: number;
    reserved: number;
    available: number;
    floors: typeof floors;
  };

  // Group floors by facilityId using a plain Record
  const facilityRecord: Record<string, FacilityStat> = {};

  for (const floor of floors) {
    const existing = facilityRecord[floor.facilityId];
    if (existing) {
      existing.floorCount += 1;
      existing.total += floor.total;
      existing.occupied += floor.occupied;
      existing.reserved += floor.reserved;
      existing.available += floor.available;
      existing.floors.push(floor);
    } else {
      facilityRecord[floor.facilityId] = {
        facilityId: floor.facilityId,
        facilityName: floor.facilityName,
        floorCount: 1,
        total: floor.total,
        occupied: floor.occupied,
        reserved: floor.reserved,
        available: floor.available,
        floors: [floor],
      };
    }
  }

  // Sort by effective occupancy desc
  const facilities = Object.values(facilityRecord).sort((a, b) => {
    const rateA = a.total > 0 ? (a.occupied + a.reserved) / a.total : 0;
    const rateB = b.total > 0 ? (b.occupied + b.reserved) / b.total : 0;
    return rateB - rateA;
  });

  const barColor = (rate: number) =>
    rate >= 90 ? 'bg-rose-500' : rate >= 70 ? 'bg-amber-500' : 'bg-[#9FE870]';

  return (
    <div className="bg-white rounded-xl border border-[#e5e7eb] p-5 h-full flex flex-col shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-[#f0fdf4] flex items-center justify-center shrink-0">
          <Map size={16} className="text-[#72d645]" />
        </div>
        <div>
          <h2 className="text-[15px] font-semibold text-[#1a1a1a]">Hiện trạng khu vực</h2>
          <p className="text-[12px] text-[#6b7280]">Tỷ lệ lấp đầy theo từng toà nhà — bấm để xem chi tiết tầng</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto pr-1">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          {facilities.length > 0 ? (
            facilities.map((fac) => {
              const safeTotal = fac.total > 0 ? fac.total : 1;
              const rate = ((fac.occupied + fac.reserved) / safeTotal) * 100;
              const isOpen = !!expanded[fac.facilityId];

              return (
                <div
                  key={fac.facilityId}
                  className="rounded-lg border border-gray-100 overflow-hidden"
                >
                  {/* ── Facility header (clickable) ── */}
                  <button
                    onClick={() => toggleExpand(fac.facilityId)}
                    className="w-full text-left p-3 bg-gray-50/50 hover:bg-gray-100/60 transition-colors"
                  >
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        {isOpen ? (
                          <ChevronDown size={14} className="shrink-0 text-gray-400" />
                        ) : (
                          <ChevronRight size={14} className="shrink-0 text-gray-400" />
                        )}
                        <span className="text-[13px] font-bold text-[#1a1a1a] truncate">
                          {fac.facilityName}
                        </span>
                        <span className="shrink-0 text-[10px] font-medium text-[#6b7280] bg-gray-200/70 px-1.5 py-0.5 rounded-full">
                          {fac.floorCount} tầng
                        </span>
                      </div>
                      <span className="ml-2 shrink-0 text-[12px] font-semibold text-[#132c20] tabular-nums">
                        {rate.toFixed(1)}%
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden mt-1.5 ml-5">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ease-out ${barColor(rate)}`}
                        style={{ width: `${rate}%` }}
                      />
                    </div>

                    {/* Stats */}
                    <div className="flex justify-between items-center mt-1.5 text-[11px] text-[#6b7280] ml-5">
                      <span>
                        <strong className="text-[#1a1a1a]">{fac.occupied}</strong> đang dùng
                        {fac.reserved > 0 && (
                          <span className="ml-1 text-amber-600">
                            +<strong>{fac.reserved}</strong> đặt trước
                          </span>
                        )}
                      </span>
                      <span>
                        <strong className="text-[#1a1a1a]">{fac.available}</strong> trống
                        <span className="text-gray-400 ml-1">/ {fac.total}</span>
                      </span>
                    </div>
                  </button>

                  {/* ── Floor detail list (accordion) ── */}
                  {isOpen && (
                    <div className="border-t border-gray-100 bg-white divide-y divide-gray-50">
                      {fac.floors.map((fl) => {
                        const flTotal = fl.total > 0 ? fl.total : 1;
                        const flRate = ((fl.occupied + fl.reserved) / flTotal) * 100;
                        return (
                          <div key={fl.floorId} className="px-4 py-2.5">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-[12px] font-medium text-[#374151]">
                                {fl.floorName}
                              </span>
                              <span className="text-[11px] font-semibold text-[#132c20] tabular-nums">
                                {flRate.toFixed(1)}%
                              </span>
                            </div>
                            <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-700 ${barColor(flRate)}`}
                                style={{ width: `${flRate}%` }}
                              />
                            </div>
                            <div className="flex justify-between mt-1 text-[10px] text-[#9ca3af]">
                              <span>
                                <strong className="text-[#6b7280]">{fl.occupied}</strong> đang dùng
                                {fl.reserved > 0 && (
                                  <span className="ml-1 text-amber-500">
                                    +<strong>{fl.reserved}</strong>
                                  </span>
                                )}
                              </span>
                              <span>
                                <strong className="text-[#6b7280]">{fl.available}</strong> trống /{' '}
                                {fl.total}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-6 text-[13px] text-gray-500">
              Chưa có dữ liệu toà nhà
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
