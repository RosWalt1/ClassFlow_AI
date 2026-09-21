/**
 * Modelo Genérico para Entidades consumidas desde cualquier backend Spring Boot
 * generado por ClassFlow AI.
 */
export interface Entity {
  id?: number;
  [key: string]: any;
}

export interface EntityFieldConfig {
  name: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'text';
  required?: boolean;
  placeholder?: string;
  defaultValue?: any;
}

export interface EntityConfig {
  name: string;
  title: string;
  endpoint: string; // e.g., 'clientes', 'productos', 'ventas'
  fields: EntityFieldConfig[];
}

/**
 * Entidad de demostración predeterminada (Mascota)
 * Adaptada para el escenario de prueba de ClassFlow AI.
 */
export const DEFAULT_ENTITY_CONFIG: EntityConfig = {
  name: 'Mascota',
  title: 'Mascotas',
  endpoint: 'mascotas',
  fields: [
    { name: 'nombre', label: 'Nombre', type: 'string', required: true, placeholder: 'Ej. Toby' },
    { name: 'raza', label: 'Raza', type: 'string', required: true, placeholder: 'Ej. Perro' },
    { name: 'edad', label: 'Edad', type: 'number', required: true, placeholder: 'Ej. 3' }
  ]
};
