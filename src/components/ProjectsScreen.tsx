import React, { useState } from 'react';
import { AppScreen, ProjectItem, UserProfile } from '../types';
import { INITIAL_PROJECTS } from '../data/mockData';

interface ProjectsScreenProps {
  onNavigate: (screen: AppScreen) => void;
  currentUser: UserProfile;
  initialFilter?: 'all' | 'owner' | 'guest';
}

export const ProjectsScreen: React.FC<ProjectsScreenProps> = ({
  onNavigate,
  currentUser: _currentUser,
  initialFilter = 'all',
}) => {
  const [projects, setProjects] = useState<ProjectItem[]>(INITIAL_PROJECTS);
  const [filterTab, setFilterTab] = useState<'all' | 'owner' | 'guest'>(initialFilter);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'modified' | 'name' | 'classes'>('modified');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('Microservicio de Pagos');
  const [newProjectDesc, setNewProjectDesc] = useState(
    'Definición de clases para procesador Stripe, transacciones, webhooks y conciliación contable.'
  );
  const [newProjectStack, setNewProjectStack] = useState('Spring Boot (Java 21)');
  const [newProjectPerms, setNewProjectPerms] = useState('Solo yo (Privado)');
  const [newProjectTemplate, setNewProjectTemplate] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // Filtered projects
  const filteredProjects = projects
    .filter((p) => {
      if (filterTab === 'owner') return p.isOwner;
      if (filterTab === 'guest') return !p.isOwner;
      return true;
    })
    .filter((p) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.stackBadge.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sortOrder === 'name') return a.name.localeCompare(b.name);
      if (sortOrder === 'classes') return b.classesCount - a.classesCount;
      return 0;
    });

  const handleCreateProject = () => {
    setIsCreating(true);
    setTimeout(() => {
      const newProj: ProjectItem = {
        id: `proj-${Date.now()}`,
        name: newProjectName || 'Nuevo Microservicio',
        description: newProjectDesc || 'Modelo de arquitectura UML con validación AST.',
        isOwner: true,
        role: 'Propietario',
        stackBadge: newProjectStack,
        classesCount: newProjectTemplate ? 2 : 0,
        relationsCount: newProjectTemplate ? 1 : 0,
        version: 'v1.0',
        modifiedAgo: 'Hace un momento',
        schemaPreview: {
          left: 'Payment.java',
          arrow: '→',
          right: 'Transaction.java',
          tag: 'v1.0',
        },
        collaborators: [
          { name: 'Carlos Mendoza', avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDawfmyLLP-X8i_WFxxulN0wsMvIOLM02ZWTlW8e49YIdCH2JrNP3HSL8rod-VhEZcdsBVFN9cyYK2yCQqqzCeSm0FbtQbNnXJ_DtBNmpnJKvRzAaA5dPdnJJEuNdyk6Cpon-55YqalQS32MSuSjyrh1DRqK5kGK8NUkqvNpds6aol_5yhOLFjh4VQeoZX_z3Swm9ZOdiKM_vKAhaukoCms-40o-fNNLdgS9ogHnvyKgyunkg4NST_PzA', role: 'Owner' },
        ],
      };
      setProjects([newProj, ...projects]);
      setIsCreating(false);
      setIsModalOpen(false);
    }, 600);
  };

  return (
    <div className="flex flex-col w-full min-h-[calc(100vh-3.5rem)] bg-background relative overflow-x-hidden">
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
              <span className="text-on-surface-variant font-medium">Gestión de Esquemas</span>
            </div>
            <h1 className="text-3xl text-on-surface tracking-tight font-bold">Mis proyectos</h1>
            <p className="text-sm text-on-surface-variant max-w-2xl">
              Gestiona tus diagramas de clases UML y modelos de arquitectura con sincronización AST y
              generación de código en tiempo real.
            </p>
          </div>

          {/* Action Callouts */}
          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={() => onNavigate('backend')}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-medium transition-all shadow-sm border border-outline-variant/20"
            >
              <span className="material-symbols-outlined text-[18px] text-tertiary">
                system_update_alt
              </span>
              <span>Importar UML / Imagen</span>
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:bg-primary-fixed-dim transition-all shadow-md shadow-primary/25 cursor-pointer transform hover:scale-[1.02] active:scale-98"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              <span>+ Nuevo proyecto</span>
            </button>
          </div>
        </div>

        {/* Quick Metrics Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 rounded-xl bg-surface-container-low flex items-center justify-between shadow-sm border border-outline-variant/15">
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold text-outline uppercase tracking-wider">
                Total Modelos
              </span>
              <span className="text-2xl text-on-surface font-bold mt-0.5">
                {projects.length + 1}
              </span>
            </div>
            <span className="material-symbols-outlined text-primary text-[28px]">schema</span>
          </div>

          <div className="p-4 rounded-xl bg-surface-container-low flex items-center justify-between shadow-sm border border-outline-variant/15">
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold text-outline uppercase tracking-wider">
                Clases Activas
              </span>
              <span className="text-2xl text-on-surface font-bold mt-0.5">23</span>
            </div>
            <span className="material-symbols-outlined text-secondary text-[28px]">account_tree</span>
          </div>

          <div className="p-4 rounded-xl bg-surface-container-low flex items-center justify-between shadow-sm border border-outline-variant/15">
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold text-outline uppercase tracking-wider">
                AST Compilados
              </span>
              <span className="text-2xl text-tertiary font-bold mt-0.5">100%</span>
            </div>
            <span className="material-symbols-outlined text-tertiary text-[28px]">verified</span>
          </div>

          <div className="p-4 rounded-xl bg-surface-container-low flex items-center justify-between shadow-sm border border-outline-variant/15">
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold text-outline uppercase tracking-wider">
                Colaboradores
              </span>
              <span className="text-2xl text-on-surface font-bold mt-0.5">6</span>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant text-[28px]">group</span>
          </div>
        </div>

        {/* Filter and Toolbar Strip */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-2 rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/20">
          {/* Segmented Filter Tabs */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-surface-container">
            <button
              onClick={() => setFilterTab('all')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1.5 ${
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
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1.5 ${
                filterTab === 'owner'
                  ? 'bg-surface-bright text-primary font-semibold shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span>Propietario</span>
              <span className="px-1.5 py-0.2 rounded-full bg-surface-variant text-on-surface-variant text-[10px]">
                {projects.filter((p) => p.isOwner).length}
              </span>
            </button>
            <button
              onClick={() => setFilterTab('guest')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1.5 ${
                filterTab === 'guest'
                  ? 'bg-surface-bright text-primary font-semibold shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span>Invitado</span>
              <span className="px-1.5 py-0.2 rounded-full bg-surface-variant text-on-surface-variant text-[10px]">
                {projects.filter((p) => !p.isOwner).length}
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
                placeholder="Buscar proyectos por nombre, tag o entidad..."
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
                className={`p-1.5 rounded transition-colors ${
                  viewMode === 'grid' ? 'bg-surface-bright text-primary' : 'text-outline hover:text-on-surface'
                }`}
                title="Vista Cuadrícula"
              >
                <span className="material-symbols-outlined text-[18px]">grid_view</span>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded transition-colors ${
                  viewMode === 'list' ? 'bg-surface-bright text-primary' : 'text-outline hover:text-on-surface'
                }`}
                title="Vista Lista"
              >
                <span className="material-symbols-outlined text-[18px]">view_agenda</span>
              </button>
            </div>
          </div>
        </div>

        {/* Projects Grid / List View */}
        <div
          className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5'
              : 'flex flex-col gap-3'
          }
        >
          {filteredProjects.map((project, idx) => {
            const isFeatured = idx === 0;

            return (
              <div
                key={project.id}
                className="group relative rounded-xl bg-surface-container-low p-5 flex flex-col justify-between transition-all duration-300 hover:bg-surface-container hover:shadow-xl hover:-translate-y-0.5 shadow-md border border-outline-variant/20 overflow-hidden"
              >
                {isFeatured && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-secondary" />
                )}

                <div className="flex flex-col gap-3.5">
                  {/* Header Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold tracking-wide ${
                          project.isOwner
                            ? 'bg-secondary-container text-secondary'
                            : 'bg-surface-variant text-on-surface-variant'
                        }`}
                      >
                        {project.role}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-surface-bright text-on-surface-variant text-[11px] font-mono">
                        {project.stackBadge}
                      </span>
                    </div>

                    <button
                      onClick={() => alert(`Opciones para ${project.name}`)}
                      className="text-outline hover:text-on-surface p-1 rounded hover:bg-surface-variant transition-colors"
                      title="Acciones"
                    >
                      <span className="material-symbols-outlined text-[20px]">more_vert</span>
                    </button>
                  </div>

                  {/* Title & Architecture Description */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`material-symbols-outlined text-[22px] ${
                          isFeatured
                            ? 'text-primary'
                            : project.isOwner
                            ? 'text-secondary'
                            : 'text-tertiary'
                        }`}
                      >
                        account_tree
                      </span>
                      <h2 className="text-base font-bold text-on-surface group-hover:text-primary transition-colors">
                        {project.name}
                      </h2>
                    </div>
                    <p className="text-xs text-on-surface-variant line-clamp-2 leading-relaxed">
                      {project.description}
                    </p>
                  </div>

                  {/* Mini Visual Blueprint / UML Graphic */}
                  <div className="p-2.5 rounded-lg bg-surface-container-lowest flex items-center justify-between gap-2 border border-outline-variant/15">
                    <div className="flex items-center gap-2 font-mono text-xs text-outline truncate">
                      <span className="text-primary font-medium">{project.schemaPreview.left}</span>
                      <span>{project.schemaPreview.arrow}</span>
                      <span className="text-secondary font-medium">
                        {project.schemaPreview.right}
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-tertiary flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
                      {project.schemaPreview.tag || project.version}
                    </span>
                  </div>

                  {/* Technical Complexity Counters */}
                  <div className="flex items-center gap-3 py-0.5 font-mono text-xs text-on-surface-variant">
                    <div className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-primary text-[16px]">
                        view_in_ar
                      </span>
                      <span>{project.classesCount} clases UML</span>
                    </div>
                    <span className="text-outline">/</span>
                    <div className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-secondary text-[16px]">
                        sync_alt
                      </span>
                      <span>{project.relationsCount} relaciones</span>
                    </div>
                  </div>

                  {/* Collaborators & Timestamp */}
                  <div className="pt-1 flex items-center justify-between">
                    <div className="flex items-center -space-x-2 overflow-hidden">
                      {project.collaborators.map((c, i) => (
                        <img
                          key={i}
                          src={c.avatar}
                          alt={c.name}
                          title={`${c.name} (${c.role})`}
                          className="inline-block h-7 w-7 rounded-full object-cover ring-2 ring-surface-container"
                        />
                      ))}
                      {project.collaborators.length > 2 && (
                        <div className="flex items-center justify-center h-7 w-7 rounded-full bg-surface-bright text-[11px] text-on-surface font-semibold ring-2 ring-surface-container">
                          +1
                        </div>
                      )}
                    </div>
                    <span className="font-mono text-[11px] text-outline truncate">
                      {project.modifiedAgo}
                    </span>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-4 pt-3 border-t border-outline-variant/15 flex items-center gap-2">
                  <button
                    onClick={() => onNavigate('editor')}
                    className="flex-1 py-2 px-3 rounded-lg bg-primary text-on-primary text-xs font-semibold text-center hover:bg-primary-fixed-dim transition-colors shadow-sm flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[18px]">terminal</span>
                    <span>Abrir editor UML</span>
                  </button>

                  <button
                    onClick={() => onNavigate('backend')}
                    className="p-2 rounded-lg bg-surface-container hover:bg-surface-bright text-on-surface-variant hover:text-on-surface transition-colors"
                    title="Compilar Backend"
                  >
                    <span className="material-symbols-outlined text-[18px]">bolt</span>
                  </button>

                  <button
                    onClick={() => {
                      alert(`Diagrama ${project.name} exportado en formato PlantUML`);
                    }}
                    className="p-2 rounded-lg bg-surface-container hover:bg-surface-bright text-on-surface-variant hover:text-on-surface transition-colors"
                    title="Exportar PlantUML / Mermaid"
                  >
                    <span className="material-symbols-outlined text-[18px]">file_download</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

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
                className="px-3.5 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-medium flex items-center gap-1.5 shadow-sm transition-colors border border-outline-variant/20"
              >
                <span className="material-symbols-outlined text-tertiary text-[18px]">
                  photo_camera
                </span>
                <span>Importar de foto / pizarra</span>
              </button>
              <button
                onClick={() => onNavigate('backend')}
                className="px-3.5 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-medium flex items-center gap-1.5 shadow-sm transition-colors border border-outline-variant/20"
              >
                <span className="material-symbols-outlined text-primary text-[18px]">code</span>
                <span>Importar desde SQL DDL</span>
              </button>
              <button
                onClick={() => onNavigate('backend')}
                className="px-3.5 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-medium flex items-center gap-1.5 shadow-sm transition-colors border border-outline-variant/20"
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
      {isModalOpen && (
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
                    Configura los metadatos iniciales para tu modelo de arquitectura UML.
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded text-outline hover:text-on-surface hover:bg-surface-bright transition-colors"
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
              {/* Field 1: Project Name */}
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
                    placeholder="p. ej. Billing Service o Core Inventory"
                    required
                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-surface-container text-on-surface text-xs focus:outline-none focus:ring-2 focus:ring-primary shadow-inner border border-outline-variant/20"
                  />
                </div>
              </div>

              {/* Field 2: Description */}
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

              {/* Field 3: Target Architecture / Stack */}
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
                    <option value="Spring Boot (Java 21)">Spring Boot (Java 21)</option>
                    <option value="NestJS (TypeScript)">NestJS (TypeScript)</option>
                    <option value="Django / Fast-API (Python)">Django / Fast-API (Python)</option>
                    <option value="Go (Echo / GORM)">Go (Echo / GORM)</option>
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
                    <option value="Mi Organización / Equipo">Mi Organización / Equipo</option>
                    <option value="Público (Solo lectura)">Público (Solo lectura)</option>
                  </select>
                </div>
              </div>

              {/* Field 4: Initial Diagram Template Checkbox */}
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
                    Crear con plantilla de diagrama de clases en blanco
                  </span>
                  <span className="text-[11px] text-on-surface-variant">
                    Inicializa el lienzo infinito con la cuadrícula de 16px configurada y el validador
                    AST en modo estricto.
                  </span>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="mt-2 flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-bright text-on-surface-variant hover:text-on-surface text-xs font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-5 py-2 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:bg-primary-fixed-dim transition-all shadow-md shadow-primary/30 flex items-center gap-1.5"
                >
                  {isCreating ? (
                    <>
                      <span className="material-symbols-outlined text-[18px] animate-spin">
                        refresh
                      </span>
                      <span>Creando espacio...</span>
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
    </div>
  );
};
