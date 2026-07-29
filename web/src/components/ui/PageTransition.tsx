import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

export function PageTransition({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="h-full w-full"
    >
      {children}
    </motion.div>
  );
}
