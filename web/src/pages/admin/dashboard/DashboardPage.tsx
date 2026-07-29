import { useState } from 'react';
import { useAuthStore } from '../../../store';
import {
  RefreshCw,
  Download,
  FileSpreadsheet,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { useDashboard, TIME_FILTER_OPTIONS, TimeFilter } from './hooks/useDashboard';
import { DashboardCards } from './components/DashboardCards';
import { DashboardCharts } from './components/DashboardCharts';
import { SystemStatsWidget } from './components/SystemStatsWidget';
import { RevenueBreakdownWidget } from './components/RevenueBreakdownWidget';
import { FacilityLeaderboardWidget } from './components/FacilityLeaderboardWidget';
import { ExportConfirmModal } from './components/ExportConfirmModal';
import { CustomDropdown } from '../../../components/ui/CustomDropdown';
import { reportService } from '../../../services/report.service';
import { format, subDays, startOfMonth, startOfYear } from 'date-fns';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 300, damping: 24 },
  },
};

/* ── Helpers ── */

function getExportDateRange(filter: TimeFilter): {
  startDate: string;
  endDate: string;
  groupBy: 'day' | 'week' | 'month';
} {
  const now = new Date();
  const endDate = format(now, 'yyyy-MM-dd');
  switch (filter) {
    case 'today':
      return { startDate: endDate, endDate, groupBy: 'day' };
    case 'month':
      return { startDate: format(startOfMonth(now), 'yyyy-MM-dd'), endDate, groupBy: 'day' };
    case 'year':
      return { startDate: format(startOfYear(now), 'yyyy-MM-dd'), endDate, groupBy: 'month' };
    case 'week':
    default:
      return { startDate: format(subDays(now, 6), 'yyyy-MM-dd'), endDate, groupBy: 'day' };
  }
}

/* ── Main Page ── */

export default function DashboardPage() {
  const { user } = useAuthStore();
  const {
    isLoading,
    timeFilter,
    setTimeFilter,
    trafficData,
    revenueData,
    occupancyData,
    peakHoursData,
    userStats,
    fetchData,
  } = useDashboard();

  const [exporting, setExporting] = useState(false);
  const [exportModalState, setExportModalState] = useState<{
    isOpen: boolean;
    format: 'excel' | 'pdf' | null;
  }>({ isOpen: false, format: null });

  const handleOpenExportModal = (fmt: 'excel' | 'pdf') => {
    setExportModalState({ isOpen: true, format: fmt });
  };

  const confirmExport = async () => {
    if (!exportModalState.format) return;
    const fmt = exportModalState.format;
    try {
      setExporting(true);
      toast.info(`Đang xuất báo cáo ra ${fmt === 'pdf' ? 'PDF' : 'Excel'}...`);
      const { startDate, endDate, groupBy } = getExportDateRange(timeFilter);
      const blob = await reportService.exportReport({
        reportType: 'comprehensive',
        format: fmt,
        startDate,
        endDate,
        groupBy,
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `dashboard_admin_${Date.now()}.${fmt === 'pdf' ? 'pdf' : 'xlsx'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Xuất báo cáo thành công!');
      setExportModalState({ isOpen: false, format: null });
    } catch {
      toast.error('Lỗi khi xuất báo cáo');
    } finally {
      setExporting(false);
    }
  };

  return (
    <motion.div 
      className="space-y-6 w-full pb-12"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* ═══ HEADER BAR ═══ */}
      <motion.header variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[#1a1a1a] font-bold text-[22px] tracking-tight">Tổng quan hệ thống</h1>
          <p className="text-[13px] text-[#6b7280] mt-0.5">
            Xin chào,{' '}
            <span className="font-semibold text-[#062F28]">{user?.name}</span>
            {' '}— {new Date().toLocaleDateString('vi-VN', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Time Filter */}
          <CustomDropdown
            value={timeFilter}
            onChange={(v) => setTimeFilter(v as TimeFilter)}
            options={TIME_FILTER_OPTIONS as unknown as { value: string; label: string }[]}
          />

          {/* Refresh */}
          <button
            onClick={fetchData}
            disabled={isLoading}
            aria-label="Tải lại dữ liệu"
            className="h-10 w-10 flex items-center justify-center bg-white border border-gray-200 text-gray-600 rounded-[10px] hover:bg-gray-50 hover:border-gray-300 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          </button>

          {/* Export Buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => handleOpenExportModal('excel')}
              disabled={exporting || isLoading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-[10px] bg-white border-[1.5px] border-gray-200 text-[#1a1a1a] text-[14px] font-medium hover:opacity-[0.88] active:scale-[0.97] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileSpreadsheet size={17} />
              Excel
            </button>
            <button
              onClick={() => handleOpenExportModal('pdf')}
              disabled={exporting || isLoading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-[10px] bg-[#a6e676] text-[#132c20] text-[14px] font-medium hover:opacity-[0.88] active:scale-[0.97] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={17} />
              PDF
            </button>
          </div>
        </div>
      </motion.header>

      {/* ═══ CONTENT ═══ */}
      <motion.div variants={itemVariants} className="space-y-4">
        {/* ── System Status Panel (Redesigned) ── */}
        <DashboardCards
          trafficData={trafficData}
          revenueData={revenueData}
          occupancyData={occupancyData}
          isLoading={isLoading}
        />

        {/* ── Main Grid: 2/3 Charts + 1/3 Right Sidebar ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left 2/3 — Tabbed Charts */}
          <div className="lg:col-span-2">
            <DashboardCharts
              trafficData={trafficData}
              revenueData={revenueData}
              occupancyData={occupancyData}
              peakHoursData={peakHoursData}
              isLoading={isLoading}
            />
          </div>

          {/* Right 1/3 — 2 admin-exclusive widgets */}
          <div className="flex flex-col gap-4">
            <SystemStatsWidget userStats={userStats} />
            <RevenueBreakdownWidget revenueData={revenueData} />
          </div>
        </div>

        {/* ── Facility Area (full width) ── */}
        <FacilityLeaderboardWidget occupancyData={occupancyData} />
      </motion.div>

      {/* Export Confirmation Modal */}
      <ExportConfirmModal
        isOpen={exportModalState.isOpen}
        format={exportModalState.format}
        isExporting={exporting}
        onClose={() => setExportModalState({ ...exportModalState, isOpen: false })}
        onConfirm={confirmExport}
      />
    </motion.div>
  );
}
