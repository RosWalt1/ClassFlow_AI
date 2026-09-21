/**
 * Componente Reutilizable: Indicador Global Offline (Paso 4)
 * Muestra el estado "Sin conexión a internet / Modo lectura offline".
 * Desaparece automáticamente cuando vuelve la conexión a internet.
 */
import React, { useState, useEffect } from 'react';

interface OfflineIndicatorProps {
  compact?: boolean;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ compact = false }) => {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) {
    return null;
  }

  if (compact) {
    return (
      <div
        id="offline-indicator-compact"
        className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 shadow-md select-none transition-all"
        title="Sin conexión a internet. Modo lectura offline activado."
      >
        <span className="text-amber-400 font-bold text-xs">⚠</span>
        <span className="text-xs font-semibold tracking-tight">Sin conexión a internet</span>
        <span className="text-outline-variant font-mono text-[10px] hidden sm:inline">|</span>
        <span className="text-xs font-mono text-amber-200/90 hidden sm:inline">Modo lectura offline</span>
      </div>
    );
  }

  return (
    <div
      id="offline-indicator-banner"
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 px-4 py-1.5 bg-gradient-to-r from-amber-950/90 via-amber-900/80 to-amber-950/90 border-b border-amber-500/40 text-amber-300 text-xs font-mono shadow-md backdrop-blur-md select-none transition-all"
    >
      <span className="text-amber-400 font-bold text-sm">⚠</span>
      <span className="font-bold tracking-tight">Sin conexión a internet</span>
      <span className="text-amber-400/50">•</span>
      <span className="text-amber-200/90 font-medium">Modo lectura offline</span>
    </div>
  );
};
