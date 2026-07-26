import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles, X, Send, Loader2, FileSpreadsheet, FileText, BarChart2,
  ArrowRight, Clock, Plus, ChevronLeft, MessageSquare, Square, ChevronsDown,
  GripVertical, PanelRight, LayoutGrid,
} from 'lucide-react';
import { aiService, ChatMessage } from '../../../services/ai.service';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const SESSION_CONV_KEY = 'ai_widget_conv_id';
const MODE_KEY = 'ai_widget_mode';

// popup defaults
const POPUP_DEFAULT = { w: 400, h: 580, x: -24, y: -24 }; // negative = from right/bottom
// sidebar defaults
const SIDEBAR_DEFAULT_W = 400;
const SIDEBAR_MIN_W = 300;
const SIDEBAR_MAX_W = 700;
// popup constraints
const POPUP_MIN_W = 320;
const POPUP_MIN_H = 400;
const POPUP_MAX_W = 800;
const POPUP_MAX_H = 900;

type Mode = 'popup' | 'sidebar';

/* ─── Utilities ─────────────────────────────────────────────────────────────── */
function hasTableData(msg: ChatMessage): boolean {
  if (!msg.data) return false;
  const d = msg.data as any;
  return (Array.isArray(d) && d.length > 0) ||
    (d?.rows && Array.isArray(d.rows) && d.rows.length > 0) ||
    (d?.data && Array.isArray(d.data) && d.data.length > 0);
}
function extractTableData(data: any): { columns: string[]; rows: Record<string, any>[] } {
  let rows: Record<string, any>[] = [];
  if (Array.isArray(data)) rows = data;
  else if (data?.rows && Array.isArray(data.rows)) rows = data.rows;
  else if (data?.data && Array.isArray(data.data)) rows = data.data;
  if (rows.length === 0) return { columns: [], rows: [] };
  return { columns: Object.keys(rows[0]), rows };
}
function formatCell(value: any, key: string) {
  if (value === null || value === undefined) return { display: '—', isNumber: false, isPercent: false };
  const k = key.toLowerCase();
  const isPercent = k.includes('rate') || k.includes('tỷ lệ') || k.includes('percent') || k.includes('%') || k.includes('ratio');
  const isNumber = typeof value === 'number';
  if (isPercent && isNumber) {
    const pct = value > 1 ? value : value * 100;
    return { display: `${pct.toFixed(1)}%`, isNumber: true, isPercent: true };
  }
  if (isNumber) {
    if (k.includes('revenue') || k.includes('doanh') || k.includes('fee') || k.includes('phí') || k.includes('amount') || k.includes('tiền'))
      return { display: value.toLocaleString('vi-VN') + ' đ', isNumber: true, isPercent: false };
    return { display: value.toLocaleString('vi-VN'), isNumber: true, isPercent: false };
  }
  return { display: String(value), isNumber: false, isPercent: false };
}
const COL_LABELS: Record<string, string> = {
  name: 'Tên', facilityName: 'Bãi xe', facility: 'Bãi xe',
  revenue: 'Doanh thu', totalRevenue: 'Doanh thu',
  sessions: 'Lượt xe', totalSessions: 'Lượt xe', count: 'Số lượng',
  occupancyRate: 'Tỷ lệ lấp đầy', rate: 'Tỷ lệ', fillRate: 'Tỷ lệ',
  date: 'Ngày', time: 'Thời gian', hour: 'Giờ',
  vehicleType: 'Loại xe', type: 'Loại', status: 'Trạng thái',
};
function colLabel(key: string): string { return COL_LABELS[key] ?? key.replace(/([A-Z])/g, ' $1').trim(); }
function getFollowUpSuggestions(content: string): string[] {
  const c = content.toLowerCase();
  if (c.includes('doanh thu')) return ['So sánh tháng trước', 'Xem theo loại xe'];
  if (c.includes('lượt xe') || c.includes('session')) return ['Xem giờ cao điểm', 'So sánh hôm qua'];
  if (c.includes('lấp đầy') || c.includes('tỷ lệ')) return ['Xem bãi nào thấp nhất', 'Phân tích theo giờ'];
  if (c.includes('tòa nhà') || c.includes('bãi')) return ['So sánh các bãi', 'Xem doanh thu từng bãi'];
  return ['Xem thêm chi tiết', 'So sánh kỳ trước'];
}
function formatRelativeTime(iso: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} giờ trước`;
  const days = Math.floor(hrs / 24);
  return days < 7 ? `${days} ngày trước` : new Date(iso).toLocaleDateString('vi-VN');
}
function formatTime(iso: string) {
  return iso ? new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '';
}

/* ─── Sub-components ─────────────────────────────────────────────────────────── */
function PercentBadge({ value }: { value: string }) {
  const num = parseFloat(value);
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${
      num >= 80 ? 'bg-[#A0E870] text-[#060606]' : num >= 50 ? 'bg-[#eaf3de] text-[#173404]' : 'bg-[#f3f4f6] text-[#6b7280]'
    }`}>{value}</span>
  );
}

const THINKING_TEXTS = [
  'AI đang suy nghĩ...',
  'AI đang phân tích dữ liệu...',
  'AI đang trả lời...',
];

