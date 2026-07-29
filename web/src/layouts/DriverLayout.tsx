import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { LogOut, User, Car, Clock, LayoutDashboard } from 'lucide-react';
import { PageTransition } from '../components/ui/PageTransition';

const DriverLayout: React.FC = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { label: 'Khám phá', path: '/driver/facilities', icon: <Car size={18} /> },
    { label: 'Đang gửi', path: '/driver/active-session', icon: <Clock size={18} /> },
    { label: 'Lịch sử', path: '/driver/history', icon: <LayoutDashboard size={18} /> },
  ];

  return (
    <div className="min-h-screen bg-surface text-brand flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-border px-4 md:px-8 h-[64px] flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-6">
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => navigate('/driver')}
          >
            <img src="/Logo_chu.png" alt="LYNC Park Logo" className="h-[48px] w-auto rounded-md" />
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-2 ml-4">
            {navItems.map((item) => {
              const isActive = location.pathname.startsWith(item.path);
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-accent text-accent-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-brand hover:bg-black/5'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-semibold text-brand">{user?.name || 'Khách hàng'}</p>
              <p className="text-xs text-muted-foreground">Khách Hàng</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center text-accent-foreground font-bold shadow-sm border border-border">
              {user?.name?.charAt(0).toUpperCase() || <User size={18} />}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
            title="Đăng xuất"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-[1400px] mx-auto p-4 md:p-8 relative">
        <PageTransition>
          <Outlet />
        </PageTransition>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 w-full bg-white/95 backdrop-blur-xl border-t border-border px-2 py-2 flex items-center justify-around z-50 pb-safe shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.path);
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
                isActive
                  ? 'text-accent-foreground bg-accent'
                  : 'text-muted-foreground hover:text-brand'
              }`}
            >
              {item.icon}
              <span className="text-[10px] font-semibold mt-1">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default DriverLayout;
