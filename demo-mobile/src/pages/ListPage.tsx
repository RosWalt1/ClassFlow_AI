import React, { useState, useEffect, useCallback } from 'react';
import { Entity, EntityConfig } from '../models/entity';
import { apiClient } from '../api/apiClient';
import { offlineStorage } from '../storage/offlineStorage';
import { EntityCard } from '../components/EntityCard';
import { 
  ArrowLeft, 
  Plus, 
  RefreshCw, 
  Search, 
  WifiOff, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';

interface ListPageProps {
  config: EntityConfig;
  onNavigateToHome: () => void;
  onNavigateToCreate: () => void;
  onNavigateToEdit: (entity: Entity) => void;
  isOnline: boolean;
}

export const ListPage: React.FC<ListPageProps> = ({
  config,
  onNavigateToHome,
  onNavigateToCreate,
  onNavigateToEdit,
  isOnline,
}) => {
  const [items, setItems] = useState<Entity[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFromCache, setIsFromCache] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = useCallback(async (showRefreshingSpinner = false) => {
    if (showRefreshingSpinner) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMessage(null);

    // 1. Si está online, intentar consumir API REST de Spring Boot
    if (isOnline) {
      try {
        const remoteData = await apiClient.getAll(config.endpoint);
        setItems(remoteData);
        setIsFromCache(false);
        // Guardar copia local en IndexedDB para disponibilidad offline
        await offlineStorage.saveCachedEntities(config.endpoint, remoteData);
      } catch (err: any) {
        console.warn('Fallo al obtener datos de API Spring Boot, recurriendo a IndexedDB:', err);
        setErrorMessage('No se pudo contactar el backend Spring Boot. Mostrando copia local.');
        // Fallback a IndexedDB
        const cached = await offlineStorage.getCachedEntities(config.endpoint);
        setItems(cached);
        setIsFromCache(true);
      }
    } else {
      // 2. Si está offline, cargar directamente desde IndexedDB
      const cached = await offlineStorage.getCachedEntities(config.endpoint);
      setItems(cached);
      setIsFromCache(true);
    }

    setIsLoading(false);
    setIsRefreshing(false);
  }, [config.endpoint, isOnline]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelete = async (id: number) => {
    if (!window.confirm(`¿Estás seguro de eliminar este registro (#${id})?`)) return;

    if (isOnline) {
      try {
        await apiClient.delete(config.endpoint, id);
        setItems((prev) => prev.filter((item) => item.id !== id));
        // Actualizar caché
        const updated = items.filter((item) => item.id !== id);
        await offlineStorage.saveCachedEntities(config.endpoint, updated);
      } catch (err: any) {
        alert(`Error al eliminar en backend: ${err.message}`);
      }
    } else {
      // Modo offline: registrar operación pendiente y remover de vista local
      await offlineStorage.savePendingRecord(config.endpoint, { id }, 'DELETE', id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      alert('Registro eliminado localmente. Se aplicará al backend cuando vuelva la conexión.');
    }
  };

  const filteredItems = items.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return Object.values(item).some((val) =>
      String(val).toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col flex-1 max-w-md mx-auto w-full pb-20 select-none">
      {/* Barra de navegación superior móvil */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md px-4 py-3 border-b border-slate-200 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onNavigateToHome}
            className="p-2 -ml-2 rounded-lg text-slate-700 hover:bg-slate-100 active:scale-95 transition-all"
            title="Volver"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-base font-bold text-slate-900 leading-tight">
              {config.title}
            </h2>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
              {isFromCache ? (
                <span className="text-amber-600 flex items-center gap-1">
                  <WifiOff className="w-3 h-3" />
                  Caché local IndexedDB
                </span>
              ) : (
                <span className="text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Backend Spring Boot
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 active:scale-95 transition-all"
            title="Refrescar lista"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
          </button>
          <button
            type="button"
            onClick={onNavigateToCreate}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo</span>
          </button>
        </div>
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">
        {/* Buscador de registros */}
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Buscar en ${config.title.toLowerCase()}...`}
            className="w-full pl-9 pr-3.5 py-2.5 bg-white rounded-xl border border-slate-200 text-xs font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all shadow-2xs"
          />
        </div>

        {/* Mensaje de aviso de error / fallback */}
        {errorMessage && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Contenido de la lista */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
            <span className="w-8 h-8 border-3 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
            <span className="text-xs font-medium">Cargando registros...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center flex flex-col items-center justify-center gap-3 text-slate-500 shadow-2xs">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
              <Search className="w-6 h-6" />
            </div>
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-semibold text-slate-800">
                No hay registros disponibles
              </p>
              <p className="text-xs text-slate-400">
                {searchQuery ? 'Ningún resultado coincide con la búsqueda.' : 'Crea el primer registro con el botón inferior.'}
              </p>
            </div>
            <button
              type="button"
              onClick={onNavigateToCreate}
              className="mt-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold shadow-sm"
            >
              + Crear primer registro
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium px-1">
              <span>{filteredItems.length} resultado(s)</span>
              <span>Endpoint: /{config.endpoint}</span>
            </div>

            {filteredItems.map((item, idx) => (
              <EntityCard
                key={item.id ?? idx}
                entity={item}
                config={config}
                onEdit={onNavigateToEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Botón flotante para registrar (Mobile FAB) */}
      <button
        type="button"
        onClick={onNavigateToCreate}
        className="fixed bottom-6 right-6 z-30 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-xl flex items-center justify-center active:scale-95 transition-all cursor-pointer"
        title="Crear registro"
      >
        <Plus className="w-7 h-7" />
      </button>
    </div>
  );
};
