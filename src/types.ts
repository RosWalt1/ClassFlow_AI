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

export interface UMLRelation {
  id: string;
  sourceId: string;
  targetId: string;
  type:
    | 'association'
    | 'aggregation'
    | 'composition'
    | 'inheritance'
    | 'dependency'
    | 'realization'
    | 'asociacion'
    | 'agregacion'
    | 'composicion'
    | 'herencia'
    | 'dependencia'
    | 'realizacion';
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
