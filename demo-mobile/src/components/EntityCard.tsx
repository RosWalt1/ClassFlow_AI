import React from 'react';
import { Entity, EntityConfig } from '../models/entity';
import { Edit2, Trash2, CloudOff, CheckCircle2 } from 'lucide-react';

interface EntityCardProps {
  entity: Entity;
  config: EntityConfig;
  onEdit?: (entity: Entity) => void;
  onDelete?: (id: number) => void;
}

export const EntityCard: React.FC<EntityCardProps> = ({
  entity,
  config,
  onEdit,
  onDelete,
}) => {
  const isPending = Boolean(entity._isPendingOffline);

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex flex-col gap-3 transition-shadow active:shadow-md">
      {/* Encabezado de la tarjeta */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
            #{entity.id}
          </span>
          <span className="text-xs text-slate-500 font-medium">
            {config.name}
          </span>
        </div>

        {isPending ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
            <CloudOff className="w-3 h-3" />
            Pendiente
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="w-3 h-3" />
            Sincronizado
          </span>
        )}
      </div>

      {/* Contenido de la entidad */}
      {config.name.toLowerCase() === 'mascota' || (entity.nombre && entity.raza !== undefined) ? (
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-bold text-slate-900 tracking-tight">
            {entity.nombre}
          </h3>
          <p className="text-sm font-medium text-slate-600">
            {entity.raza}
          </p>
          {entity.edad !== undefined && (
            <p className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md inline-block w-fit mt-0.5">
              {entity.edad} {Number(entity.edad) === 1 ? 'año' : 'años'}
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 text-sm">
          {config.fields.map((field) => {
            const val = entity[field.name];
            if (val === undefined || val === null || val === '') return null;
            return (
              <div key={field.name} className="flex justify-between items-baseline gap-2">
                <span className="text-xs text-slate-500 font-medium shrink-0">
                  {field.label}:
                </span>
                <span className="text-slate-900 font-medium truncate text-right">
                  {typeof val === 'boolean' ? (val ? 'Sí' : 'No') : String(val)}
                </span>
              </div>
            );
          })}

          {/* Campos adicionales no configurados explícitamente */}
          {Object.entries(entity)
            .filter(
              ([key]) =>
                key !== 'id' &&
                key !== '_isPendingOffline' &&
                !config.fields.some((f) => f.name === key)
            )
            .map(([key, val]) => (
              <div key={key} className="flex justify-between items-baseline gap-2 text-xs">
                <span className="text-slate-400 capitalize">{key}:</span>
                <span className="text-slate-700 font-mono truncate">{String(val)}</span>
              </div>
            ))}
        </div>
      )}

      {/* Botones de acción móviles (Touch targets grandes) */}
      <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
        {onEdit && (
          <button
            type="button"
            onClick={() => onEdit(entity)}
            className="flex-1 min-h-[42px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold active:scale-98 transition-all"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Editar</span>
          </button>
        )}

        {onDelete && entity.id && (
          <button
            type="button"
            onClick={() => onDelete(entity.id!)}
            className="flex-1 min-h-[42px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold active:scale-98 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Eliminar</span>
          </button>
        )}
      </div>
    </div>
  );
};
