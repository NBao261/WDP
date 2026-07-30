import { Users, ShieldCheck, Briefcase, User, Car, Building2 } from 'lucide-react';
import { UserStats } from '../hooks/useDashboard';

interface SystemStatsWidgetProps {
  userStats: UserStats | null;
}

interface RoleRowProps {
  icon: React.ReactNode;
  label: string;
  count: number;
  color: string;
  bgColor: string;
  max: number;
}

function RoleRow({ icon, label, count, color, bgColor, max }: RoleRowProps) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      {/* Icon */}
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: bgColor }}
      >
        <span style={{ color }}>{icon}</span>
      </div>
      {/* Label + bar */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[12px] font-medium text-[#374151]">{label}</span>
          <span className="text-[13px] font-bold text-[#1a1a1a] tabular-nums">{count}</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, backgroundColor: color }}
          />
        </div>
      </div>
    </div>
  );
}

export function SystemStatsWidget({ userStats }: SystemStatsWidgetProps) {
  const totalPersonnel = userStats
    ? userStats.totalAdmin + userStats.totalManager + userStats.totalStaff + userStats.totalDriver
    : 0;

  const roles = userStats
    ? [
        {
          label: 'Quản trị viên',
          count: userStats.totalAdmin,
          icon: <ShieldCheck size={14} />,
          color: '#8b5cf6',
          bgColor: '#f5f3ff',
        },
        {
          label: 'Quản lý',
          count: userStats.totalManager,
          icon: <Briefcase size={14} />,
          color: '#3b82f6',
          bgColor: '#eff6ff',
        },
        {
          label: 'Nhân viên',
          count: userStats.totalStaff,
          icon: <User size={14} />,
          color: '#22c55e',
          bgColor: '#f0fdf4',
        },
        {
          label: 'Tài xế',
          count: userStats.totalDriver,
          icon: <Car size={14} />,
          color: '#f97316',
          bgColor: '#fff7ed',
        },
      ]
    : [];

  return (
    <div className="bg-white rounded-2xl border border-[#e5e7eb] p-5 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[14px] font-semibold text-[#1a1a1a]">Nhân sự hệ thống</h2>
          <p className="text-[12px] text-[#6b7280] mt-0.5">Toàn bộ tài khoản đang hoạt động</p>
        </div>
        <div className="w-9 h-9 rounded-xl bg-[#f0fdf4] flex items-center justify-center">
          <Users size={17} className="text-[#72d645]" />
        </div>
      </div>

      {/* Total badge */}
      {userStats && (
        <div className="flex items-center justify-between bg-[#f9fafb] rounded-xl px-4 py-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#132c20] flex items-center justify-center">
              <Users size={14} className="text-white" />
            </div>
            <div>
              <p className="text-[11px] text-[#6b7280]">Tổng nhân sự</p>
              <p className="text-[20px] font-bold text-[#1a1a1a] leading-none">{totalPersonnel}</p>
            </div>
          </div>
          {/* Facilities */}
          <div className="flex items-center gap-2.5 border-l border-[#e5e7eb] pl-4">
            <div className="w-8 h-8 rounded-full bg-[#f0fdf4] flex items-center justify-center">
              <Building2 size={14} className="text-[#72d645]" />
            </div>
            <div>
              <p className="text-[11px] text-[#6b7280]">Cơ sở</p>
              <p className="text-[20px] font-bold text-[#1a1a1a] leading-none">{userStats.totalFacilities}</p>
            </div>
          </div>
        </div>
      )}

      {/* Role breakdown */}
      {userStats ? (
        <div className="flex flex-col flex-1 justify-around gap-2">
          {roles.map((role) => (
            <RoleRow
              key={role.label}
              icon={role.icon}
              label={role.label}
              count={role.count}
              color={role.color}
              bgColor={role.bgColor}
              max={totalPersonnel}
            />
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center flex-1">
          <p className="text-[13px] text-[#9ca3af]">Đang tải...</p>
        </div>
      )}
    </div>
  );
}
