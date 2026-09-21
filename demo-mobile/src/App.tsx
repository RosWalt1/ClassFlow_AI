import { useState, useEffect } from 'react';
import { Entity, EntityConfig, DEFAULT_ENTITY_CONFIG } from './models/entity';
import { offlineStorage } from './storage/offlineStorage';
import { syncService } from './services/syncService';
import { Home } from './pages/Home';
import { ListPage } from './pages/ListPage';
import { FormPage } from './pages/FormPage';
import { Download, Wifi, WifiOff } from 'lucide-react';

type Screen = 'home' | 'list' | 'form';

export function App() {

  const [currentScreen, setCurrentScreen] = useState<Screen>('home');

  const [config, setConfig] = useState<EntityConfig>(
    DEFAULT_ENTITY_CONFIG
  );

  const [editingEntity, setEditingEntity] =
    useState<Entity | null>(null);

  const [pendingCount, setPendingCount] =
    useState<number>(0);

  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined'
      ? navigator.onLine
      : true
  );


  // Soporte instalación PWA
  const [deferredPrompt, setDeferredPrompt] =
    useState<any>(null);

  const [canInstallPwa, setCanInstallPwa] =
    useState(false);



  /*
   * Detectar conexión y sincronizar pendientes
   */
  useEffect(() => {


    const handleOnline = async () => {

      setIsOnline(true);


      console.log(
        '[APP] Internet restaurado'
      );


      // Ejecutar sincronización automática
      await syncService.syncPendingRecords();


      // Actualizar contador después de sincronizar
      await updatePendingCount();

    };



    const handleOffline = () => {

      console.log(
        '[APP] Modo offline'
      );

      setIsOnline(false);

    };



    window.addEventListener(
      'online',
      handleOnline
    );


    window.addEventListener(
      'offline',
      handleOffline
    );



    return () => {

      window.removeEventListener(
        'online',
        handleOnline
      );


      window.removeEventListener(
        'offline',
        handleOffline
      );

    };


  }, []);




  /*
   * Evento instalación PWA
   */
  useEffect(() => {


    const handleBeforeInstall = (e: Event) => {

      e.preventDefault();

      setDeferredPrompt(e);

      setCanInstallPwa(true);

    };


    window.addEventListener(
      'beforeinstallprompt',
      handleBeforeInstall
    );



    return () => {

      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstall
      );

    };


  }, []);




  /*
   * Actualizar contador IndexedDB
   */
  const updatePendingCount = async () => {

    const pending =
      await offlineStorage.getPendingRecords();


    setPendingCount(
      pending.length
    );

  };



  useEffect(() => {

    updatePendingCount();

  }, [currentScreen, isOnline]);





  const handleInstallClick = async () => {


    if (!deferredPrompt) {

      alert(
        'Para instalar esta aplicación, usa la opción "Instalar aplicación" o "Agregar a pantalla principal" desde Chrome.'
      );

      return;

    }


    deferredPrompt.prompt();


    const { outcome } =
      await deferredPrompt.userChoice;



    if (outcome === 'accepted') {

      setCanInstallPwa(false);

    }


    setDeferredPrompt(null);


  };




  const handleNavigateToEdit = (
    entity: Entity
  ) => {

    setEditingEntity(entity);

    setCurrentScreen('form');

  };




  const handleNavigateToCreate = () => {

    setEditingEntity(null);

    setCurrentScreen('form');

  };




  return (

    <div className="min-h-screen bg-slate-50 flex flex-col antialiased">


      <header className="sticky top-0 z-40 bg-blue-600 text-white shadow-md">


        <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">


          <button
            type="button"
            onClick={() => setCurrentScreen('home')}
            className="flex items-center gap-2 font-bold tracking-tight text-base"
          >

            <span className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center font-black text-sm">
              CF
            </span>


            <span>
              ClassFlow
              <span className="text-blue-200">
                {' '}Móvil
              </span>
            </span>


          </button>



          <div className="flex items-center gap-2">


            <span
              className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${isOnline
                  ? 'bg-emerald-500/20 text-emerald-100'
                  : 'bg-amber-400/20 text-amber-200'
                }`}
            >

              {isOnline
                ? <Wifi className="w-3 h-3" />
                : <WifiOff className="w-3 h-3" />
              }


              <span>
                {isOnline
                  ? 'Online'
                  : 'Offline'
                }
              </span>


            </span>



            <button
              type="button"
              onClick={handleInstallClick}
              className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg ${canInstallPwa
                  ? 'bg-white text-blue-700 animate-pulse'
                  : 'bg-white/10 text-white'
                }`}
            >

              <Download className="w-3.5 h-3.5" />

              <span>
                Instalar
              </span>


            </button>


          </div>


        </div>


      </header>





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
            onCancel={() =>
              setCurrentScreen('list')
            }
            isOnline={isOnline}
          />

        )}



      </main>




      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 max-w-md mx-auto shadow-lg">


        <div className="grid grid-cols-2 h-14">


          <button
            onClick={() => setCurrentScreen('home')}
            className="text-xs font-semibold"
          >
            Inicio
          </button>


          <button
            onClick={() => setCurrentScreen('list')}
            className="text-xs font-semibold"
          >
            {config.title}
          </button>


        </div>


      </nav>



    </div>

  );

}



export default App;