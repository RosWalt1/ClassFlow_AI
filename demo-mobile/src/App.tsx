import { useState, useEffect } from 'react';
import { Entity, EntityConfig, DEFAULT_ENTITY_CONFIG } from './models/entity';
import { offlineStorage } from './storage/offlineStorage';
import { Home } from './pages/Home';
import { ListPage } from './pages/ListPage';
import { FormPage } from './pages/FormPage';
import { Download, Wifi, WifiOff } from 'lucide-react';

type Screen = 'home' | 'list' | 'form';

export function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [config, setConfig] = useState<EntityConfig>(DEFAULT_ENTITY_CONFIG);
  const [editingEntity, setEditingEntity] = useState<Entity | null>(null);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // Soporte de instalación PWA en Chrome Móvil
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [canInstallPwa, setCanInstallPwa] = useState(false);

  // Escuchar eventos de red
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

  // Escuchar evento PWA beforeinstallprompt
  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstallPwa(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  // Actualizar conteo de pendientes en IndexedDB
  const updatePendingCount = async () => {
    const pending = await offlineStorage.getPendingRecords();
    setPendingCount(pending.length);
  };

  useEffect(() => {
    updatePendingCount();
  }, [currentScreen, isOnline]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      alert('Para instalar esta aplicación, usa la opción "Instalar aplicación" o "Agregar a la pantalla principal" desde el menú de Chrome móvil.');
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setCanInstallPwa(false);
    }
    setDeferredPrompt(null);
  };

  const handleNavigateToEdit = (entity: Entity) => {
    setEditingEntity(entity);
    setCurrentScreen('form');
  };

  const handleNavigateToCreate = () => {
    setEditingEntity(null);
    setCurrentScreen('form');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col antialiased">
      {/* Barra superior de la aplicación (Mobile Header) */}
      <header className="sticky top-0 z-40 bg-blue-600 text-white shadow-md">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setCurrentScreen('home')}
            className="flex items-center gap-2 font-bold tracking-tight text-base hover:opacity-90 active:scale-98 transition-all"
          >
            <span className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center font-black text-sm">
              CF
            </span>
            <span>ClassFlow <span className="text-blue-200">Móvil</span></span>
          </button>

          <div className="flex items-center gap-2">
            {/* Indicador de Conexión */}
            <span
              className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                isOnline ? 'bg-emerald-500/20 text-emerald-100' : 'bg-amber-400/20 text-amber-200'
              }`}
              title={isOnline ? 'Conexión a internet activa' : 'Sin conexión. Modo offline.'}
            >
              {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              <span>{isOnline ? 'Online' : 'Offline'}</span>
            </span>

            {/* Botón Instalar PWA */}
            <button
              type="button"
              onClick={handleInstallClick}
              className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg transition-all ${
                canInstallPwa
                  ? 'bg-white text-blue-700 shadow-sm animate-pulse'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
              title="Instalar como app móvil"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Instalar</span>
            </button>
          </div>
        </div>
      </header>

      {/* Vistas Principales Móviles */}
      <main className="flex-1 flex flex-col">
        {currentScreen === 'home' && (
          <Home
            config={config}
            onChangeConfig={setConfig}
            onNavigateToList={() => setCurrentScreen('list')}
            onNavigateToForm={handleNavigateToCreate}
            isOnline={isOnline}
            pendingCount={pendingCount}
          />
        )}

        {currentScreen === 'list' && (
          <ListPage
            config={config}
            onNavigateToHome={() => setCurrentScreen('home')}
            onNavigateToCreate={handleNavigateToCreate}
            onNavigateToEdit={handleNavigateToEdit}
            isOnline={isOnline}
          />
        )}

        {currentScreen === 'form' && (
          <FormPage
            config={config}
            editingEntity={editingEntity}
            onSuccess={() => {
              updatePendingCount();
              setCurrentScreen('list');
            }}
            onCancel={() => setCurrentScreen('list')}
            isOnline={isOnline}
          />
        )}
      </main>

      {/* Barra de navegación inferior móvil para acceso rápido */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 max-w-md mx-auto shadow-lg">
        <div className="grid grid-cols-2 h-14">
          <button
            type="button"
            onClick={() => setCurrentScreen('home')}
            className={`flex flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-colors ${
              currentScreen === 'home' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Inicio</span>
          </button>
          <button
            type="button"
            onClick={() => setCurrentScreen('list')}
            className={`flex flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-colors ${
              currentScreen === 'list' || currentScreen === 'form'
                ? 'text-blue-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>{config.title}</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

export default App;
