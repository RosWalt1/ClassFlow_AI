/**
 * Servicio de Reconocimiento de Voz nativo (Web Speech API)
 * para Demo Mobile PWA de ClassFlow AI.
 * 
 * Responsabilidades:
 * - Iniciar y detener reconocimiento de voz sin dependencias externas.
 * - Manejar compatibilidad de navegador, permisos y errores amigables.
 * - Parser simple y genérico para rellenar formularios automáticamente.
 */

import { EntityConfig } from '../models/entity';

// Declaración de tipos para SpeechRecognition nativo del navegador
interface SpeechRecognitionWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

export type SpeechErrorType =
  | 'not-allowed'
  | 'no-speech'
  | 'audio-capture'
  | 'network'
  | 'not-supported'
  | 'unknown';

export class SpeechService {
  private recognition: any = null;
  private isListening = false;

  /**
   * Verifica si el navegador actual soporta Web Speech API
   */
  public isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    const win = window as unknown as SpeechRecognitionWindow;
    return Boolean(win.SpeechRecognition || win.webkitSpeechRecognition);
  }

  /**
   * Inicializa la instancia nativa de SpeechRecognition si está disponible
   */
  private initRecognition(): any {
    if (this.recognition) return this.recognition;

    const win = window as unknown as SpeechRecognitionWindow;
    const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      return null;
    }

    const instance = new SpeechRecognitionClass();
    instance.continuous = false; // Detener automáticamente al terminar de hablar
    instance.interimResults = false; // Solo resultados finales consolidados
    instance.lang = 'es-ES'; // Reconocimiento en español
    instance.maxAlternatives = 1;

    return instance;
  }

  /**
   * Inicia el reconocimiento de voz
   * @param onResult Callback con el texto reconocido
   * @param onError Callback con mensaje amigable de error
   * @param onEnd Callback cuando finaliza la escucha
   */
  public startListening(
    onResult: (text: string) => void,
    onError: (friendlyMessage: string) => void,
    onEnd?: () => void
  ): void {
    if (!this.isSupported()) {
      onError('Tu navegador no es compatible con el reconocimiento de voz');
      if (onEnd) onEnd();
      return;
    }

    try {
      // Detener cualquier sesión previa si estuviera activa
      this.stopListening();

      this.recognition = this.initRecognition();
      if (!this.recognition) {
        onError('Tu navegador no es compatible con el reconocimiento de voz');
        if (onEnd) onEnd();
        return;
      }

      this.recognition.onstart = () => {
        this.isListening = true;
      };

      this.recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            transcript += event.results[i][0].transcript;
          }
        }
        transcript = transcript.trim();
        if (transcript) {
          onResult(transcript);
        } else {
          onError('No se pudo reconocer la voz');
        }
      };

      this.recognition.onerror = (event: any) => {
        this.isListening = false;
        const errCode = event.error;

        if (errCode === 'not-allowed' || errCode === 'service-not-allowed') {
          onError('Permite acceso al micrófono para usar esta función');
        } else if (errCode === 'no-speech') {
          onError('No se pudo reconocer la voz');
        } else if (errCode === 'audio-capture') {
          onError('No se encontró un micrófono disponible');
        } else if (errCode === 'network') {
          onError('No se pudo conectar con el servicio de voz');
        } else {
          onError('No se pudo reconocer la voz');
        }
      };

      this.recognition.onend = () => {
        this.isListening = false;
        if (onEnd) {
          onEnd();
        }
      };

      this.recognition.start();
    } catch (err) {
      this.isListening = false;
      onError('No se pudo iniciar el micrófono');
      if (onEnd) onEnd();
    }
  }

  /**
   * Detiene manualmente la escucha del micrófono
   */
  public stopListening(): void {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch {
        // Ignorar si ya estaba detenido
      }
    }
    this.isListening = false;
  }

  /**
   * Estado actual de escucha
   */
  public getIsListening(): boolean {
    return this.isListening;
  }
}

export const speechService = new SpeechService();

/**
 * Parser simple, determinista y genérico para comandos de voz.
 * No requiere inteligencia artificial externa.
 * 
 * Adapta dinámicamente cualquier entidad según la configuración dada.
 * Ejemplos soportados:
 * - "registrar mascota Toby" -> { nombre: "Toby" }
 * - "registrar mascota Toby perro 3 años" -> { nombre: "Toby", raza: "Perro", edad: 3 }
 * - "nombre Toby raza Perro edad 3" -> { nombre: "Toby", raza: "Perro", edad: 3 }
 * - "Toby 3 años" -> { nombre: "Toby", edad: 3 }
 */
