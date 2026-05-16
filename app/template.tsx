'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

export default function Template({ children }: { children: ReactNode }) {
  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>

      {/* Contenido — aparece debajo del overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.22, delay: 0.14, ease: 'easeOut' }}
        style={{ height: '100%', width: '100%' }}
      >
        {children}
      </motion.div>

      {/* Overlay azul que tapa el flash — mismo gradiente que el botón morph */}
      <motion.div
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.22, delay: 0.1, ease: 'easeOut' }}
        style={{
          position: 'fixed', inset: 0,
          background: 'radial-gradient(ellipse at center, #ffffff 0%, #f4faff 35%, #e8f6fd 60%, #cceaf8 80%, #a8d8f0 100%)',
          zIndex: 9999,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
