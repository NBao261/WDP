import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  MoreVertical,
  Search,
  Edit,
  Lock,
  Unlock,
  KeyRound,
  Trash2,
  User,
  ArrowUpDown,
} from 'lucide-react';
import { User as UserType } from '../../../../types/user.types';
import { ConfirmModal } from '../../../../components/ConfirmModal';
import { RoleIcon } from '../../../../components/ui/RoleIcon';
import { StatusBadge } from '../../../../components/ui/StatusBadge';
import { useUserActions } from '../hooks/useUserActions';

interface CustomerTableProps {
  users: UserType[];
  isLoading: boolean;
  onEdit: (user: UserType) => void;
  onViewDetail: (user: UserType) => void;
  onRefresh: () => void;
  indexOffset?: number;
}

export function CustomerTable({
  users,
  isLoading,
  onEdit,
  onViewDetail,
  onRefresh,
  indexOffset = 0,
}: CustomerTableProps) {
  const [sortField, setSortField] = useState<'name' | 'createdAt' | 'lastLogin'>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const toggleSort = (field: 'name' | 'createdAt' | 'lastLogin') => {
    if (sortField !== field) {
      setSortField(field);
      setSortDir(field === 'name' ? 'asc' : 'desc');
    } else if (sortDir === (field === 'name' ? 'asc' : 'desc')) {
      setSortDir(field === 'name' ? 'desc' : 'asc');
    } else {
      setSortField('createdAt');
      setSortDir('desc');
    }
  };

  const sortedUsers = [...users].sort((a, b) => {
    let aVal: any = a[sortField];
    let bVal: any = b[sortField];

    if (sortField === 'createdAt' || sortField === 'lastLogin') {
      aVal = a[sortField] ? new Date(a[sortField] as string).getTime() : 0;
      bVal = b[sortField] ? new Date(b[sortField] as string).getTime() : 0;
    }

    if (typeof aVal === 'string') aVal = aVal.toLowerCase();
    if (typeof bVal === 'string') bVal = bVal.toLowerCase();

    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const {
    confirmState,
    isActionLoading,
    actionError,
    handleOpenConfirm,
    handleCloseConfirm,
    handleConfirmAction,
    confirmTitle,
    confirmMessage,
    confirmText,
    confirmVariant,
  } = useUserActions(onRefresh);

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-visible relative">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[#9FE870] text-[#062F28] text-[13px] border-b border-[#9FE870] font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-4 rounded-tl-2xl w-[5%] text-center">STT</th>
                <th
                  className="px-4 py-4 w-[25%] cursor-pointer select-none hover:text-[#062F28] transition-colors"
                  onClick={() => toggleSort('name')}
                >
                  <span className="flex items-center gap-1.5">
                    Khách hàng
                    <ArrowUpDown
                      size={14}
                      className={sortField === 'name' ? 'text-white' : 'text-[#062F28]/40'}
                    />
                    {sortField === 'name' && (
                      <span className="text-[10px] text-white font-bold">
                        {sortDir === 'asc' ? 'A-Z' : 'Z-A'}
                      </span>
                    )}
                  </span>
                </th>
                <th className="px-4 py-4 w-[15%]">Số điện thoại</th>
                <th
                  className="px-4 py-4 w-[15%] cursor-pointer select-none hover:text-[#062F28] transition-colors"
                  onClick={() => toggleSort('createdAt')}
                >
                  <span className="flex items-center gap-1.5">
                    Ngày tham gia
                    <ArrowUpDown
                      size={14}
                      className={sortField === 'createdAt' ? 'text-white' : 'text-[#062F28]/40'}
                    />
                    {sortField === 'createdAt' && (
                      <span className="text-[10px] text-white font-bold">
                        {sortDir === 'desc' ? '↓ Mới' : '↑ Cũ'}
                      </span>
                    )}
                  </span>
                </th>
                <th className="px-4 py-4 w-[15%]">Trạng thái</th>
                <th
                  className="px-4 py-4 w-[15%] cursor-pointer select-none hover:text-[#062F28] transition-colors"
                  onClick={() => toggleSort('lastLogin')}
                >
                  <span className="flex items-center gap-1.5">
                    Đăng nhập
                    <ArrowUpDown
                      size={14}
                      className={sortField === 'lastLogin' ? 'text-white' : 'text-[#062F28]/40'}
                    />
                    {sortField === 'lastLogin' && (
                      <span className="text-[10px] text-white font-bold">
                        {sortDir === 'desc' ? '↓ Mới' : '↑ Cũ'}
                      </span>
                    )}
                  </span>
                </th>
                <th className="px-4 py-4 text-right rounded-tr-2xl w-[10%]">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                    <div className="w-6 h-6 border-2 border-[#9FE870] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                    <div className="bg-gray-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Search size={24} className="text-gray-300" />
                    </div>
                    Không tìm thấy người dùng nào
                  </td>
                </tr>
              ) : (
                <AnimatePresence mode="popLayout">
                  {sortedUsers.map((user, idx) => (
                    <motion.tr
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      key={user._id}
                      className="hover:bg-[#9FE870]/10 transition-colors group"
                    >
                      <td className="px-4 py-4 text-[#6b6b6b] text-[13px] text-center font-medium">
                        {indexOffset + idx + 1}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center font-bold text-gray-500 group-hover:bg-[#9FE870]/20 group-hover:text-[#062F28] transition-colors shrink-0">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <button
                              onClick={() => onViewDetail(user)}
                              className="font-semibold text-[#062F28] hover:text-[#062F28]/80 hover:underline transition-colors outline-none truncate block max-w-[150px] lg:max-w-[200px]"
                              title={user.name}
                            >
                              {user.name}
                            </button>
                            <div
                              className="text-gray-500 text-xs mt-0.5 truncate max-w-[150px] lg:max-w-[200px]"
                              title={user.email}
                            >
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2 font-medium text-[#062F28]">
                          {user.phone || 'Chưa cập nhật'}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-gray-500 text-xs">
                        {user.createdAt
                          ? new Date(user.createdAt).toLocaleDateString('vi-VN')
                          : 'Không rõ'}
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={user.status} />
                      </td>
                      <td className="px-4 py-4">
                        {user.lastLogin ? (
                          <>
                            <div className="text-[13px] font-semibold text-gray-800">
                              {new Date(user.lastLogin).toLocaleTimeString('vi-VN', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                            <div className="text-[11px] text-gray-400 mt-0.5">
                              {new Date(user.lastLogin).toLocaleDateString('vi-VN')}
                            </div>
                          </>
                        ) : (
                          <span className="text-gray-400 text-xs">Chưa đăng nhập</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <DropdownMenu.Root>
                          <DropdownMenu.Trigger asChild>
                            <button className="select-none text-gray-400 hover:text-[#062F28] p-2 rounded-lg hover:bg-gray-100 transition-colors focus:outline-none outline-none">
                              <MoreVertical size={20} />
                            </button>
                          </DropdownMenu.Trigger>
                          <DropdownMenu.Portal>
                            <DropdownMenu.Content
                              align="end"
                              sideOffset={4}
                              className="w-48 bg-white rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-gray-100 py-2 z-50 font-sans animate-in fade-in zoom-in-95 duration-150 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95"
                            >
                              <DropdownMenu.Item
                                onSelect={() => setTimeout(() => onViewDetail(user), 0)}
                                className="w-full text-left px-4 py-2 text-sm text-[#062F28] hover:bg-[#9FE870]/20 flex items-center gap-2 cursor-pointer outline-none focus:bg-[#9FE870]/20 transition-colors"
                              >
                                <User size={16} /> Xem chi tiết
                              </DropdownMenu.Item>
                              <DropdownMenu.Item
                                onSelect={() => setTimeout(() => onEdit(user), 0)}
                                className="w-full text-left px-4 py-2 text-sm text-[#062F28] hover:bg-[#9FE870]/20 flex items-center gap-2 cursor-pointer outline-none focus:bg-[#9FE870]/20 transition-colors"
                              >
                                <Edit size={16} /> Chỉnh sửa thông tin
                              </DropdownMenu.Item>
                              <DropdownMenu.Item
                                onSelect={() =>
                                  setTimeout(() => handleOpenConfirm('reset', user), 0)
                                }
                                className="w-full text-left px-4 py-2 text-sm text-[#062F28] hover:bg-[#9FE870]/20 flex items-center gap-2 cursor-pointer outline-none focus:bg-[#9FE870]/20 transition-colors"
                              >
                                <KeyRound size={16} /> Đặt lại mật khẩu
                              </DropdownMenu.Item>
                              <DropdownMenu.Separator className="h-px bg-gray-100 my-1" />
                              {user.status === 'locked' ? (
                                <DropdownMenu.Item
                                  onSelect={() =>
                                    setTimeout(() => handleOpenConfirm('unlock', user), 0)
                                  }
                                  className="w-full text-left px-4 py-2 text-sm text-[#062F28] hover:bg-[#9FE870]/20 flex items-center gap-2 cursor-pointer outline-none focus:bg-[#9FE870]/20 transition-colors"
                                >
                                  <Unlock size={16} /> Mở khóa
                                </DropdownMenu.Item>
                              ) : (
                                <DropdownMenu.Item
                                  onSelect={() =>
                                    setTimeout(() => handleOpenConfirm('lock', user), 0)
                                  }
                                  className="w-full text-left px-4 py-2 text-sm text-[#062F28] hover:bg-[#9FE870]/20 flex items-center gap-2 cursor-pointer outline-none focus:bg-[#9FE870]/20 transition-colors"
                                >
                                  <Lock size={16} /> Khóa tài khoản
                                </DropdownMenu.Item>
                              )}
                              <DropdownMenu.Separator className="h-px bg-gray-100 my-1" />
                              <DropdownMenu.Item
                                onSelect={() =>
                                  setTimeout(() => handleOpenConfirm('delete', user), 0)
                                }
                                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer outline-none focus:bg-red-50"
                              >
                                <Trash2 size={16} /> Xóa tài khoản
                              </DropdownMenu.Item>
                            </DropdownMenu.Content>
                          </DropdownMenu.Portal>
                        </DropdownMenu.Root>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmState.isOpen}
        onClose={handleCloseConfirm}
        onConfirm={handleConfirmAction}
        isLoading={isActionLoading}
        error={actionError}
        title={confirmTitle}
        message={confirmMessage}
        confirmText={confirmText}
        variant={confirmVariant}
      />
    </>
  );
}
