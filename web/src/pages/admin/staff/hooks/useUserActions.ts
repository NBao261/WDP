import { useState } from 'react';
import { toast } from 'sonner';
import { User as UserType } from '@/types/user.types';
import { userService } from '@/services/user.service';

type ActionType = 'lock' | 'unlock' | 'reset' | 'delete' | null;

interface ConfirmState {
  isOpen: boolean;
  type: ActionType;
  user: UserType | null;
}

/**
 * Manages the confirm-action modal state and execution for user management actions:
 * lock, unlock, reset password, delete.
 */
export function useUserActions(onRefresh: () => void) {
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    isOpen: false,
    type: null,
    user: null,
  });
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  const handleOpenConfirm = (type: NonNullable<ActionType>, user: UserType) => {
    setActionError('');
    setConfirmState({ isOpen: true, type, user });
  };

  const handleCloseConfirm = () => {
    if (isActionLoading) return;
    setConfirmState({ isOpen: false, type: null, user: null });
    setActionError('');
  };

  const handleConfirmAction = () => {
    if (!confirmState.user || !confirmState.type) return;

    setIsActionLoading(true);
    setActionError('');

    const { type, user } = confirmState;
    let actionPromise: Promise<any>;

    if (type === 'lock') {
      actionPromise = userService.lockUser(user._id);
    } else if (type === 'unlock') {
      actionPromise = userService.unlockUser(user._id);
    } else if (type === 'reset') {
      const randomStr = Math.random().toString(36).slice(-6);
      const tempPassword = ['T', 'e', 'm', 'p', '@', randomStr, '!'].join('');
      actionPromise = userService.resetPassword(user._id, tempPassword);
    } else if (type === 'delete') {
      actionPromise = userService.deleteUser(user._id);
    } else {
      setIsActionLoading(false);
      return;
    }

    toast.promise(actionPromise, {
      loading: 'Đang xử lý thao tác... ⏳',
      success: () => {
        setTimeout(() => setConfirmState({ isOpen: false, type: null, user: null }), 200);
        onRefresh();
        if (type === 'lock') return `Đã khóa tài khoản "${user.name}"`;
        if (type === 'unlock') return `Đã mở khóa tài khoản "${user.name}"`;
        if (type === 'reset') return `Đã đặt lại mật khẩu cho "${user.name}"`;
        if (type === 'delete') return `Tạm biệt "${user.name}" (Đã xóa)`;
        return 'Thành công!';
      },
      error: (err: any) => {
        setActionError(err.message || 'Đã xảy ra lỗi. Vui lòng thử lại.');
        return 'Thao tác không thành công ❌';
      },
    });

    actionPromise.finally(() => {
      setIsActionLoading(false);
    });
  };

  // Derived confirm modal props
  const confirmTitle =
    confirmState.type === 'lock'
      ? 'Khóa tài khoản'
      : confirmState.type === 'unlock'
        ? 'Mở khóa tài khoản'
        : confirmState.type === 'delete'
          ? 'Xóa tài khoản'
          : 'Đặt lại mật khẩu';

  const confirmMessage =
    confirmState.type === 'lock'
      ? `Bạn có chắc chắn muốn khóa tài khoản "${confirmState.user?.name}"? Người dùng này sẽ không thể đăng nhập vào hệ thống.`
      : confirmState.type === 'unlock'
        ? `Bạn có chắc chắn muốn mở khóa tài khoản "${confirmState.user?.name}"?`
        : confirmState.type === 'delete'
          ? `Bạn có chắc chắn muốn xóa tài khoản "${confirmState.user?.name}"? Thao tác này sẽ vô hiệu hóa người dùng trên hệ thống (Soft Delete).`
          : `Bạn có chắc chắn muốn đặt lại mật khẩu cho tài khoản "${confirmState.user?.name}"? Hệ thống sẽ tạo một mật khẩu mới ngẫu nhiên và gửi về email của người dùng.`;

  const confirmText =
    confirmState.type === 'lock'
      ? 'Khóa tài khoản'
      : confirmState.type === 'unlock'
        ? 'Mở khóa'
        : confirmState.type === 'delete'
          ? 'Xóa'
          : 'Đặt lại mật khẩu';

  const confirmVariant: 'primary' | 'danger' | 'warning' =
    confirmState.type === 'delete'
      ? 'danger'
      : confirmState.type === 'lock' || confirmState.type === 'reset'
        ? 'warning'
        : 'primary';

  return {
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
  };
}
