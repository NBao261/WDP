import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loading } from '../../../components/ui/Loading';
import { PaymentModal } from './components/PaymentModal';
import { useDashboard } from './hooks/useDashboard';
import { EmptyActiveState } from './components/EmptyActiveState';
import { ActiveParkingCard } from './components/ActiveParkingCard';

const DriverDashboard: React.FC = () => {
  const { loading, activeSession, qrUrl } = useDashboard();

  const [showPaymentModal, setShowPaymentModal] = useState(false);

  if (loading) {
    return <Loading text="Đang tải bảng điều khiển..." />;
  }

  return (
    <div className="w-full h-full flex flex-col items-center pt-6 pb-20 relative overflow-x-hidden">
      <AnimatePresence mode="wait">
        {!activeSession ? (
          <motion.div
            key="empty-state"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="w-full h-full flex-1"
          >
            <EmptyActiveState />
          </motion.div>
        ) : (
          <motion.div
            key="active-state"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
            transition={{ duration: 0.5, type: 'spring', bounce: 0.3 }}
            className="w-full max-w-5xl"
          >
            <div className="flex items-center justify-between mb-8 px-2">
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Bảng Điều Khiển</h1>
            </div>

            <ActiveParkingCard
              activeSession={activeSession}
              qrUrl={qrUrl}
              onShowPayment={() => setShowPaymentModal(true)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        sessionId={activeSession?._id || ''}
        amount={activeSession?.totalFee || 0}
      />
    </div>
  );
};

export default DriverDashboard;
