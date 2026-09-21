import React, { useState, useEffect, useCallback } from 'react';
import { AppScreen, UserProfile } from '../types';
import { ASSETS } from '../data/mockData';
import {
  proyectoService,
  ProyectoApiItem,
  ColaboradorApiItem,
} from '../services/proyectoService';

interface ProjectsScreenProps {
  onNavigate: (screen: AppScreen) => void;
  currentUser: UserProfile;
  initialFilter?: 'all' | 'owner' | 'guest';
  onOpenProject?: (projectId: number) => void;
}

export const ProjectsScreen: React.FC<ProjectsScreenProps> = ({
  onNavigate,
  currentUser,
  initialFilter = 'all',
  onOpenProject,
}) => {
  const [projects, setProjects] = useState<ProyectoApiItem[]>([]);
  const [filterTab, setFilterTab] = useState<'all' | 'owner' | 'guest'>(initialFilter);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'modified' | 'name' | 'classes'>('modified');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Conectividad nativa online / offline
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const isOffline = !isOnline;

  // Loading & Error states
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal Crear Proyecto State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('Microservicio de Pagos');
  const [newProjectDesc, setNewProjectDesc] = useState(
    'Definición de clases para procesador Stripe, transacciones, webhooks y conciliación contable.'
  );
  const [newProjectStack, setNewProjectStack] = useState('Spring Boot (Java 17)');
  const [newProjectPerms, setNewProjectPerms] = useState('Solo yo (Privado)');
  const [newProjectTemplate, setNewProjectTemplate] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // Modal Editar Proyecto State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProyectoApiItem | null>(null);
  const [editProjectName, setEditProjectName] = useState('');
  const [editProjectDesc, setEditProjectDesc] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Modal Gestionar Colaboradores State
  const [isColabModalOpen, setIsColabModalOpen] = useState(false);
  const [colabProject, setColabProject] = useState<ProyectoApiItem | null>(null);
  const [collaboratorsList, setCollaboratorsList] = useState<ColaboradorApiItem[]>([]);
  const [newColabEmail, setNewColabEmail] = useState('');
  const [newColabPermiso, setNewColabPermiso] = useState(true);
  const [isAddingColab, setIsAddingColab] = useState(false);
  const [colabModalError, setColabModalError] = useState<string | null>(null);
  const [colabModalSuccess, setColabModalSuccess] = useState<string | null>(null);

  // Dropdown menu state
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);

  // Cargar proyectos desde el backend real
  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await proyectoService.getProyectos(filterTab);
      setProjects(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al conectar con el servidor de proyectos.');
    } finally {
      setIsLoading(false);
    }
  }, [filterTab]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Cerrar mensajes de éxito automáticamente
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Filtered and Sorted projects
  const filteredProjects = projects
    .filter((p) => {
      if (filterTab === 'owner') return p.es_propietario;
      if (filterTab === 'guest') return !p.es_propietario;
      return true;
    })
    .filter((p) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        p.nombre.toLowerCase().includes(q) ||
        (p.descripcion && p.descripcion.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      if (sortOrder === 'name') return a.nombre.localeCompare(b.nombre);
      if (sortOrder === 'classes') return b.total_clases - a.total_clases;
      // Default: última modificación
      return new Date(b.fecha_modificacion).getTime() - new Date(a.fecha_modificacion).getTime();
    });

  // Handler: Crear nuevo proyecto (CU02)
  const handleCreateProject = async () => {
    if (isOffline) {
      setErrorMessage('Esta función requiere conexión a internet. Disponible cuando vuelva la conexión.');
      return;
    }
    if (!newProjectName.trim()) return;
    setIsCreating(true);
    setErrorMessage(null);
    try {
      const created = await proyectoService.createProyecto({
        nombre: newProjectName.trim(),
        descripcion: newProjectDesc.trim() || undefined,
      });
      setSuccessMessage(`Proyecto "${created.nombre}" creado exitosamente.`);
      setIsCreateModalOpen(false);
      setNewProjectName('');
      setNewProjectDesc('');
      await loadProjects();
    } catch (err: any) {
      setErrorMessage(err.message || 'No se pudo crear el proyecto.');
    } finally {
      setIsCreating(false);
    }
  };

  // Handler: Abrir modal de edición
  const handleOpenEdit = (project: ProyectoApiItem) => {
    setActiveMenuId(null);
    if (isOffline) {
      alert('Esta función requiere conexión a internet. Disponible cuando vuelva la conexión.');
      return;
    }
    setEditingProject(project);
    setEditProjectName(project.nombre);
    setEditProjectDesc(project.descripcion || '');
    setIsEditModalOpen(true);
  };

  // Handler: Guardar cambios de edición (CU02)
  const handleUpdateProject = async () => {
    if (isOffline) {
      setErrorMessage('Esta función requiere conexión a internet. Disponible cuando vuelva la conexión.');
      return;
    }
    if (!editingProject || !editProjectName.trim()) return;
    setIsUpdating(true);
    setErrorMessage(null);
    try {
      const updated = await proyectoService.updateProyecto(editingProject.id_proyecto, {
        nombre: editProjectName.trim(),
        descripcion: editProjectDesc.trim() || undefined,
      });
      setSuccessMessage(`Proyecto "${updated.nombre}" actualizado correctamente.`);
      setIsEditModalOpen(false);
      setEditingProject(null);
      await loadProjects();
    } catch (err: any) {
      setErrorMessage(err.message || 'No se pudo actualizar el proyecto.');
    } finally {
      setIsUpdating(false);
    }
  };

  // Handler: Archivar proyecto (CU02)
  const handleArchiveProject = async (project: ProyectoApiItem) => {
    setActiveMenuId(null);
    if (isOffline) {
      alert('Esta función requiere conexión a internet. Disponible cuando vuelva la conexión.');
      return;
    }
    if (!window.confirm(`¿Estás seguro de archivar el proyecto "${project.nombre}"?`)) return;
    try {
      await proyectoService.archiveProyecto(project.id_proyecto);
      setSuccessMessage(`Proyecto "${project.nombre}" archivado.`);
      await loadProjects();
    } catch (err: any) {
      setErrorMessage(err.message || 'No se pudo archivar el proyecto.');
    }
  };

  // Handler: Eliminar proyecto (CU02)
  const handleDeleteProject = async (project: ProyectoApiItem) => {
    setActiveMenuId(null);
    if (isOffline) {
      alert('Esta función requiere conexión a internet. Disponible cuando vuelva la conexión.');
      return;
    }
    if (!window.confirm(`¿Deseas eliminar el proyecto "${project.nombre}"?`)) return;
    try {
      await proyectoService.deleteProyecto(project.id_proyecto);
      setSuccessMessage(`Proyecto "${project.nombre}" eliminado correctamente.`);
      await loadProjects();
    } catch (err: any) {
      setErrorMessage(err.message || 'No se pudo eliminar el proyecto.');
    }
  };

  // Handler: Abrir modal de gestión de colaboradores
  const handleOpenColaboradores = async (project: ProyectoApiItem) => {
    setActiveMenuId(null);
    if (isOffline) {
      alert('Esta función requiere conexión a internet. Disponible cuando vuelva la conexión.');
      return;
    }
    setColabProject(project);
    setColabModalError(null);
    setColabModalSuccess(null);
    setNewColabEmail('');
    setIsColabModalOpen(true);
    try {
      const colabs = await proyectoService.getColaboradores(project.id_proyecto);
      setCollaboratorsList(colabs);
    } catch (err: any) {
      setColabModalError(err.message || 'Error al cargar los colaboradores.');
    }
  };

  // Handler: Agregar colaborador
  const handleAddColaborador = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!colabProject || !newColabEmail.trim()) return;
    setIsAddingColab(true);
    setColabModalError(null);
    setColabModalSuccess(null);
    try {
      const added = await proyectoService.addColaborador(
        colabProject.id_proyecto,
        newColabEmail.trim(),
        newColabPermiso
      );
      setColabModalSuccess(`Colaborador ${added.nombre} (${added.email}) agregado exitosamente.`);
      setNewColabEmail('');
      // Recargar colaboradores
      const updatedList = await proyectoService.getColaboradores(colabProject.id_proyecto);
      setCollaboratorsList(updatedList);
      await loadProjects();
    } catch (err: any) {
      setColabModalError(err.message || 'Error al agregar colaborador.');
    } finally {
      setIsAddingColab(false);
    }
  };

  // Handler: Cambiar permiso de colaborador
  const handleToggleColabPermiso = async (colab: ColaboradorApiItem) => {
    if (!colabProject) return;
    try {
      const updated = await proyectoService.updateColaboradorPermiso(
        colabProject.id_proyecto,
        colab.id_colaborador,
        !colab.permiso_edicion
      );
      setCollaboratorsList((prev) =>
        prev.map((c) => (c.id_colaborador === updated.id_colaborador ? updated : c))
      );
      setColabModalSuccess(`Permiso actualizado para ${colab.nombre}.`);
      await loadProjects();
    } catch (err: any) {
      setColabModalError(err.message || 'No se pudo actualizar el permiso.');
    }
  };

  // Handler: Revocar colaborador
  const handleRemoveColaborador = async (colab: ColaboradorApiItem) => {
    if (!colabProject) return;
    if (!window.confirm(`¿Revocar acceso de ${colab.nombre} a este proyecto?`)) return;
    try {
      await proyectoService.removeColaborador(colabProject.id_proyecto, colab.id_colaborador);
      setCollaboratorsList((prev) => prev.filter((c) => c.id_colaborador !== colab.id_colaborador));
      setColabModalSuccess(`Colaborador ${colab.nombre} revocado.`);
      await loadProjects();
    } catch (err: any) {
      setColabModalError(err.message || 'No se pudo revocar el colaborador.');
    }
  };

  // Helper para formatear fechas
  const formatTimeAgo = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMin / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMin < 1) return 'Hace un momento';
      if (diffMin < 60) return `Hace ${diffMin} min`;
      if (diffHours < 24) return `Hace ${diffHours} h`;
      if (diffDays === 1) return 'Ayer';
      if (diffDays < 30) return `Hace ${diffDays} días`;
      return d.toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  // Helper para asignar avatares a colaboradores
  const getColabAvatar = (email: string) => {
    const em = email.toLowerCase();
    if (em.includes('carlos')) return ASSETS.carlosMendoza;
    if (em.includes('ana')) return ASSETS.anaLopez;
    if (em.includes('luis')) return ASSETS.davidChen;
    return ASSETS.elenaRuiz;
  };

  return (
    <div className="flex flex-col w-full min-h-[calc(100vh-3.5rem)] bg-background relative overflow-x-hidden select-none">
      {/* Top Ambient Glow Fields */}
      <div className="absolute -top-32 left-1/4 w-96 h-96 bg-primary-container/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-20 right-10 w-80 h-80 bg-secondary-container/15 rounded-full blur-3xl pointer-events-none" />

      <div className="relative px-6 py-6 flex flex-col gap-6 max-w-7xl mx-auto w-full">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 font-mono text-xs text-primary tracking-wide uppercase">
              <span className="inline-block w-2 h-2 rounded-full bg-tertiary"></span>
              <span>Espacio de Trabajo / CU02</span>
              <span className="text-outline">/</span>
              <span className="text-on-surface-variant font-medium">PostgreSQL classflow_ai</span>
            </div>
            <h1 className="text-3xl text-on-surface tracking-tight font-bold">Mis proyectos</h1>
            <p className="text-sm text-on-surface-variant max-w-2xl">
              Gestiona tus diagramas de clases UML y modelos de arquitectura con persistencia real en
              PostgreSQL y autorización basada en roles (Propietario / Invitado).
            </p>
          </div>

          {/* Action Callouts */}
          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={() => onNavigate('backend')}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-medium transition-all shadow-sm border border-outline-variant/20 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px] text-tertiary">
                system_update_alt
              </span>
              <span>Importar UML / Imagen</span>
            </button>
            <button
              onClick={() => {
                if (isOffline) {
                  setErrorMessage('Esta función requiere conexión a internet. Disponible cuando vuelva la conexión.');
                  return;
                }
                setIsCreateModalOpen(true);
              }}
              disabled={isOffline}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all shadow-md ${
                isOffline
                  ? 'bg-surface-container text-outline opacity-50 cursor-not-allowed'
                  : 'bg-primary text-on-primary hover:bg-primary-fixed-dim shadow-primary/25 cursor-pointer transform hover:scale-[1.02] active:scale-98'
              }`}
              title={
                isOffline
                  ? 'Esta función requiere conexión a internet. Disponible cuando vuelva la conexión.'
                  : 'Crear un nuevo proyecto UML'
              }
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              <span>+ Nuevo proyecto</span>
            </button>
          </div>
        </div>

        {/* Global Feedback Banners */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-error-container/30 border border-error/40 text-error flex items-center justify-between text-xs animate-shake">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={loadProjects}
              className="px-2 py-1 rounded bg-error/20 hover:bg-error/30 font-semibold cursor-pointer"
            >
              Reintentar
            </button>
          </div>
        )}

        {successMessage && (
          <div className="p-3.5 rounded-xl bg-tertiary-container/30 border border-tertiary/40 text-tertiary flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              <span>{successMessage}</span>
            </div>
            <button
              onClick={() => setSuccessMessage(null)}
              className="material-symbols-outlined text-[16px] text-tertiary hover:opacity-80 cursor-pointer"
            >
              close
            </button>
          </div>
        )}

        {/* Quick Metrics Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 rounded-xl bg-surface-container-low flex items-center justify-between shadow-sm border border-outline-variant/15">
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold text-outline uppercase tracking-wider">
                Total Proyectos
              </span>
              <span className="text-2xl text-on-surface font-bold mt-0.5">{projects.length}</span>
            </div>
            <span className="material-symbols-outlined text-primary text-[28px]">schema</span>
          </div>

          <div className="p-4 rounded-xl bg-surface-container-low flex items-center justify-between shadow-sm border border-outline-variant/15">
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold text-outline uppercase tracking-wider">
                Como Propietario
              </span>
              <span className="text-2xl text-secondary font-bold mt-0.5">
                {projects.filter((p) => p.es_propietario).length}
              </span>
            </div>
            <span className="material-symbols-outlined text-secondary text-[28px]">shield_person</span>
          </div>

          <div className="p-4 rounded-xl bg-surface-container-low flex items-center justify-between shadow-sm border border-outline-variant/15">
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold text-outline uppercase tracking-wider">
                Compartidos
              </span>
              <span className="text-2xl text-tertiary font-bold mt-0.5">
                {projects.filter((p) => !p.es_propietario).length}
              </span>
            </div>
            <span className="material-symbols-outlined text-tertiary text-[28px]">group_add</span>
          </div>

          <div className="p-4 rounded-xl bg-surface-container-low flex items-center justify-between shadow-sm border border-outline-variant/15">
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold text-outline uppercase tracking-wider">
                Estado PostgreSQL
              </span>
              <span className="text-sm font-semibold text-tertiary mt-1.5 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse"></span>
                <span>Conectado</span>
              </span>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant text-[28px]">database</span>
          </div>
        </div>

        {/* Filter and Toolbar Strip */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-2 rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/20">
          {/* Segmented Filter Tabs */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-surface-container">
            <button
              onClick={() => setFilterTab('all')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                filterTab === 'all'
                  ? 'bg-surface-bright text-primary font-semibold shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span>Todos los proyectos</span>
              <span className="px-1.5 py-0.2 rounded-full bg-primary/20 text-primary text-[10px] font-bold">
                {projects.length}
              </span>
            </button>
            <button
              onClick={() => setFilterTab('owner')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                filterTab === 'owner'
                  ? 'bg-surface-bright text-primary font-semibold shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span>Propietario</span>
              <span className="px-1.5 py-0.2 rounded-full bg-surface-variant text-on-surface-variant text-[10px]">
                {projects.filter((p) => p.es_propietario).length}
              </span>
            </button>
            <button
              onClick={() => setFilterTab('guest')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                filterTab === 'guest'
                  ? 'bg-surface-bright text-primary font-semibold shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span>Invitado</span>
              <span className="px-1.5 py-0.2 rounded-full bg-surface-variant text-on-surface-variant text-[10px]">
                {projects.filter((p) => !p.es_propietario).length}
              </span>
            </button>
          </div>

          {/* Search, Sort and View Controls */}
          <div className="flex flex-wrap items-center gap-2 flex-1 lg:justify-end">
            <div className="relative flex-1 max-w-md">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar proyectos por nombre o descripción..."
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-surface-container-low text-on-surface text-xs placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary shadow-inner border border-outline-variant/20"
              />
            </div>

            <div className="flex items-center gap-1 bg-surface-container px-2.5 py-1 rounded-lg border border-outline-variant/20">
              <span className="material-symbols-outlined text-outline text-[18px]">sort</span>
              <label className="text-[11px] text-outline">Ordenar:</label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as any)}
                className="bg-transparent text-on-surface text-xs focus:outline-none cursor-pointer py-1 pr-1 font-medium"
              >
                <option className="bg-surface-container text-on-surface" value="modified">
                  Última modificación
                </option>
                <option className="bg-surface-container text-on-surface" value="name">
                  Nombre (A-Z)
                </option>
                <option className="bg-surface-container text-on-surface" value="classes">
                  Complejidad (Clases)
                </option>
              </select>
            </div>

            <div className="flex items-center rounded-lg bg-surface-container p-0.5 border border-outline-variant/20">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded transition-colors cursor-pointer ${
                  viewMode === 'grid' ? 'bg-surface-bright text-primary' : 'text-outline hover:text-on-surface'
                }`}
                title="Vista Cuadrícula"
              >
                <span className="material-symbols-outlined text-[18px]">grid_view</span>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded transition-colors cursor-pointer ${
                  viewMode === 'list' ? 'bg-surface-bright text-primary' : 'text-outline hover:text-on-surface'
                }`}
                title="Vista Lista"
              >
                <span className="material-symbols-outlined text-[18px]">view_agenda</span>
              </button>
            </div>
          </div>
        </div>

        {/* Loading Skeleton */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 py-4">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-64 rounded-xl bg-surface-container-low/60 p-5 flex flex-col justify-between border border-outline-variant/20 animate-pulse"
              >
                <div className="flex flex-col gap-3">
                  <div className="h-4 w-24 bg-surface-container-high rounded"></div>
                  <div className="h-6 w-48 bg-surface-container-high rounded mt-2"></div>
                  <div className="h-3 w-full bg-surface-container-high/60 rounded"></div>
                </div>
                <div className="h-8 w-full bg-surface-container-high/40 rounded"></div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredProjects.length === 0 && (
          <div className="p-12 rounded-2xl bg-surface-container-low/50 border border-outline-variant/20 flex flex-col items-center text-center gap-3 my-4">
            <div className="p-4 rounded-full bg-surface-container text-outline">
              <span className="material-symbols-outlined text-[40px]">folder_off</span>
            </div>
            <h3 className="text-lg font-bold text-on-surface">No se encontraron proyectos</h3>
            <p className="text-xs text-on-surface-variant max-w-sm">
              {filterTab === 'owner'
                ? 'No has creado ningún proyecto todavía como propietario.'
                : filterTab === 'guest'
                ? 'No tienes proyectos compartidos como colaborador invitado.'
                : 'No hay proyectos registrados para mostrar con los filtros actuales.'}
            </p>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="mt-2 px-4 py-2 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:bg-primary-fixed-dim transition-all flex items-center gap-2 cursor-pointer shadow-md"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>Crear nuevo proyecto</span>
            </button>
          </div>
        )}

        {/* Projects Grid / List View */}
        {!isLoading && filteredProjects.length > 0 && (
          <div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5'
                : 'flex flex-col gap-3'
            }
          >
            {filteredProjects.map((project, idx) => {
              const isFeatured = idx === 0 && filterTab === 'all';
              const isMenuOpen = activeMenuId === project.id_proyecto;

              return (
                <div
                  key={project.id_proyecto}
                  className="group relative rounded-xl bg-surface-container-low p-5 flex flex-col justify-between transition-all duration-300 hover:bg-surface-container hover:shadow-xl hover:-translate-y-0.5 shadow-md border border-outline-variant/20 overflow-hidden"
                >
                  {isFeatured && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-secondary" />
                  )}

                  <div className="flex flex-col gap-3.5">
                    {/* Header Badges & Actions Menu */}
                    <div className="flex items-center justify-between gap-2 relative">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold tracking-wide ${
                            project.es_propietario
                              ? 'bg-secondary-container text-secondary'
                              : 'bg-surface-variant text-on-surface-variant'
                          }`}
                        >
                          {project.rol}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-surface-bright text-on-surface-variant text-[11px] font-mono">
                          {project.estado === 'archivado' ? 'Archivado' : 'Spring Boot (Java 21)'}
                        </span>
                        {!project.es_propietario && (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                              project.permiso_edicion
                                ? 'bg-tertiary/20 text-tertiary'
                                : 'bg-surface-variant text-outline'
                            }`}
                          >
                            {project.permiso_edicion ? 'Edición UML' : 'Solo lectura'}
                          </span>
                        )}
                      </div>

                      {/* Dropdown Options Button */}
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(isMenuOpen ? null : project.id_proyecto);
                          }}
                          className="text-outline hover:text-on-surface p-1 rounded hover:bg-surface-variant transition-colors cursor-pointer"
                          title="Opciones del proyecto"
                        >
                          <span className="material-symbols-outlined text-[20px]">more_vert</span>
                        </button>

                        {/* Dropdown Popup */}
                        {isMenuOpen && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-0 top-8 w-52 rounded-xl bg-surface-container-high border border-outline-variant/40 shadow-2xl p-1.5 z-40 flex flex-col gap-1 text-xs"
                          >
                            {project.es_propietario ? (
                              <>
                                <button
                                  onClick={() => handleOpenEdit(project)}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 rounded hover:bg-surface-container text-on-surface transition-colors text-left cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-[16px]">edit</span>
                                  <span>Editar proyecto</span>
                                </button>
                                <button
                                  onClick={() => handleOpenColaboradores(project)}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 rounded hover:bg-surface-container text-on-surface transition-colors text-left cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-[16px]">group</span>
                                  <span>Gestionar colaboradores</span>
                                </button>
                                <button
                                  onClick={() => handleArchiveProject(project)}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 rounded hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors text-left cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-[16px]">archive</span>
                                  <span>Archivar proyecto</span>
                                </button>
                                <div className="h-px bg-outline-variant/20 my-0.5" />
                                <button
                                  onClick={() => handleDeleteProject(project)}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 rounded hover:bg-error-container/30 text-error transition-colors text-left cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-[16px]">delete</span>
                                  <span>Eliminar proyecto</span>
                                </button>
                              </>
                            ) : (
                              <div className="px-3 py-2 text-[11px] text-outline flex flex-col gap-1">
                                <span className="font-semibold text-on-surface">
                                  Proyecto Compartido
                                </span>
                                <span>
                                  Solo el propietario ({project.propietario_nombre || 'Propietario'})
                                  puede editar o administrar este proyecto.
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Title & Architecture Description */}
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`material-symbols-outlined text-[22px] ${
                            isFeatured
                              ? 'text-primary'
                              : project.es_propietario
                              ? 'text-secondary'
                              : 'text-tertiary'
                          }`}
                        >
                          account_tree
                        </span>
                        <h2 className="text-base font-bold text-on-surface group-hover:text-primary transition-colors">
                          {project.nombre}
                        </h2>
                      </div>
                      <p className="text-xs text-on-surface-variant line-clamp-2 leading-relaxed">
                        {project.descripcion || 'Sin descripción técnica registrada.'}
                      </p>
                    </div>

                    {/* Mini Visual Blueprint / UML Graphic */}
                    <div className="p-2.5 rounded-lg bg-surface-container-lowest flex items-center justify-between gap-2 border border-outline-variant/15">
                      <div className="flex items-center gap-2 font-mono text-xs text-outline truncate">
                        <span className="text-primary font-medium">{project.nombre}.uml</span>
                        <span>→</span>
                        <span className="text-secondary font-medium">Spring Boot</span>
                      </div>
                      <span className="font-mono text-[11px] text-tertiary flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
                        <span>{project.estado}</span>
                      </span>
                    </div>

                    {/* Technical Complexity Counters */}
                    <div className="flex items-center gap-3 py-0.5 font-mono text-xs text-on-surface-variant">
                      <div className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-primary text-[16px]">
                          view_in_ar
                        </span>
                        <span>{project.total_clases} clases UML</span>
                      </div>
                      <span className="text-outline">/</span>
                      <div className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-secondary text-[16px]">
                          sync_alt
                        </span>
                        <span>{project.total_relaciones} relaciones</span>
                      </div>
                    </div>

                    {/* Collaborators & Timestamp */}
                    <div className="pt-1 flex items-center justify-between">
                      <div className="flex items-center -space-x-2 overflow-hidden">
                        {project.colaboradores.map((c) => (
                          <img
                            key={c.id_colaborador}
                            src={getColabAvatar(c.email)}
                            alt={c.nombre}
                            title={`${c.nombre} (${c.email}) - ${
                              c.permiso_edicion ? 'Edición UML' : 'Solo lectura'
                            }`}
                            className="inline-block h-7 w-7 rounded-full object-cover ring-2 ring-surface-container cursor-pointer"
                          />
                        ))}
                        {project.colaboradores.length === 0 && (
                          <span className="text-[11px] text-outline font-mono">Sin colaboradores</span>
                        )}
                      </div>
                      <span className="font-mono text-[11px] text-outline truncate">
                        {formatTimeAgo(project.fecha_modificacion)}
                      </span>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="mt-4 pt-3 border-t border-outline-variant/15 flex items-center gap-2">
                    <button
                      onClick={() => {
                        try {
                          localStorage.setItem('classflow_active_project_id', project.id_proyecto.toString());
                        } catch {
                          // ignore
                        }
                        if (onOpenProject) {
                          onOpenProject(project.id_proyecto);
                        }
                        onNavigate('editor');
                      }}
                      className="flex-1 py-2 px-3 rounded-lg bg-primary text-on-primary text-xs font-semibold text-center hover:bg-primary-fixed-dim transition-colors shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]">terminal</span>
                      <span>Abrir editor UML</span>
                    </button>

                    {project.es_propietario && (
                      <button
                        onClick={() => handleOpenColaboradores(project)}
                        className="p-2 rounded-lg bg-surface-container hover:bg-surface-bright text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                        title="Gestionar Colaboradores"
                      >
                        <span className="material-symbols-outlined text-[18px]">group</span>
                      </button>
                    )}

                    <button
                      onClick={() => onNavigate('backend')}
                      className="p-2 rounded-lg bg-surface-container hover:bg-surface-bright text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                      title="Generar Backend Spring Boot"
                    >
                      <span className="material-symbols-outlined text-[18px]">bolt</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Secondary Hub: AI & Vision Acceleration Banner */}
        <div className="p-5 rounded-xl bg-surface-container-low shadow-sm border border-outline-variant/20 mt-2">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-lg bg-surface-container text-primary shadow-inner border border-primary/20">
                <span className="material-symbols-outlined text-[32px]">auto_awesome</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <h3 className="text-base font-bold text-on-surface">
                  Acelera tu arquitectura con Visión Artificial y LLMs
                </h3>
                <p className="text-xs text-on-surface-variant max-w-xl">
                  Convierte fotos de pizarras o diagramas dibujados a mano directamente en clases UML
                  ejecutables con tipos y dependencias listas.
                </p>
              </div>
            </div>

            {/* Quick Actions Array */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => onNavigate('backend')}
                className="px-3.5 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-medium flex items-center gap-1.5 shadow-sm transition-colors border border-outline-variant/20 cursor-pointer"
              >
                <span className="material-symbols-outlined text-tertiary text-[18px]">
                  photo_camera
                </span>
                <span>Importar de foto / pizarra</span>
              </button>
              <button
                onClick={() => onNavigate('backend')}
                className="px-3.5 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-medium flex items-center gap-1.5 shadow-sm transition-colors border border-outline-variant/20 cursor-pointer"
              >
                <span className="material-symbols-outlined text-primary text-[18px]">code</span>
                <span>Importar desde SQL DDL</span>
              </button>
              <button
                onClick={() => onNavigate('backend')}
                className="px-3.5 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-medium flex items-center gap-1.5 shadow-sm transition-colors border border-outline-variant/20 cursor-pointer"
              >
                <span className="material-symbols-outlined text-secondary text-[18px]">
                  data_object
                </span>
                <span>PlantUML / XMI</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: NUEVO PROYECTO (CU02 - Creation Flow) */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md transition-opacity duration-200">
          <div className="relative w-full max-w-xl rounded-xl bg-surface-container-low shadow-2xl p-6 flex flex-col gap-4 overflow-hidden border border-outline-variant/30">
            {/* Decorative Header Line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-secondary to-tertiary" />

            {/* Modal Header */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <span className="material-symbols-outlined text-[24px]">folder_special</span>
                </div>
                <div className="flex flex-col">
                  <h2 className="text-base font-bold text-on-surface">Crear nuevo proyecto</h2>
                  <span className="text-xs text-on-surface-variant">
                    Configura los metadatos iniciales para tu modelo de arquitectura UML en PostgreSQL.
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded text-outline hover:text-on-surface hover:bg-surface-bright transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Form Inputs Container */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateProject();
              }}
              className="flex flex-col gap-3.5 mt-1"
            >
              {/* Project Name */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-on-surface flex items-center gap-1">
                    <span>Nombre del proyecto</span>
                    <span className="text-error font-bold">*</span>
                  </label>
                  <span className="font-mono text-[11px] text-outline">
                    Slug: {newProjectName.toLowerCase().replace(/\s+/g, '-')}
                  </span>
                </div>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
                    label
                  </span>
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="p. ej. Sistema de Pagos o Core Inventory"
                    required
                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-surface-container text-on-surface text-xs focus:outline-none focus:ring-2 focus:ring-primary shadow-inner border border-outline-variant/20"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-on-surface">
                  Descripción técnica y alcance
                </label>
                <textarea
                  rows={3}
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  placeholder="Describe las responsabilidades del sistema..."
                  className="w-full p-2.5 rounded-lg bg-surface-container text-on-surface text-xs focus:outline-none focus:ring-2 focus:ring-primary shadow-inner placeholder:text-outline border border-outline-variant/20 resize-none"
                />
              </div>

              {/* Stack & Permisos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-on-surface">
                    Stack de generación destino
                  </label>
                  <select
                    value={newProjectStack}
                    onChange={(e) => setNewProjectStack(e.target.value)}
                    className="w-full py-2 px-2.5 rounded-lg bg-surface-container text-on-surface text-xs focus:outline-none focus:ring-1 focus:ring-primary border border-outline-variant/20"
                  >
                    <option value="Spring Boot (Java 17)">Spring Boot (Java 17)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-on-surface">
                    Permisos iniciales
                  </label>
                  <select
                    value={newProjectPerms}
                    onChange={(e) => setNewProjectPerms(e.target.value)}
                    className="w-full py-2 px-2.5 rounded-lg bg-surface-container text-on-surface text-xs focus:outline-none focus:ring-1 focus:ring-primary border border-outline-variant/20"
                  >
                    <option value="Solo yo (Privado)">Solo yo (Privado)</option>
                  </select>
                </div>
              </div>

              {/* Template Checkbox */}
              <div className="p-3 rounded-lg bg-surface-container flex items-start gap-3 cursor-pointer hover:bg-surface-bright transition-colors border border-outline-variant/20">
                <input
                  type="checkbox"
                  id="templateCheck"
                  checked={newProjectTemplate}
                  onChange={(e) => setNewProjectTemplate(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded accent-primary"
                />
                <label htmlFor="templateCheck" className="flex flex-col cursor-pointer select-none">
                  <span className="text-xs font-semibold text-on-surface">
                    Crear con diagrama de clases en blanco
                  </span>
                  <span className="text-[11px] text-on-surface-variant">
                    Inicializa el espacio de trabajo con persistencia en PostgreSQL classflow_ai.
                  </span>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="mt-2 flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-bright text-on-surface-variant hover:text-on-surface text-xs font-medium transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-5 py-2 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:bg-primary-fixed-dim transition-all shadow-md shadow-primary/30 flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {isCreating ? (
                    <>
                      <span className="material-symbols-outlined text-[18px] animate-spin">
                        refresh
                      </span>
                      <span>Creando en PostgreSQL...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">check</span>
                      <span>Crear proyecto</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR PROYECTO (CU02 - Solo Propietario) */}
      {isEditModalOpen && editingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
          <div className="relative w-full max-w-lg rounded-xl bg-surface-container-low shadow-2xl p-6 flex flex-col gap-4 border border-outline-variant/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-secondary/10 text-secondary">
                  <span className="material-symbols-outlined text-[24px]">edit_note</span>
                </div>
                <div>
                  <h2 className="text-base font-bold text-on-surface">Editar proyecto</h2>
                  <span className="text-xs text-on-surface-variant">
                    Modifica los datos del proyecto (Solo propietario)
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 rounded text-outline hover:text-on-surface hover:bg-surface-bright transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleUpdateProject();
              }}
              className="flex flex-col gap-3.5 mt-1"
            >
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-on-surface">
                  Nombre del proyecto <span className="text-error font-bold">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editProjectName}
                  onChange={(e) => setEditProjectName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-container text-on-surface text-xs focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/20"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-on-surface">Descripción</label>
                <textarea
                  rows={3}
                  value={editProjectDesc}
                  onChange={(e) => setEditProjectDesc(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-surface-container text-on-surface text-xs focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/20 resize-none"
                />
              </div>

              <div className="mt-2 flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-bright text-on-surface-variant text-xs font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-5 py-2 rounded-lg bg-secondary text-on-secondary text-xs font-semibold hover:bg-secondary-fixed-dim transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {isUpdating ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: GESTIONAR COLABORADORES (CU02 - Solo Propietario) */}
      {isColabModalOpen && colabProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
          <div className="relative w-full max-w-xl rounded-xl bg-surface-container-low shadow-2xl p-6 flex flex-col gap-4 border border-outline-variant/30 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-tertiary/10 text-tertiary">
                  <span className="material-symbols-outlined text-[24px]">group</span>
                </div>
                <div>
                  <h2 className="text-base font-bold text-on-surface">
                    Colaboradores de {colabProject.nombre}
                  </h2>
                  <span className="text-xs text-on-surface-variant">
                    Invita y administra permisos de Desarrolladores Invitados
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsColabModalOpen(false)}
                className="p-1 rounded text-outline hover:text-on-surface hover:bg-surface-bright transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {colabModalError && (
              <div className="p-3 rounded-lg bg-error-container/30 border border-error/40 text-error text-xs flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">error</span>
                <span>{colabModalError}</span>
              </div>
            )}

            {colabModalSuccess && (
              <div className="p-3 rounded-lg bg-tertiary-container/30 border border-tertiary/40 text-tertiary text-xs flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                <span>{colabModalSuccess}</span>
              </div>
            )}

            {/* Invite Form */}
            <form
              onSubmit={handleAddColaborador}
              className="p-3.5 rounded-xl bg-surface-container flex flex-col gap-2.5 border border-outline-variant/20"
            >
              <label className="text-xs font-semibold text-on-surface">
                Invitar nuevo colaborador por correo
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  required
                  value={newColabEmail}
                  onChange={(e) => setNewColabEmail(e.target.value)}
                  placeholder="ej. ana@classflow.com"
                  className="flex-1 px-3 py-2 rounded-lg bg-surface-container-lowest text-on-surface text-xs focus:outline-none focus:ring-1 focus:ring-primary border border-outline-variant/20"
                />
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-on-surface-variant cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newColabPermiso}
                      onChange={(e) => setNewColabPermiso(e.target.checked)}
                      className="rounded accent-primary"
                    />
                    <span>Permiso edición</span>
                  </label>
                  <button
                    type="submit"
                    disabled={isAddingColab}
                    className="px-4 py-2 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:bg-primary-fixed-dim transition-all shadow-sm flex items-center gap-1 cursor-pointer disabled:opacity-60 shrink-0"
                  >
                    {isAddingColab ? 'Invitando...' : 'Invitar'}
                  </button>
                </div>
              </div>
            </form>

            {/* Current Collaborators List */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-outline uppercase tracking-wider">
                Colaboradores actuales ({collaboratorsList.length})
              </span>
              {collaboratorsList.length === 0 ? (
                <div className="p-6 text-center text-xs text-outline border border-dashed border-outline-variant/30 rounded-lg">
                  No hay colaboradores en este proyecto aún.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {collaboratorsList.map((colab) => (
                    <div
                      key={colab.id_colaborador}
                      className="p-3 rounded-lg bg-surface-container flex items-center justify-between gap-3 border border-outline-variant/15"
                    >
                      <div className="flex items-center gap-2.5">
                        <img
                          src={getColabAvatar(colab.email)}
                          alt={colab.nombre}
                          className="w-8 h-8 rounded-full object-cover ring-1 ring-outline-variant/30"
                        />
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-on-surface">
                            {colab.nombre} {colab.apellido || ''}
                          </span>
                          <span className="text-[11px] text-outline font-mono">{colab.email}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleColabPermiso(colab)}
                          className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${
                            colab.permiso_edicion
                              ? 'bg-primary/20 text-primary hover:bg-primary/30'
                              : 'bg-surface-variant text-outline hover:text-on-surface'
                          }`}
                          title="Clic para cambiar permiso"
                        >
                          {colab.permiso_edicion ? 'Edición UML' : 'Solo lectura'}
                        </button>
                        <button
                          onClick={() => handleRemoveColaborador(colab)}
                          className="p-1.5 rounded text-error hover:bg-error-container/30 transition-colors cursor-pointer"
                          title="Revocar colaborador"
                        >
                          <span className="material-symbols-outlined text-[18px]">person_remove</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-2 flex justify-end pt-2 border-t border-outline-variant/20">
              <button
                type="button"
                onClick={() => setIsColabModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-bright text-on-surface text-xs font-medium cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
