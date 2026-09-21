import React, { useState } from 'react';
import { Entity, EntityConfig } from '../models/entity';
import { apiClient } from '../api/apiClient';
import { offlineStorage } from '../storage/offlineStorage';
import { EntityForm } from '../components/EntityForm';
import { ArrowLeft, WifiOff, Cloud } from 'lucide-react';

interface FormPageProps {
  config: EntityConfig;
  editingEntity?: Entity | null;
  onSuccess: () => void;
  onCancel: () => void;
  isOnline: boolean;
}

export const FormPage: React.FC<FormPageProps> = ({
  config,
  editingEntity,
  onSuccess,
  onCancel,
  isOnline,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (formData: Partial<Entity>) => {
    setIsSubmitting(true);
    setError(null);

    const isEdit = Boolean(editingEntity && editingEntity.id);

    // 1. Si hay conexión a internet, intentar enviar a backend Spring Boot
    if (isOnline) {
      try {
        if (isEdit) {
          await apiClient.update(config.endpoint, editingEntity!.id!, formData);
        } else {
          await apiClient.create(config.endpoint, formData);
        }
        setIsSubmitting(false);
        onSuccess();
        return;
      } catch (err: any) {
        console.warn('Error enviando a Spring Boot, almacenando como pendiente offline:', err);
        // Fallback a almacenamiento local si el backend no responde
        try {
          await offlineStorage.savePendingRecord(
            config.endpoint,
            formData,
            isEdit ? 'UPDATE' : 'CREATE',
            editingEntity?.id
          );
          setIsSubmitting(false);
          alert('El servidor Spring Boot no respondió. Registro guardado localmente en IndexedDB.');
          onSuccess();
          return;
        } catch (storageErr: any) {
          setError(`No se pudo guardar ni en backend ni en caché local: ${storageErr.message}`);
          setIsSubmitting(false);
          return;
        }
      }
    } else {
      // 2. Modo Offline directo: Guardar en cola IndexedDB
      try {
        await offlineStorage.savePendingRecord(
          config.endpoint,
          formData,
          isEdit ? 'UPDATE' : 'CREATE',
          editingEntity?.id
        );
        setIsSubmitting(false);
        alert('Modo offline: Registro guardado en IndexedDB. Se sincronizará al conectar con el backend.');
        onSuccess();
      } catch (err: any) {
        setError(`Error guardando localmente: ${err.message}`);
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="flex flex-col flex-1 max-w-md mx-auto w-full pb-10 select-none">
      {/* Barra superior de formulario móvil */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md px-4 py-3 border-b border-slate-200 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="p-2 -ml-2 rounded-lg text-slate-700 hover:bg-slate-100 active:scale-95 transition-all"
            title="Volver"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-base font-bold text-slate-900 leading-tight">
              {editingEntity ? `Editar ${config.name}` : `Registrar ${config.name}`}
            </h2>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
              {isOnline ? (
                <span className="text-emerald-600 flex items-center gap-1">
                  <Cloud className="w-3 h-3" />
                  Guardado directo en backend
                </span>
              ) : (
                <span className="text-amber-600 flex items-center gap-1">
                  <WifiOff className="w-3 h-3" />
                  Guardado local (Offline)
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 flex flex-col gap-4">
        {/* Banner de error si ocurre */}
        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
            {error}
          </div>
        )}

        {/* Formulario Genérico */}
        <EntityForm
          config={config}
          initialData={editingEntity}
          onSubmit={handleSubmit}
          onCancel={onCancel}
          isLoading={isSubmitting}
        />
      </div>
    </div>
  );
};
