import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MainContent } from './MainContent';
import { PageTransition } from '../components/ui/PageTransition';

const MainLayout = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen bg-surface text-brand font-sans overflow-hidden">
      <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

      <MainContent>
        <Header onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />
        <div className="flex-1 overflow-y-auto px-4 lg:px-8 pb-4 lg:pb-8 pt-[10px] flex flex-col min-h-0">
          <PageTransition>
            <Outlet />
          </PageTransition>
        </div>
      </MainContent>
    </div>
  );
};

export default MainLayout;
