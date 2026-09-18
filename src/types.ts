export type AppScreen =
  | 'editor'
  | 'proyectos'
  | 'compartidos'
  | 'backend'
  | 'login'
  | 'register'
  | 'perfil';

export interface UMLAttribute {
  id: string;
  visibility: '-' | '+' | '#' | '~';
  name: string;
  type: string;
  isPk?: boolean;
  isNullable?: boolean;
  isStatic?: boolean;
  isFinal?: boolean;
}

export interface UMLMethod {
  id: string;
  visibility: '-' | '+' | '#' | '~';
  name: string;
  returnType: string;
  params?: string;
}

export interface UMLClassNode {
  id: string;
  name: string;
  stereotype: string;
  x: number;
  y: number;
  width?: number;
  attributes: UMLAttribute[];
  methods: UMLMethod[];
  isConcrete?: boolean;
}

// Tipos oficiales canónicos de relaciones UML según modelo persistente de ClassFlow AI
export type CanonicalUMLRelationType =
  | 'asociacion'
  | 'agregacion'
  | 'composicion'
  | 'herencia'
  | 'dependencia'
  | 'realizacion';

// Tipos legados en inglés (admitidos únicamente por compatibilidad con mocks de fases posteriores)
export type LegacyUMLRelationType =
  | 'association'
  | 'aggregation'
  | 'composition'
  | 'inheritance'
  | 'dependency'
  | 'realization';

export type UMLRelationType = CanonicalUMLRelationType | LegacyUMLRelationType;

export const toCanonicalRelationType = (type: string): CanonicalUMLRelationType => {
  const norm = type.trim().toLowerCase();
  switch (norm) {
    case 'association':
    case 'asociacion':
      return 'asociacion';
    case 'aggregation':
    case 'agregacion':
      return 'agregacion';
    case 'composition':
    case 'composicion':
      return 'composicion';
    case 'inheritance':
    case 'herencia':
      return 'herencia';
    case 'dependency':
    case 'dependencia':
      return 'dependencia';
    case 'realization':
    case 'realizacion':
      return 'realizacion';
    default:
      return 'asociacion';
  }
};

export interface UMLRelation {
  id: string;
  sourceId: string;
  targetId: string;
  type: UMLRelationType;
  sourceMultiplicity: string;
  targetMultiplicity: string;
  roleName?: string;
}

export interface ProjectItem {
  id: string;
  name: string;
  description: string;
  isOwner: boolean;
  role: 'Propietario' | 'Invitado';
  stackBadge: string;
  classesCount: number;
  relationsCount: number;
  version: string;
  modifiedAgo: string;
  schemaPreview: {
    left: string;
    arrow: string;
    right: string;
    tag?: string;
  };
  collaborators: {
    name: string;
    avatar: string;
    role: string;
  }[];
}

export interface UserProfile {
  name: string;
  email: string;
  role: 'Propietario' | 'Invitado';
  avatar: string;
  permissionsBadge: string;
}