function AIThinkingText() {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((prev) => (prev + 1) % THINKING_TEXTS.length);
        setVisible(true);
      }, 300);
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  return (
    <span style={{
      display: 'inline-block',
      transition: 'opacity 0.3s ease, transform 0.3s ease',
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(-4px)',
    }}>
      {THINKING_TEXTS[idx]}
    </span>
  );
}

function SkeletonTable({ cols = 3, rows = 3 }: { cols?: number; rows?: number }) {
  return (
    <div className="mt-2 rounded-xl border border-[#e5e7eb] overflow-hidden">
      <div className="bg-[#f5f5f3] px-3 py-2"><div className="h-3 w-24 bg-[#e5e7eb] rounded animate-pulse" /></div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-[#f5f5f3] border-b border-[#e5e7eb]">
              {Array.from({ length: cols }).map((_, i) => (
                <th key={i} className="px-3 py-2">
                  <div className="h-2.5 bg-[#e5e7eb] rounded animate-pulse" style={{ width: `${40 + i * 10}%` }} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f3f4f6]">
            {Array.from({ length: rows }).map((_, ri) => (
              <tr key={ri} className="bg-white">
                {Array.from({ length: cols }).map((_, ci) => (
                  <td key={ci} className="px-3 py-2.5">
                    <div className="h-2.5 bg-[#f3f4f6] rounded animate-pulse"
                      style={{ width: `${50 + Math.sin(ri + ci) * 25}%`, animationDelay: `${(ri + ci) * 80}ms` }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DataTableCard({ data, title, onExportExcel, onExportPdf, suggestions, onSuggestion }: {
  data: any; title?: string; onExportExcel: () => void; onExportPdf: () => void;
  suggestions?: string[]; onSuggestion: (s: string) => void;
}) {
  const { columns, rows } = extractTableData(data);
  if (!columns.length || !rows.length) return null;
  return (
    <div className="mt-2 rounded-xl border border-[#e5e7eb] overflow-hidden bg-white">
      <div className="flex items-center gap-2 px-3 py-2 bg-[#f5f5f3] border-b border-[#e5e7eb]">
        <BarChart2 size={13} className="text-[#6b7280] shrink-0" />
        <span className="text-[11px] font-semibold text-[#4b5563] truncate">{title || 'Dữ liệu thống kê'}</span>
        <span className="ml-auto text-[10px] text-[#9ca3af] shrink-0">{rows.length} dòng</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-[#f5f5f3] border-b border-[#e5e7eb]">
              {columns.map((col) => (
                <th key={col} className="px-3 py-2 text-left text-[11px] font-semibold text-[#6b7280] uppercase tracking-wide whitespace-nowrap">{colLabel(col)}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f3f4f6]">
            {rows.map((row, ri) => (
              <tr key={ri} className="bg-white hover:bg-[#fafaf8] transition-colors">
                {columns.map((col) => {
                  const { display, isNumber, isPercent } = formatCell(row[col], col);
                  return (
                    <td key={col} className={`px-3 py-2.5 whitespace-nowrap ${isNumber && !isPercent ? 'text-right font-medium text-[#1a1a1a]' : 'text-left text-[#4b5563]'}`}>
                      {isPercent ? <PercentBadge value={display} /> : <span>{display}</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between px-3 py-2 border-t border-[#e5e7eb] bg-[#fafaf8]">
        <span className="text-[10px] text-[#9ca3af] font-medium">Xuất file</span>
        <div className="flex items-center gap-1.5">
          <button onClick={onExportExcel} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium text-[#4b5563] border border-[#e5e7eb] bg-white hover:bg-[#f5f5f3] hover:border-[#A0E870]/50 transition-all">
            <FileSpreadsheet size={12} className="text-[#6b7280]" />Excel
          </button>
          <button onClick={onExportPdf} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium text-[#4b5563] border border-[#e5e7eb] bg-white hover:bg-[#f5f5f3] hover:border-[#A0E870]/50 transition-all">
            <FileText size={12} className="text-[#6b7280]" />PDF
          </button>
        </div>
      </div>
      {suggestions && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-3 pb-3 pt-1">
          {suggestions.map((s, i) => (
            <button key={i} onClick={() => onSuggestion(s)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium text-[#4b5563] border border-[#e5e7eb] bg-white hover:bg-[#f5f5f3] hover:border-[#A0E870]/50 transition-all">
              {s}<ArrowRight size={10} className="text-[#9ca3af]" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function exportToCSV(data: any, filename: string) {
  const { columns, rows } = extractTableData(data);
  if (!rows.length) return;
  const header = columns.map(colLabel).join(',');
  const body = rows.map((r) => columns.map((c) => `"${r[c] ?? ''}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + header + '\n' + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = filename + '.csv'; a.click(); URL.revokeObjectURL(url);
}
function exportToPDF(data: any, title: string) {
  const { columns, rows } = extractTableData(data);
  if (!rows.length) return;
  const header = `<tr>${columns.map((c) => `<th style="background:#f5f5f3;padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;border-bottom:1px solid #e5e7eb;">${colLabel(c)}</th>`).join('')}</tr>`;
  const body = rows.map((r, ri) =>
    `<tr style="background:${ri % 2 === 0 ? '#fff' : '#fafaf8'};">${columns.map((c) => `<td style="padding:8px 12px;font-size:12px;color:#1a1a1a;">${r[c] ?? '—'}</td>`).join('')}</tr>`
  ).join('');
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title><style>body{font-family:system-ui,sans-serif;padding:24px;}table{border-collapse:collapse;width:100%;}</style></head><body><h2>${title}</h2><table><thead>${header}</thead><tbody>${body}</tbody></table></body></html>`;
  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); w.print(); }
}

function HistoryPanel({ conversations, loadingHistory, onSelect, onNewChat, onClose }: {
  conversations: any[]; loadingHistory: boolean;
  onSelect: (conv: any) => void; onNewChat: () => void; onClose: () => void;
}) {
  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#e5e7eb] shrink-0">
        <button onClick={onClose} className="w-7 h-7 rounded-full hover:bg-[#f3f4f6] flex items-center justify-center text-[#6b7280] transition-colors">
          <ChevronLeft size={16} />
        </button>
        <span className="text-[13px] font-semibold text-[#1a1a1a] flex-1">Lịch sử trò chuyện</span>

      </div>
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#e5e7eb transparent' }}>
        {loadingHistory ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <Loader2 size={20} className="animate-spin text-[#A0E870]" />
            <p className="text-[12px] text-[#6b7280]">Đang tải...</p>
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
            <MessageSquare size={32} className="text-[#e5e7eb]" />
            <p className="text-[13px] text-[#9ca3af]">Chưa có cuộc trò chuyện nào</p>
          </div>
        ) : (
          <div className="divide-y divide-[#f3f4f6]">
            {conversations.map((conv, idx) => {
              const id = conv.conversationId ?? conv._id ?? idx;
              const preview = conv.lastMessage ?? conv.summary ?? conv.title ?? 'Cuộc trò chuyện';
              const time = conv.updatedAt ?? conv.createdAt ?? '';
              return (
                <button key={id} onClick={() => onSelect(conv)}
                  className="w-full text-left px-4 py-3 hover:bg-[#f9fafb] transition-colors flex items-start gap-3 group">
                  <div className="w-8 h-8 rounded-full bg-[#f3f4f6] flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-[#e5e7eb] transition-colors">
                    <MessageSquare size={14} className="text-[#9ca3af]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[#1a1a1a] truncate">{preview}</p>
                    {time && <p className="text-[11px] text-[#9ca3af] mt-0.5">{formatRelativeTime(time)}</p>}
                  </div>
                  <ArrowRight size={14} className="text-[#e5e7eb] group-hover:text-[#A0E870] transition-colors shrink-0 mt-1" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Chat Body (shared between popup & sidebar) ─────────────────────────────── */
function ChatBody({
  messages, loading, historyLoading, showHistory, conversations, convListLoading,
  messagesContainerRef, messagesEndRef, showScrollBtn,
  defaultSuggestions, message, textareaRef,
  onScroll, onScrollToBottom, onSend, onStopGeneration,
  onOpenHistory, onCloseHistory, onSelectConversation, onNewChat,
  onMessageChange, onKeyDown,
}: {
  messages: ChatMessage[]; loading: boolean; historyLoading: boolean;
  showHistory: boolean; conversations: any[]; convListLoading: boolean;
  messagesContainerRef: React.RefObject<HTMLDivElement>;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  showScrollBtn: boolean; defaultSuggestions: string[];
  message: string; textareaRef: React.RefObject<HTMLTextAreaElement>;
  onScroll: () => void; onScrollToBottom: () => void;
  onSend: (text?: string) => void; onStopGeneration: () => void;
  onOpenHistory: () => void; onCloseHistory: () => void;
  onSelectConversation: (conv: any) => void; onNewChat: () => void;
  onMessageChange: (v: string) => void; onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}) {
  if (showHistory) {
    return (
      <HistoryPanel
        conversations={conversations} loadingHistory={convListLoading}
        onSelect={onSelectConversation} onNewChat={onNewChat} onClose={onCloseHistory}
      />
    );
  }

  return (
    <>
      {/* Messages */}
      <div className="flex-1 relative overflow-hidden">
        <div
          ref={messagesContainerRef}
          onScroll={onScroll}
          className={`h-full overflow-y-auto ${messages.length === 0 && !historyLoading ? 'bg-[#f5f5f3]' : 'p-4 space-y-3 bg-[#f5f5f3]'}`}
          style={{ scrollbarWidth: 'thin', scrollbarColor: '#e5e7eb transparent' }}
        >
          {historyLoading ? (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <Loader2 size={24} className="animate-spin text-[#A0E870]" />
              <p className="text-[12px] text-[#6b7280]">Đang tải...</p>
            </div>
          ) : messages.length === 0 ? (
            /* Empty / Welcome */
            <div className="flex flex-col h-full relative">
              <div className="absolute inset-0 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(160,232,112,0.28) 0%, transparent 70%)' }} />
              <div className="flex-1 flex flex-col items-center justify-center relative z-10">
                <Sparkles size={28} className="text-[#060606] mb-4" strokeWidth={1.4} />
                <p className="text-[17px] font-semibold text-[#060606] tracking-tight text-center px-4">
                  Hỏi AI bất cứ điều gì
                </p>
                <p className="text-[12px] text-[#6b7280] mt-1 text-center">
                  Phân tích dữ liệu hệ thống parking
                </p>
              </div>
              <div className="shrink-0 px-4 pb-5 relative z-10">
                <p className="text-[11px] font-semibold text-[#5fa832] mb-2.5 tracking-wide">Gợi ý câu hỏi</p>
                <div className="flex flex-col gap-2">
                  {defaultSuggestions.map((sug, idx) => (
                    <button key={idx} onClick={() => onSend(sug)}
                      className="group flex items-center gap-3 text-left px-3 py-2.5 rounded-2xl border border-[#e5e7eb] bg-[#f3f4f6] hover:bg-[#e9eaec] hover:border-[#A0E870]/60 hover:shadow-sm transition-all">
                      <span className="w-6 h-6 rounded-full bg-[#f0fae5] flex items-center justify-center shrink-0">
                        <Sparkles size={11} className="text-[#5fa832]" />
                      </span>
                      <span className="flex-1 text-[12.5px] text-[#4b5563] leading-snug">{sug}</span>
                      <ArrowRight size={13} className="text-[#d1d5db] group-hover:text-[#A0E870] shrink-0 transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const msgDate = msg.createdAt ? new Date(msg.createdAt) : null;

              const formatTimestamp = (iso: string) => {
                if (!iso) return '';
                const d = new Date(iso);
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
                const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                const timeStr = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                if (dDay.getTime() === today.getTime()) return timeStr;
                if (dDay.getTime() === yesterday.getTime()) return `Hôm qua, ${timeStr}`;
                const dd = String(d.getDate()).padStart(2, '0');
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                return `${dd}/${mm}, ${timeStr}`;
              };

              return (
                <div key={msg._id}>
                  {/* Message bubble */}
                  <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[92%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-[#060606] text-white rounded-br-sm prose prose-sm prose-invert prose-p:leading-relaxed'
                        : 'bg-white border border-[#e5e7eb] text-[#1a1a1a] rounded-bl-sm shadow-sm prose prose-sm prose-p:leading-relaxed'
                    }`}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                        table: (p: any) => (
                          <div className="my-2 rounded-lg border border-[#e5e7eb] overflow-x-auto">
                            <table className="w-full text-[12px] border-collapse" {...p} />
                          </div>
                        ),
                        thead: (p: any) => <thead className="bg-[#f5f5f3]" {...p} />,
                        tbody: (p: any) => <tbody className="divide-y divide-[#f3f4f6]" {...p} />,
                        tr: (p: any) => <tr className="hover:bg-[#fafaf8] transition-colors" {...p} />,
                        th: (p: any) => <th className="px-3 py-2 text-left text-[11px] font-semibold text-[#6b7280] uppercase tracking-wide whitespace-nowrap border-b border-[#e5e7eb]" {...p} />,
                        td: (p: any) => <td className="px-3 py-2 text-[12px] text-[#1a1a1a] whitespace-nowrap" {...p} />,
                        p: (p: any) => <p className="mb-2 last:mb-0 leading-relaxed" {...p} />,
                        ul: (p: any) => <ul className="list-disc pl-5 mb-3 space-y-1" {...p} />,
                        ol: (p: any) => <ol className="list-decimal pl-5 mb-3 space-y-1" {...p} />,
                        li: (p: any) => <li className="leading-relaxed" {...p} />,
                        strong: (p: any) => <strong className="font-semibold" {...p} />,
                        blockquote: (p: any) => <blockquote className="border-l-4 border-[#A0E870] pl-3 italic opacity-80 my-3" {...p} />,
                        code: ({ inline, ...p }: any) => inline
                          ? <code className="bg-black/5 rounded px-1.5 py-0.5 text-[12px] font-mono text-[#ea580c]" {...p} />
                          : <code className="block bg-[#1a1a1a] text-[#f8f8f8] rounded-lg p-3 text-[12px] overflow-x-auto my-3 font-mono" {...p} />,
                      }}>
                        {msg.content}
                      </ReactMarkdown>
                      <div className={`text-[10px] mt-1.5 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} text-[#9ca3af]`}>
                        {formatTimestamp(msg.createdAt)}
                      </div>
                    </div>
                    {msg.role === 'model' && hasTableData(msg) && (
                      <div className="w-[92%]">
                        <DataTableCard
                          data={msg.data}
                          title={msg.content?.split('\n')[0]?.slice(0, 48) || 'Thống kê'}
                          onExportExcel={() => exportToCSV(msg.data, 'thong-ke-ai')}
                          onExportPdf={() => exportToPDF(msg.data, msg.content?.split('\n')[0] || 'Thống kê AI')}
                          suggestions={getFollowUpSuggestions(msg.content || '')}
                          onSuggestion={onSend}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Typing indicator */}
          {loading && (
            <div className="flex flex-col items-start gap-2">
              <div className="bg-white border border-[#e5e7eb] rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm flex items-center gap-3">
                {/* Avatar */}
                <div className="w-7 h-7 rounded-full bg-[#060606] flex items-center justify-center shrink-0">
                  <Sparkles size={13} className="text-[#A0E870]" style={{ animation: 'aiSparkle 2s ease-in-out infinite' }} />
                </div>
                {/* Status text + dots */}
                <div className="flex flex-col gap-0.5">
                  <span className="text-[12px] font-semibold text-[#1a1a1a] leading-none" style={{ animation: 'aiThinkText 4s ease-in-out infinite' }}>
                    <AIThinkingText />
                  </span>
                  <div className="flex items-center gap-1 mt-1">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#A0E870]"
                        style={{ animation: 'aiBounce 1.2s ease-in-out infinite', animationDelay: `${i * 0.22}s` }} />
                    ))}
                  </div>
                </div>
              </div>

            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {showScrollBtn && (
          <button onClick={onScrollToBottom}
            className="absolute bottom-3 right-3 w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center hover:shadow-lg active:scale-95 transition-all z-10 border border-[#e5e7eb]">
            <ChevronsDown size={16} className="text-[#4b5563]" />
          </button>
        )}
      </div>

      {/* Input */}
      <div className="bg-[#f5f5f3] shrink-0">
        {messages.length > 0 && (
          <div className="px-3 pt-2.5 pb-1 overflow-x-auto flex gap-2" style={{ scrollbarWidth: 'none' }}>
            {defaultSuggestions.map((sug, idx) => (
              <button key={idx} onClick={() => onSend(sug)} disabled={loading}
              className="shrink-0 text-[11px] font-medium bg-white hover:bg-[#f0f0ee] text-[#4b5563] hover:text-[#1a1a1a] px-3 py-1.5 rounded-full transition-colors border border-[#e5e7eb] hover:border-[#A0E870]/60 disabled:opacity-50 whitespace-nowrap shadow-sm">
                {sug}
              </button>
            ))}
          </div>
        )}
        <div className="px-3 pb-3 pt-2">
          <div className="flex items-center gap-2 bg-white border border-[#e5e7eb] rounded-2xl px-3 py-2 focus-within:border-[#A0E870] focus-within:ring-1 focus-within:ring-[#A0E870]/30 transition-all shadow-sm">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => onMessageChange(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Hỏi gì đó về dữ liệu hệ thống..."
              rows={1}
              className="flex-1 bg-transparent text-[13px] text-[#1a1a1a] placeholder:text-[#9ca3af] focus:outline-none resize-none leading-5 py-0.5"
              style={{ maxHeight: 120, minHeight: 20 }}
            />
            {loading ? (
              <button type="button" onClick={onStopGeneration} title="Dừng"
                className="w-8 h-8 rounded-xl flex items-center justify-center bg-[#060606] hover:bg-[#333] active:scale-95 transition-all shrink-0">
                <Square size={12} className="text-white fill-white" />
              </button>
            ) : (
              <button type="button" onClick={() => onSend()} disabled={!message.trim()}
                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all shrink-0 ${
                  message.trim() ? 'bg-[#A0E870] text-[#060606] hover:opacity-90 active:scale-95' : 'bg-transparent text-[#9ca3af] border border-[#e5e7eb]'
                } disabled:cursor-not-allowed`}>
                <Send size={14} />
              </button>
            )}
          </div>
          <p className="text-[10px] text-center text-[#9ca3af] mt-1.5">
            Trợ lý AI có thể mắc lỗi. Hãy kiểm tra thông tin quan trọng.
          </p>
        </div>
      </div>
    </>
  );
}

/* ─── Header (shared) ─────────────────────────────────────────────────────────── */
function ChatHeader({
  mode, loading, onNewChat, onOpenHistory, onToggleMode, onClose,
  dragHandleProps,
}: {
  mode: Mode; loading: boolean;
  onNewChat: () => void; onOpenHistory: () => void;
  onToggleMode: () => void; onClose: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}) {
  return (
    <div
      {...dragHandleProps}
      className={`flex items-center justify-between px-4 py-3 border-b border-[#86d455] bg-[#A0E870] shrink-0 ${dragHandleProps ? 'cursor-grab active:cursor-grabbing select-none' : ''}`}
    >
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-[#060606] flex items-center justify-center shrink-0">
          <Sparkles size={14} className="text-[#A0E870]" />
        </div>
        <div>
          <h3 className="font-bold text-[#060606] text-[14px] leading-tight">Trợ lý AI</h3>
          <p className="text-[11px] text-[#3d5000]">{loading ? 'Đang phân tích...' : 'Phân tích dữ liệu hệ thống'}</p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={onNewChat} title="Chat mới"
          className="w-7 h-7 rounded-full hover:bg-[#86d455] flex items-center justify-center text-[#060606] transition-colors">
          <Plus size={16} />
        </button>
        <button onClick={onOpenHistory} title="Lịch sử"
          className="w-7 h-7 rounded-full hover:bg-[#86d455] flex items-center justify-center text-[#060606] transition-colors">
          <Clock size={15} />
        </button>
        {/* Mode toggle */}
        <button onClick={onToggleMode} title={mode === 'popup' ? 'Chuyển sang Sidebar' : 'Chuyển sang Popup'}
          className="w-7 h-7 rounded-full hover:bg-[#86d455] flex items-center justify-center text-[#060606] transition-colors">
          {mode === 'popup' ? <PanelRight size={15} /> : <LayoutGrid size={15} />}
        </button>
        <button onClick={onClose} title="Đóng"
          className="w-7 h-7 rounded-full hover:bg-[#86d455] flex items-center justify-center text-[#060606] transition-colors">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

/* ─── Main Component ──────────────────────────────────────────────────────────── */
export function AIChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(() => (localStorage.getItem(MODE_KEY) as Mode) || 'sidebar');

  // Chat state
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState<any[]>([]);
  const [convListLoading, setConvListLoading] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  // Popup state (position + size)
  const [popupPos, setPopupPos] = useState({ x: 0, y: 0, ready: false });
  const [popupSize, setPopupSize] = useState({ w: POPUP_DEFAULT.w, h: POPUP_DEFAULT.h });


  // Sidebar state
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_W);

  // ── Push main content when sidebar is open (responsive) ───────────────
  useEffect(() => {
    const main = document.querySelector('main') as HTMLElement | null;
    if (!main) return;

    const applyPush = () => {
      const canSplit = window.innerWidth >= 1280;
      main.style.transition = 'margin-right 0.22s cubic-bezier(0.4,0,0.2,1)';
      if (isOpen && mode === 'sidebar' && canSplit) {
        main.style.marginRight = sidebarWidth + 'px';
      } else {
        main.style.marginRight = '0px';
      }
    };

    applyPush();
    window.addEventListener('resize', applyPush);
    return () => {
      window.removeEventListener('resize', applyPush);
      main.style.marginRight = '0px';
    };
  }, [isOpen, mode, sidebarWidth]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // ── Initialize popup position (bottom-right) ──────────────────────────────
  useEffect(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    setPopupPos({
      x: vw - POPUP_DEFAULT.w + POPUP_DEFAULT.x,
      y: vh - POPUP_DEFAULT.h + POPUP_DEFAULT.y,
      ready: true,
    });
  }, []);

  // ── Scroll ────────────────────────────────────────────────────────────────
  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollToBottom(); }, [messages, isOpen]);
  const handleScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 80);
  };

  // ── Textarea auto-resize ──────────────────────────────────────────────────
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, [message]);

  // ── POPUP: Drag to move (header) ──────────────────────────────────────────
  const onHeaderDragStart = useCallback((e: React.MouseEvent) => {
    if (mode !== 'popup') return;
    e.preventDefault();
    const startX = e.clientX - popupPos.x;
    const startY = e.clientY - popupPos.y;
    const onMove = (ev: MouseEvent) => {
      const vw = window.innerWidth; const vh = window.innerHeight;
      setPopupPos((prev) => ({
        ...prev,
        x: Math.min(vw - 100, Math.max(0, ev.clientX - startX)),
        y: Math.min(vh - 60, Math.max(0, ev.clientY - startY)),
      }));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [mode, popupPos]);

  // ── POPUP: Resize handles ─────────────────────────────────────────────────
  type ResizeDir = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';
  const onResizeStart = useCallback((e: React.MouseEvent, dir: ResizeDir) => {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX; const startY = e.clientY;
    const startW = popupSize.w; const startH = popupSize.h;
    const startPX = popupPos.x; const startPY = popupPos.y;

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      let nx = startPX, ny = startPY, nw = startW, nh = startH;

      if (dir.includes('e')) nw = Math.min(POPUP_MAX_W, Math.max(POPUP_MIN_W, startW + dx));
      if (dir.includes('s')) nh = Math.min(POPUP_MAX_H, Math.max(POPUP_MIN_H, startH + dy));
      if (dir.includes('w')) {
        nw = Math.min(POPUP_MAX_W, Math.max(POPUP_MIN_W, startW - dx));
        nx = startPX + (startW - nw);
      }
      if (dir.includes('n')) {
        nh = Math.min(POPUP_MAX_H, Math.max(POPUP_MIN_H, startH - dy));
        ny = startPY + (startH - nh);
      }

      setPopupSize({ w: nw, h: nh });
      setPopupPos((prev) => ({ ...prev, x: nx, y: ny }));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [popupSize, popupPos]);

  // ── SIDEBAR: Drag to resize ───────────────────────────────────────────────
  const onSidebarDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX; const startW = sidebarWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const onMove = (ev: MouseEvent) => {
      setSidebarWidth(Math.min(SIDEBAR_MAX_W, Math.max(SIDEBAR_MIN_W, startW + (startX - ev.clientX))));
    };
    const onUp = () => {
      document.body.style.cursor = ''; document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [sidebarWidth]);

  // ── Stop generation ───────────────────────────────────────────────────────
  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) { abortControllerRef.current.abort(); abortControllerRef.current = null; }
    setLoading(false);
    setMessages((prev) => {
      if (!prev.length || prev[prev.length - 1].role === 'model') return prev;
      return [...prev, { _id: Date.now() + '_stopped', role: 'model', content: '_Đã dừng._', createdAt: new Date().toISOString() }];
    });
  }, []);

  // ── Quick replies ─────────────────────────────────────────────────────────
  useEffect(() => {
    aiService.getQuickReplies().then((res) => {
      if (res.data) setQuickReplies((Object.values(res.data).flat() as string[]).slice(0, 4));
    }).catch(() => setQuickReplies([
      'Lượt xe vào ra hôm nay thế nào?',
      'Thống kê doanh thu tuần này',
      'Có tòa nhà nào đang quá tải không?',
      'Phân tích giờ cao điểm hôm qua',
    ]));
  }, []);

  // ── Load conversation ─────────────────────────────────────────────────────
  const loadConversationById = useCallback(async (id: string) => {
    setHistoryLoading(true);
    try {
      const msgRes = await aiService.getConversationMessages(id);
      const raw = msgRes.data as any;
      const sorted = Array.isArray(raw) ? raw : (raw?.messages || []);
      const mapped: ChatMessage[] = [];
      for (const item of sorted) {
        mapped.push({ _id: item._id + '_user', role: 'user', content: item.message, createdAt: item.createdAt });
        mapped.push({ _id: item._id + '_bot', role: 'model', content: item.response, data: item.responseData, createdAt: item.createdAt });
      }
      setMessages(mapped);
    } catch (err) { console.error(err); }
    finally { setHistoryLoading(false); }
  }, []);

  useEffect(() => {
    const savedId = sessionStorage.getItem(SESSION_CONV_KEY);
    if (savedId) setConversationId(savedId);
  }, []);
  useEffect(() => {
    if (isOpen && conversationId && messages.length === 0 && !historyLoading) loadConversationById(conversationId);
  }, [isOpen]); // eslint-disable-line
  useEffect(() => {
    if (conversationId) sessionStorage.setItem(SESSION_CONV_KEY, conversationId);
  }, [conversationId]);

  const loadConversations = useCallback(async () => {
    setConvListLoading(true);
    try {
      const res = await aiService.getConversations(1, 30);
      const list = (res.data as any)?.data ?? (res.data as any)?.conversations ?? [];
      setConversations(Array.isArray(list) ? list : []);
    } catch (err) { console.error(err); }
    finally { setConvListLoading(false); }
  }, []);

  const startNewChat = () => { sessionStorage.removeItem(SESSION_CONV_KEY); setConversationId(undefined); setMessages([]); setShowHistory(false); };
  const selectConversation = async (conv: any) => {
    const id = conv.conversationId ?? conv._id; if (!id) return;
    setConversationId(id); sessionStorage.setItem(SESSION_CONV_KEY, id);
    setShowHistory(false); await loadConversationById(id);
  };

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showHistory) { setShowHistory(false); return; }
        if (loading) { stopGeneration(); return; }
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, showHistory, loading, stopGeneration]);

  // ── Mode toggle (persist) ─────────────────────────────────────────────────
  const toggleMode = () => {
    const next: Mode = mode === 'popup' ? 'sidebar' : 'popup';
    setMode(next);
    localStorage.setItem(MODE_KEY, next);
  };

  // ── Send ──────────────────────────────────────────────────────────────────
  const handleSend = async (textOverride?: string) => {
    const textToSend = textOverride || message;
    if (!textToSend.trim() || loading) return;
    const userMessage = textToSend.trim();
    setMessage('');
    setMessages((prev) => [...prev, { _id: Date.now().toString(), role: 'user', content: userMessage, createdAt: new Date().toISOString() }]);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    try {
      setLoading(true);
      const res = await aiService.chatQuery(userMessage, conversationId);
      if (controller.signal.aborted) return;
      if (res.data.conversationId && !conversationId) setConversationId(res.data.conversationId);
      setMessages((prev) => [...prev, { _id: Date.now().toString() + 'bot', role: 'model', content: res.data.answer, data: res.data.data, createdAt: new Date().toISOString() }]);
    } catch (err: any) {
      if (controller.signal.aborted) return;
      toast.error(err.message || 'Lỗi khi gửi tin nhắn');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
      abortControllerRef.current = null;
    }
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const defaultSuggestions = quickReplies.length > 0 ? quickReplies : [
    'Lượt xe vào ra hôm nay thế nào?',
    'Thống kê doanh thu tuần này',
    'Có tòa nhà nào đang quá tải không?',
    'Phân tích giờ cao điểm hôm qua',
  ];

  // Shared body props
  const bodyProps = {
    messages, loading, historyLoading, showHistory, conversations, convListLoading,
    messagesContainerRef, messagesEndRef, showScrollBtn, defaultSuggestions,
    message, textareaRef,
    onScroll: handleScroll,
    onScrollToBottom: scrollToBottom,
    onSend: handleSend,
    onStopGeneration: stopGeneration,
    onOpenHistory: () => { setShowHistory(true); loadConversations(); },
    onCloseHistory: () => setShowHistory(false),
    onSelectConversation: selectConversation,
    onNewChat: startNewChat,
    onMessageChange: setMessage,
    onKeyDown: handleKeyDown,
  };

  const headerProps = {
    mode, loading,
    onNewChat: startNewChat,
    onOpenHistory: () => { setShowHistory(true); loadConversations(); },
    onToggleMode: toggleMode,
    onClose: () => {
      if (loading) stopGeneration();
      setIsOpen(false);
      // Reset về sidebar mỗi khi đóng, để lần mở sau luôn hiện sidebar
      setMode('sidebar');
      localStorage.setItem(MODE_KEY, 'sidebar');
    },
  };

  return (
    <>
      {/* ── Global styles ── */}
      <style>{`
        @keyframes aiBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
        @keyframes aiSparkle {
          0%, 100% { transform: scale(1) rotate(0deg); opacity: 0.8; }
          50% { transform: scale(1.2) rotate(15deg); opacity: 1; }
        }
        @keyframes sidebarIn {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes popupIn {
          from { transform: scale(0.92); opacity: 0; }
          to   { transform: scale(1);    opacity: 1; }
        }
        .ai-resize-handle { position: absolute; z-index: 20; }
        .ai-resize-n  { top: -3px; left: 8px; right: 8px; height: 6px; cursor: n-resize; }
        .ai-resize-s  { bottom: -3px; left: 8px; right: 8px; height: 6px; cursor: s-resize; }
        .ai-resize-e  { right: -3px; top: 8px; bottom: 8px; width: 6px; cursor: e-resize; }
        .ai-resize-w  { left: -3px; top: 8px; bottom: 8px; width: 6px; cursor: w-resize; }
        .ai-resize-nw { top: -3px; left: -3px; width: 12px; height: 12px; cursor: nw-resize; border-radius: 4px; }
        .ai-resize-ne { top: -3px; right: -3px; width: 12px; height: 12px; cursor: ne-resize; border-radius: 4px; }
        .ai-resize-sw { bottom: -3px; left: -3px; width: 12px; height: 12px; cursor: sw-resize; border-radius: 4px; }
        .ai-resize-se { bottom: -3px; right: -3px; width: 12px; height: 12px; cursor: se-resize; border-radius: 4px; }
        .ai-resize-handle:hover { background: rgba(160,232,112,0.35); }
      `}</style>

      {/* ═══ Floating button (always visible when closed) ═══ */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        title="Trợ lý AI"
        className={`fixed bottom-6 right-6 z-[60] w-[52px] h-[52px] rounded-full bg-[#060606]
          flex items-center justify-center transition-all duration-200 hover:scale-105
          ${isOpen ? 'scale-0 opacity-0 pointer-events-none' : 'scale-100 opacity-100'}`}
        style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.25)' }}
      >
        <Sparkles size={22} className="text-[#A0E870]" />
      </button>

      {/* ═══ MODE: POPUP ═══ */}
      {isOpen && mode === 'popup' && popupPos.ready && (
        <div
          ref={popupRef}
          className="fixed z-[55] flex flex-col bg-white rounded-[20px] overflow-hidden border border-[#e5e7eb]"
          style={{
            left: popupPos.x,
            top: popupPos.y,
            width: popupSize.w,
            height: popupSize.h,
            boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
            animation: 'popupIn 0.2s cubic-bezier(0.4,0,0.2,1)',
            minWidth: POPUP_MIN_W,
            minHeight: POPUP_MIN_H,
          }}
        >
          {/* Resize handles (8 cạnh + 4 góc) */}
          {(['n','s','e','w','nw','ne','sw','se'] as ResizeDir[]).map((dir) => (
            <div key={dir} className={`ai-resize-handle ai-resize-${dir}`} onMouseDown={(e) => onResizeStart(e, dir)} />
          ))}

          {/* Header (draggable) */}
          <ChatHeader
            {...headerProps}
            dragHandleProps={{ onMouseDown: onHeaderDragStart }}
          />

          <div className="flex-1 flex flex-col overflow-hidden">
            <ChatBody {...bodyProps} />
          </div>
        </div>
      )}

      {/* ═══ MODE: SIDEBAR ═══ */}
      {isOpen && mode === 'sidebar' && (
        <div
          className="fixed top-0 right-0 h-screen z-[55] flex flex-col bg-white"
          style={{
            width: sidebarWidth,
            borderLeft: '1px solid #e5e7eb',
            boxShadow: '-6px 0 32px rgba(0,0,0,0.10)',
            animation: 'sidebarIn 0.22s cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          {/* Drag handle (left edge) */}
          <div
            className="absolute left-0 top-0 h-full w-1.5 cursor-col-resize z-20 flex items-center justify-center hover:bg-[#A0E870]/15 transition-colors"
            onMouseDown={onSidebarDragStart}
            title="Kéo để thay đổi độ rộng"
          >
            <GripVertical size={12} className="text-[#d1d5db]" />
          </div>

          {/* Header */}
          <ChatHeader {...headerProps} />

          {/* Body */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <ChatBody {...bodyProps} />
          </div>
        </div>
      )}
    </>
  );
}
