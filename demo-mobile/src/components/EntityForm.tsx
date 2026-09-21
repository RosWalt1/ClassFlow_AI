import React, { useState, useEffect } from 'react';
import { Entity, EntityConfig } from '../models/entity';
import { speechService, parseVoiceCommand } from '../services/speechService';
import { Save, X, Mic, Volume2, AlertCircle, Sparkles } from 'lucide-react';

interface EntityFormProps {
  config: EntityConfig;
  initialData?: Entity | null;
  onSubmit: (data: Partial<Entity>) => Promise<void> | void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const EntityForm: React.FC<EntityFormProps> = ({
  config,
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isListening, setIsListening] = useState(false);
  const [voiceFeedback, setVoiceFeedback] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceSuccessMessage, setVoiceSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setFormData({ ...initialData });
    } else {
      const initial: Record<string, any> = {};
      config.fields.forEach((f) => {
        initial[f.name] = f.defaultValue !== undefined ? f.defaultValue : '';
      });
      setFormData(initial);
    }
  }, [initialData, config]);

  const handleChange = (name: string, value: any) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleVoiceToggle = () => {
    if (isListening) {
      speechService.stopListening();
      setIsListening(false);
      return;
    }

    setVoiceError(null);
    setVoiceFeedback(null);
    setVoiceSuccessMessage(null);
    setIsListening(true);

    speechService.startListening(
      (transcript: string) => {
        setVoiceFeedback(transcript);
        const parsed = parseVoiceCommand(transcript, config);
        const parsedKeys = Object.keys(parsed);

        if (parsedKeys.length > 0) {
          setFormData((prev) => ({ ...prev, ...parsed }));
          // Limpiar errores para los campos completados
          setErrors((prev) => {
            const updated = { ...prev };
            parsedKeys.forEach((k) => delete updated[k]);
            return updated;
          });
          setVoiceSuccessMessage(
            `Datos completados: ${parsedKeys.map((k) => `${k}: ${parsed[k]}`).join(', ')}`
          );
          setVoiceError(null);
        } else {
          setVoiceError('No se encontró información válida');
        }
      },
      (friendlyMessage: string) => {
        setIsListening(false);
        setVoiceError(friendlyMessage);
      },
      () => {
        setIsListening(false);
      }
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validaciones básicas
    const newErrors: Record<string, string> = {};
    config.fields.forEach((f) => {
      if (f.required && (!formData[f.name] || String(formData[f.name]).trim() === '')) {
        newErrors[f.name] = `El campo ${f.label} es obligatorio.`;
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex flex-col gap-4">
        {config.fields.map((field) => (
          <div key={field.name} className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>

            {field.type === 'boolean' ? (
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={Boolean(formData[field.name])}
                  onChange={(e) => handleChange(field.name, e.target.checked)}
                  className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                />
                <span className="text-sm text-slate-700">Habilitado</span>
              </label>
            ) : field.type === 'number' ? (
              <input
                type="number"
                value={formData[field.name] ?? ''}
                onChange={(e) => handleChange(field.name, e.target.value === '' ? '' : Number(e.target.value))}
                placeholder={field.placeholder}
                className="w-full min-h-[46px] px-3.5 py-2.5 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm text-slate-900 font-medium transition-all"
              />
            ) : field.type === 'text' ? (
              <textarea
                rows={3}
                value={formData[field.name] ?? ''}
                onChange={(e) => handleChange(field.name, e.target.value)}
                placeholder={field.placeholder}
                className="w-full p-3 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm text-slate-900 font-medium transition-all resize-none"
              />
            ) : (
              <input
                type={field.type === 'date' ? 'date' : 'text'}
                value={formData[field.name] ?? ''}
                onChange={(e) => handleChange(field.name, e.target.value)}
                placeholder={field.placeholder}
                className="w-full min-h-[46px] px-3.5 py-2.5 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm text-slate-900 font-medium transition-all"
              />
            )}

            {errors[field.name] && (
              <span className="text-xs text-red-600 font-medium">{errors[field.name]}</span>
            )}
          </div>
        ))}
      </div>

      {/* Mensajes de retroalimentación de voz */}
      {voiceFeedback && (
        <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2 shadow-2xs">
          <Volume2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-[11px] text-blue-700 uppercase tracking-wide">Voz Reconocida:</span>
            <span className="italic">"{voiceFeedback}"</span>
            {voiceSuccessMessage && (
              <span className="text-emerald-700 font-medium mt-1 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                {voiceSuccessMessage}
              </span>
            )}
          </div>
        </div>
      )}

      {voiceError && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2 shadow-2xs">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="font-medium">{voiceError}</span>
        </div>
      )}

      {/* Botones de acción móviles */}
      <div className="flex flex-col gap-2.5 pt-1">
        {/* Botón de reconocimiento por voz 🎤 Hablar */}
        <button
          type="button"
          onClick={handleVoiceToggle}
          disabled={isLoading}
          className={`w-full min-h-[48px] flex items-center justify-center gap-2 rounded-xl font-semibold text-sm transition-all border cursor-pointer active:scale-98 ${
            isListening
              ? 'bg-red-50 border-red-300 text-red-700 animate-pulse'
              : 'bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border-slate-200 text-slate-800 shadow-2xs'
          }`}
        >
          <Mic className={`w-4 h-4 ${isListening ? 'text-red-600 animate-bounce' : 'text-blue-600'}`} />
          <span>{isListening ? '🎤 Escuchando... Di los datos' : '🎤 Hablar'}</span>
        </button>

        {/* Botón Guardar */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full min-h-[50px] flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm shadow-md shadow-blue-500/20 active:scale-98 transition-all disabled:opacity-60 cursor-pointer"
        >
          {isLoading ? (
            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Guardar</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="w-full min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-semibold text-sm transition-all cursor-pointer"
        >
          <X className="w-4 h-4" />
          <span>Cancelar</span>
        </button>
      </div>
    </form>
  );
};
