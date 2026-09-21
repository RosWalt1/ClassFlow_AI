import React, { useState } from 'react';
import { EntityConfig } from '../models/entity';
import { apiClient } from '../api/apiClient';
import { 
  ListOrdered, 
  PlusCircle, 
  Settings, 
  Wifi, 
  WifiOff, 
  Database,
  Layers,
  Server
} from 'lucide-react';

interface HomeProps {
  config: EntityConfig;
  onChangeConfig: (newConfig: EntityConfig) => void;
  onNavigateToList: () => void;
  onNavigateToForm: () => void;
  isOnline: boolean;
  pendingCount: number;
}

export const Home: React.FC<HomeProps> = ({
  config,
  onChangeConfig,
  onNavigateToList,
  onNavigateToForm,
  isOnline,
  pendingCount,
}) => {
  const [showConfig, setShowConfig] = useState(false);
  const [apiUrl, setApiUrl] = useState(apiClient.getBaseUrl());
  const [entityName, setEntityName] = useState(config.name);
  const [endpoint, setEndpoint] = useState(config.endpoint);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    apiClient.setBaseUrl(apiUrl);
    onChangeConfig({
      ...config,
      name: entityName.trim() || 'Entidad',
      title: `${entityName.trim()}s`,
      endpoint: endpoint.trim() || 'entidades',
    });
    setShowConfig(false);
  };

  return (
    <div className="flex flex-col flex-1 px-4 py-6 max-w-md mx-auto w-full gap-6 select-none">
      {/* Estado de conectividad y backend */}
      <div className="flex items-center justify-between bg-white rounded-xl p-3 border border-slate-200 shadow-sm text-xs">
        <div className="flex items-center gap-2">
          {isOnline ? (
            <span className="flex items-center gap-1.5 font-semibold text-emerald-600">
              <Wifi className="w-4 h-4 text-emerald-500" />
              En línea
            </span>
          ) : (
            <span className="flex items-center gap-1.5 font-semibold text-amber-600">
              <WifiOff className="w-4 h-4 text-amber-500" />
              Modo Offline
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowConfig(!showConfig)}
          className="flex items-center gap-1 text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Configurar API</span>
        </button>
      </div>

      {/* Tarjeta Principal de la Aplicación (Estructura Solicitada) */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-md flex flex-col items-center text-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-inner">
          <Layers className="w-8 h-8" />
        </div>

        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Mi Aplicación
          </h1>
          <div className="inline-flex items-center justify-center gap-1 text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full mx-auto">
            <Database className="w-3.5 h-3.5" />
            <span>Entidad: <strong>{config.name}</strong></span>
          </div>
          <p className="text-xs text-slate-500 pt-1">
            Plantilla móvil lista para consumir cualquier backend Spring Boot generado por ClassFlow AI.
          </p>
        </div>

        {/* Botones Grandes de Acción */}
        <div className="flex flex-col gap-3 w-full pt-2">
          <button
            type="button"
            onClick={onNavigateToList}
            className="w-full min-h-[52px] flex items-center justify-center gap-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-base shadow-md shadow-blue-500/20 active:scale-98 transition-all cursor-pointer"
          >
            <ListOrdered className="w-5 h-5" />
            <span>Ver registros</span>
          </button>

          <button
            type="button"
            onClick={onNavigateToForm}
            className="w-full min-h-[52px] flex items-center justify-center gap-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 font-semibold text-base border border-slate-200 active:scale-98 transition-all cursor-pointer"
          >
            <PlusCircle className="w-5 h-5 text-blue-600" />
            <span>Registrar</span>
          </button>
        </div>
      </div>

      {/* Indicador de registros pendientes offline si existen */}
      {pendingCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Tienes <strong>{pendingCount}</strong> registro(s) guardado(s) localmente pendiente(s) de sincronizar.
            </span>
          </div>
        </div>
      )}

      {/* Panel de Configuración de Backend Spring Boot */}
      {showConfig && (
        <form onSubmit={handleSaveSettings} className="bg-slate-100 rounded-xl p-4 flex flex-col gap-3 border border-slate-300 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-700 flex items-center gap-1.5">
              <Server className="w-4 h-4 text-blue-600" />
              Configuración de Conexión Spring Boot
            </span>
            <button
              type="button"
              onClick={() => setShowConfig(false)}
              className="text-slate-400 hover:text-slate-700 font-bold"
            >
              ✕
            </button>
          </div>

          <div>
            <label className="text-slate-600 block mb-1">URL Base de API Spring Boot:</label>
            <input
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="http://localhost:8080/api"
              className="w-full bg-white p-2.5 rounded-lg border border-slate-300 text-slate-800 font-mono text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-slate-600 block mb-1">Nombre Entidad:</label>
              <input
                type="text"
                value={entityName}
                onChange={(e) => setEntityName(e.target.value)}
                placeholder="Cliente"
                className="w-full bg-white p-2 rounded-lg border border-slate-300 text-slate-800 text-xs"
              />
            </div>
            <div>
              <label className="text-slate-600 block mb-1">Endpoint REST:</label>
              <input
                type="text"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="clientes"
                className="w-full bg-white p-2 rounded-lg border border-slate-300 text-slate-800 font-mono text-xs"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              className="flex-1 py-2 rounded-lg bg-blue-600 text-white font-semibold"
            >
              Guardar Configuración
            </button>
            <button
              type="button"
              onClick={() => {
                apiClient.resetBaseUrl();
                setApiUrl(apiClient.getBaseUrl());
              }}
              className="px-3 py-2 rounded-lg bg-slate-200 text-slate-700"
            >
              Restablecer
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
