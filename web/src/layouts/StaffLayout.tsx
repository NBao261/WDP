import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store';
import { ConfirmModal } from '../components/ConfirmModal';
import TerminalToolbar from '../pages/staff/vehicleCheck/components/TerminalToolbar';
import GlobalExceptionPanel from '../pages/staff/vehicleCheck/components/GlobalExceptionPanel';
import { PageTransition } from '../components/ui/PageTransition';

export default function StaffLayout() {
  const { logout } = useAuthStore();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showGlobalException, setShowGlobalException] = useState(false);
  const [exceptionContext, setExceptionContext] = useState<any>(null);
  const location = useLocation();

  useEffect(() => {
    const handleF9 = (e?: Event) => {
      // Bỏ qua nếu đang ở trang Xử lý sự cố riêng
      if (location.pathname.includes('/exceptions')) return;

      const customEvent = e as CustomEvent;
      if (customEvent?.detail) {
        setExceptionContext(customEvent.detail);
      } else {
        setExceptionContext(null);
      }
      setShowGlobalException(true);
    };

    window.addEventListener('HOTKEY_F9', handleF9);
    return () => {
      window.removeEventListener('HOTKEY_F9', handleF9);
    };
  }, [location.pathname]);

  // We could expose a way for children to trigger logout,
  // but for now they can dispatch a custom event or use the store directly.
  return (
    <div className="flex flex-col h-screen bg-[#eff0ef] text-brand font-sans overflow-hidden">
      {/* MAIN CONTENT - No top header, full screen layout */}
      <main className="flex-1 overflow-y-auto min-h-0 flex flex-col">
        <PageTransition>
          <Outlet />
        </PageTransition>
      </main>

      <TerminalToolbar />

      <ConfirmModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={logout}
        title="Xác nhận Đăng xuất"
        message="Bạn có chắc chắn muốn kết thúc ca làm việc và đăng xuất không?"
        confirmText="Đăng xuất"
        cancelText="Hủy"
        variant="danger"
      />

      {showGlobalException && (
        <GlobalExceptionPanel
          coPlateCam={exceptionContext?.coPlateCam || ''}
          checkOutImage={exceptionContext?.checkOutImage || ''}
          currentSession={exceptionContext?.currentSession || null}
          onClose={() => setShowGlobalException(false)}
          onExceptionCreated={() => {
            window.dispatchEvent(new CustomEvent('RESET_CHECKOUT'));
          }}
        />
      )}
    </div>
  );
}