export function parseVoiceCommand(text: string, config: EntityConfig): Record<string, any> {
  if (!text || !text.trim()) {
    return {};
  }

  const rawClean = text.trim();
  const lower = rawClean.toLowerCase();
  const result: Record<string, any> = {};

  // 1. Extraer número para campos numéricos (como edad) si existe
  // Patrones: "3 años", "3 anos", "edad 3", o número suelto
  const numberFields = config.fields.filter((f) => f.type === 'number');
  let extractedNumber: number | null = null;
  const ageMatch = lower.match(/\b(\d+)\s*(años?|anos?|meses?)?\b/);
  if (ageMatch) {
    extractedNumber = parseInt(ageMatch[1], 10);
  }

  // 2. Comprobar si el usuario usó formato con etiquetas explícitas
  // Ej: "nombre Toby raza Perro edad 3"
  let hasExplicitLabels = false;
  for (const field of config.fields) {
    const fieldLabel = field.label.toLowerCase();
    const fieldName = field.name.toLowerCase();

    // Regex para buscar "nombre [valor]" o "raza [valor]"
    const labelPattern = new RegExp(
      `(?:${fieldName}|${fieldLabel})\\s*[:=]?\\s*([^,;]+?)(?=\\s+(?:${config.fields.map(f => `${f.name}|${f.label.toLowerCase()}`).join('|')})|$)`,
      'i'
    );
    const match = lower.match(labelPattern);
    if (match && match[1]) {
      hasExplicitLabels = true;
      let val = match[1].trim();
      if (field.type === 'number') {
        const num = parseInt(val.replace(/\D/g, ''), 10);
        if (!isNaN(num)) result[field.name] = num;
      } else if (field.type === 'boolean') {
        result[field.name] = val === 'si' || val === 'sí' || val === 'true' || val === 'habilitado';
      } else {
        // Formatear mayúscula inicial
        val = val.charAt(0).toUpperCase() + val.slice(1);
        result[field.name] = val;
      }
    }
  }

  if (hasExplicitLabels && Object.keys(result).length > 0) {
    return result;
  }

  // 3. Si no usó etiquetas explícitas, procesar lenguaje natural
  // Remover prefijos de acción comunes en español
  const entityNameLower = config.name.toLowerCase();
  const entityTitleLower = config.title.toLowerCase();

  let cleaned = lower;
  // Quitar comandos de inicio: "registrar mascota", "crear mascota", "nuevo cliente", "anotar", etc.
  const prefixRegex = new RegExp(
    `^(?:registrar|crear|agregar|nuevo|nueva|anotar|guardar|insertar)?\\s*(?:el|la|un|una)?\\s*(?:${entityNameLower}|${entityTitleLower})?\\s*`,
    'i'
  );
  cleaned = cleaned.replace(prefixRegex, '').trim();

  // Si después de quitar el prefijo quedó vacío pero el texto original era sólo el nombre
  if (!cleaned && rawClean) {
    cleaned = lower;
  }

  // Si había un número (edad/año), quitarlo del texto para no mezclarlo con nombres o razas
  if (extractedNumber !== null) {
    cleaned = cleaned.replace(new RegExp(`\\b${extractedNumber}\\s*(años?|anos?|meses?)?\\b`, 'gi'), ' ').trim();
  }

  // Dividir las palabras restantes para mapear a los campos de texto
  const tokens = cleaned
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && !['anos', 'años', 'ano', 'año'].includes(t));

  const textFields = config.fields.filter((f) => f.type === 'string' || f.type === 'text');

  if (tokens.length === 1 && textFields.length > 0) {
    // Caso 1: Solo un token (ej. "registrar mascota Toby" -> "Toby")
    const val = tokens[0].charAt(0).toUpperCase() + tokens[0].slice(1);
    result[textFields[0].name] = val;
  } else if (tokens.length >= 2 && textFields.length >= 2) {
    // Caso 2: Múltiples tokens (ej. "Toby perro" -> nombre: Toby, raza: Perro)
    result[textFields[0].name] = tokens[0].charAt(0).toUpperCase() + tokens[0].slice(1);
    const restTokens = tokens.slice(1).join(' ');
    result[textFields[1].name] = restTokens.charAt(0).toUpperCase() + restTokens.slice(1);
  } else if (tokens.length > 0 && textFields.length > 0) {
    result[textFields[0].name] = tokens.join(' ').charAt(0).toUpperCase() + tokens.join(' ').slice(1);
  }

  // Asignar el número al campo numérico si corresponde
  if (extractedNumber !== null && numberFields.length > 0) {
    result[numberFields[0].name] = extractedNumber;
  }

  return result;
}
