import React, { useState, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { AppScreen, UserProfile } from '../types';
import {
  diagramaService,
  DiagramaApiItem,
  BackendGenerateResponse,
  GeneratedFileItem,
} from '../services/diagramaService';
import { proyectoService } from '../services/proyectoService';

interface BackendGeneratorScreenProps {
  onNavigate: (screen: AppScreen) => void;
  currentUser: UserProfile;
  projectId?: number | null;
}

export const BackendGeneratorScreen: React.FC<BackendGeneratorScreenProps> = ({
  onNavigate,
  currentUser: _currentUser,
  projectId: propProjectId,
}) => {
  // Diagram and Project state
  const [diagrama, setDiagrama] = useState<DiagramaApiItem | null>(null);
  const [projectName, setProjectName] = useState<string>('');
  const [isLoadingDiagram, setIsLoadingDiagram] = useState<boolean>(true);
  const [diagramError, setDiagramError] = useState<string | null>(null);

  // Generation state (CU10) - strictly explicit, never auto-generated on mount
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationResult, setGenerationResult] = useState<BackendGenerateResponse | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Active file in code viewer
  const [activeFile, setActiveFile] = useState<string>('pom.xml');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Toast notifications
  const [toastInfo, setToastInfo] = useState<{ title: string; message: string; visible: boolean }>({
    title: '',
    message: '',
    visible: false,
  });

  const showToast = (title: string, message: string) => {
    setToastInfo({ title, message, visible: true });
    setTimeout(() => {
      setToastInfo((prev) => ({ ...prev, visible: false }));
    }, 3500);
  };

  // Online/Offline detection
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

  // Determine owner permission (CU10 is strictly for owner)
  const isOwner = Boolean(diagrama?.es_propietario);

  // Load active project and diagram data on mount or when propProjectId changes
  const loadProjectAndDiagram = useCallback(async () => {
    setIsLoadingDiagram(true);
    setDiagramError(null);
    try {
      let activeId = propProjectId;

      if (!activeId) {
        const stored = localStorage.getItem('classflow_active_project_id');
        if (stored) {
          activeId = parseInt(stored, 10);
        }
      }

      if (!activeId) {
        const userProjects = await proyectoService.getProyectos('all');
        if (userProjects.length > 0) {
          activeId = userProjects[0].id_proyecto;
          localStorage.setItem('classflow_active_project_id', activeId.toString());
        } else {
          setDiagramError('No tienes ningún proyecto disponible. Crea uno en la sección de Proyectos.');
          setIsLoadingDiagram(false);
          return;
        }
      }

      // Fetch project details
      try {
        const proj = await proyectoService.getProyecto(activeId);
        setProjectName(proj.nombre);
      } catch {
        setProjectName(`Proyecto #${activeId}`);
      }

      // Fetch diagram details
      const diag = await diagramaService.getDiagramaProyecto(activeId);
      setDiagrama(diag);
    } catch (err: any) {
      setDiagramError(err.message || 'Error al cargar el proyecto y su diagrama.');
    } finally {
      setIsLoadingDiagram(false);
    }
  }, [propProjectId]);

  useEffect(() => {
    loadProjectAndDiagram();
  }, [loadProjectAndDiagram]);

  // Handler for explicit backend generation (CU10)
  const handleGenerarBackend = async () => {
    if (isOffline) {
      showToast('Sin conexión', 'Esta función requiere conexión a internet. Disponible cuando vuelva la conexión.');
      return;
    }

    if (!diagrama?.id_diagrama) {
      showToast('Error', 'No se ha cargado ningún diagrama válido.');
      return;
    }

    if (!isOwner) {
      showToast('Acceso denegado', 'Solo el propietario del proyecto puede generar el backend (CU10).');
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);

    try {
      const result = await diagramaService.generarBackend(diagrama.id_diagrama);
      setGenerationResult(result);

      // Select first entity or pom.xml as active file
      if (result.files.length > 0) {
        const preferred = result.files.find((f) => f.category === 'model') || result.files[0];
        setActiveFile(preferred.name);
      }

      confetti({
        particleCount: 70,
        spread: 70,
        origin: { y: 0.8 },
      });

      showToast(
        'Backend generado',
        `Proyecto Java 17 + Spring Boot 3.2 generado exitosamente (${result.metrics.total_files} archivos).`
      );
    } catch (err: any) {
      const msg = err.message || 'Error durante la generación del backend Spring Boot.';
      setGenerationError(msg);
      showToast('Error de generación', msg);
    } finally {
      setIsGenerating(false);
    }
  };

  // CU11: Download ZIP state
  const [isDownloadingZip, setIsDownloadingZip] = useState<boolean>(false);

  // Handler for downloading backend ZIP (CU11)
  const handleDownloadZip = async () => {
    if (isOffline) {
      showToast('Sin conexión', 'Esta función requiere conexión a internet. Disponible cuando vuelva la conexión.');
      return;
    }

    if (!diagrama?.id_diagrama) {
      showToast('Error', 'No se ha cargado ningún diagrama válido.');
      return;
    }

    if (!isOwner) {
      showToast('Acceso denegado', 'Solo el propietario del proyecto puede descargar el backend generado (CU11).');
      return;
    }

    setIsDownloadingZip(true);
    try {
      const { blob, filename } = await diagramaService.descargarBackend(diagrama.id_diagrama);

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.85 },
      });

      showToast('Descarga completada', `${filename} descargado exitosamente.`);
    } catch (err: any) {
      const msg = err.message || 'Error al descargar el archivo ZIP del backend.';
      showToast('Error de descarga', msg);
    } finally {
      setIsDownloadingZip(false);
    }
  };

  // Code display resolution
  const currentFiles: GeneratedFileItem[] = generationResult ? generationResult.files : [];
  const currentFileItem = currentFiles.find((f) => f.name === activeFile) || currentFiles[0];
  const currentCode = currentFileItem ? currentFileItem.content : '';

  const handleCopyCode = () => {
    if (!currentCode) return;
    navigator.clipboard?.writeText(currentCode);
    setCopiedCode(true);
    showToast('Código copiado', `${activeFile} copiado al portapapeles`);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyDocker = () => {
    const dockerContent = `version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    container_name: classflow_postgres
    environment:
      POSTGRES_DB: classflow_ai
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  backend:
    build: .
    container_name: classflow_backend
    ports:
      - "8080:8080"
    depends_on:
      - postgres
    environment:
      SPRING_DATASOURCE_URL: jdbc:postgresql://postgres:5432/classflow_ai
      SPRING_DATASOURCE_USERNAME: postgres
      SPRING_DATASOURCE_PASSWORD: password

volumes:
  pgdata:`;
    navigator.clipboard?.writeText(dockerContent);
    showToast('Docker copiado', 'Configuración docker-compose copiada al portapapeles');
  };

  // Group files by category for tree view
  const models = currentFiles.filter((f) => f.category === 'model');
  const repositories = currentFiles.filter((f) => f.category === 'repository');
  const services = currentFiles.filter((f) => f.category === 'service');
  const controllers = currentFiles.filter((f) => f.category === 'controller');
  const configs = currentFiles.filter((f) => f.category === 'config');
  const rootFiles = currentFiles.filter((f) => f.category === 'root');

  // Summary counts from diagram (pre-generation) or result (post-generation)
  const totalClassesCount = generationResult
    ? generationResult.metrics.total_classes
    : diagrama?.clases?.length || 0;

  const totalAttributesCount = generationResult
    ? generationResult.metrics.total_attributes
    : (diagrama?.clases || []).reduce((acc, c) => acc + (c.atributos?.length || 0), 0);

  const totalMethodsCount = generationResult
    ? generationResult.metrics.total_methods
    : (diagrama?.clases || []).reduce((acc, c) => acc + (c.metodos?.length || 0), 0);

  const totalRelationsCount = generationResult
    ? generationResult.metrics.total_relations
    : diagrama?.relaciones?.length || 0;

  const classNamesPreview = (diagrama?.clases || []).map((c) => c.nombre).join(', ') || 'Sin clases';

  return (
    <div className="flex flex-col w-full min-h-[calc(100vh-3.5rem)] bg-background relative overflow-x-hidden p-4 sm:p-6">
      <div className="flex flex-col gap-5 w-full max-w-[1720px] mx-auto">
        {/* HEADER PIPELINE ESTADO (CU10 & METRICAS) */}
        <div className="bg-surface-container-low rounded-xl p-5 shadow-xl relative overflow-hidden flex flex-col gap-4 border border-outline-variant/20">
          <div className="absolute -right-20 -top-24 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded bg-surface-container-high text-primary font-mono text-xs font-semibold">
                  CU10
                </span>
                <span className="text-xl font-bold text-on-surface tracking-tight">
                  Generar backend a partir del diagrama
                </span>
                {generationResult ? (
                  <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-tertiary-container text-on-tertiary-container shadow-sm">
                    <span className="material-symbols-outlined text-[14px]">verified</span>
                    <span className="text-xs font-semibold">
                      Backend generado: {generationResult.metrics.total_files} archivos generados
                    </span>
                  </div>
                ) : isGenerating ? (
                  <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-primary-container text-on-primary-container shadow-sm animate-pulse">
                    <span className="material-symbols-outlined text-[14px] animate-spin">refresh</span>
                    <span className="text-xs font-semibold">Compilando modelo UML a Spring Boot 3.2...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant shadow-sm">
                    <span className="material-symbols-outlined text-[14px]">pending</span>
                    <span className="text-xs font-semibold">Listo para generar</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 text-on-surface-variant text-xs flex-wrap">
                <span>
                  Proyecto: <strong className="text-on-surface font-medium">{projectName || 'Cargando...'}</strong>
                </span>
                <span>•</span>
                <span>
                  Diagrama:{' '}
                  <strong className="text-primary-fixed-dim font-medium">
                    {diagrama?.nombre || 'Diagrama principal'}
                  </strong>
                </span>
                <span>•</span>
                <span className="font-mono text-[11px] text-outline">
                  Stack Oficial: Spring Boot 3.2 (Java 17 + PostgreSQL)
                </span>
                {!isOwner && (
                  <>
                    <span>•</span>
                    <span className="text-error font-medium flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">lock</span>
                      Solo Propietario (CU10)
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* PRIMARY GENERATION ACTION BUTTON (CU10) */}
              <button
                id="btn-generar-backend"
                onClick={handleGenerarBackend}
                disabled={isGenerating || isLoadingDiagram || !diagrama || !isOwner || isOffline}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-xs shadow-md transition-all ${
                  isGenerating
                    ? 'bg-surface-container text-on-surface-variant cursor-wait'
                    : isOffline
                    ? 'bg-surface-container text-outline cursor-not-allowed opacity-60'
                    : !isOwner
                    ? 'bg-surface-container text-outline cursor-not-allowed opacity-60'
                    : 'bg-primary hover:bg-inverse-primary text-on-primary transform active:scale-95 shadow-primary/20'
                }`}
                title={
                  isOffline
                    ? 'Esta función requiere conexión a internet. Disponible cuando vuelva la conexión.'
                    : !isOwner
                    ? 'Solo el propietario del proyecto puede ejecutar CU10.'
                    : 'Generar código Java 17 + Spring Boot a partir del diagrama UML'
                }
              >
                <span className={`material-symbols-outlined text-[18px] ${isGenerating ? 'animate-spin' : ''}`}>
                  {isGenerating ? 'refresh' : 'bolt'}
                </span>
                <span>{isGenerating ? 'Generando backend...' : 'Generar backend'}</span>
              </button>

              <button
                onClick={() => onNavigate('editor')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded bg-surface-variant hover:bg-surface-bright text-on-surface transition-colors shadow-sm text-xs font-medium"
              >
                <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                <span>Volver al Editor UML</span>
              </button>
            </div>
          </div>

          {/* GUEST WARNING BANNER IF APPLICABLE */}
          {!isOwner && !isLoadingDiagram && (
            <div className="bg-error/10 border border-error/30 rounded-lg p-3 text-xs text-error flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[18px] text-error">gpp_maybe</span>
              <span>
                <strong>Acceso de Desarrollador Invitado:</strong> Solo el propietario del proyecto tiene permisos
                para ejecutar la generación de backend (CU10). Puedes explorar el proyecto desde el editor.
              </span>
            </div>
          )}

          {/* ERROR ALERT IF GENERATION FAILED */}
          {generationError && (
            <div className="bg-error-container text-on-error-container border border-error/40 rounded-lg p-3 text-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <span>{generationError}</span>
              </div>
              <button
                onClick={() => setGenerationError(null)}
                className="text-on-error-container hover:opacity-75"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          )}

          {/* METRIC CHIPS */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 pt-1">
            <div className="bg-surface-container rounded-lg p-2.5 px-3 flex items-center justify-between shadow-sm border border-outline-variant/15">
              <div className="flex flex-col">
                <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
                  Entidades
                </span>
                <span className="text-base text-on-surface font-bold">{totalClassesCount} Clases</span>
              </div>
              <div className="h-8 w-8 rounded bg-surface-container-high flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[18px]">schema</span>
              </div>
            </div>

            <div className="bg-surface-container rounded-lg p-2.5 px-3 flex items-center justify-between shadow-sm border border-outline-variant/15">
              <div className="flex flex-col min-w-0 pr-1">
                <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
                  Nombres
                </span>
                <span className="text-xs text-on-surface truncate font-semibold" title={classNamesPreview}>
                  {classNamesPreview}
                </span>
              </div>
              <div className="h-8 w-8 rounded bg-surface-container-high flex items-center justify-center text-secondary shrink-0">
                <span className="material-symbols-outlined text-[18px]">dataset</span>
              </div>
            </div>

            <div className="bg-surface-container rounded-lg p-2.5 px-3 flex items-center justify-between shadow-sm border border-outline-variant/15">
              <div className="flex flex-col">
                <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
                  Campos
                </span>
                <span className="text-base text-on-surface font-bold">{totalAttributesCount} Atributos</span>
              </div>
              <div className="h-8 w-8 rounded bg-surface-container-high flex items-center justify-center text-tertiary">
                <span className="material-symbols-outlined text-[18px]">key</span>
              </div>
            </div>

            <div className="bg-surface-container rounded-lg p-2.5 px-3 flex items-center justify-between shadow-sm border border-outline-variant/15">
              <div className="flex flex-col">
                <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
                  Lógica Negocio
                </span>
                <span className="text-base text-on-surface font-bold">{totalMethodsCount} Métodos</span>
              </div>
              <div className="h-8 w-8 rounded bg-surface-container-high flex items-center justify-center text-primary-fixed-dim">
                <span className="material-symbols-outlined text-[18px]">function</span>
              </div>
            </div>

            <div className="bg-surface-container rounded-lg p-2.5 px-3 flex items-center justify-between shadow-sm border border-outline-variant/15">
              <div className="flex flex-col">
                <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
                  Relaciones
                </span>
                <span className="text-base text-on-surface font-bold">{totalRelationsCount} Asoc. UML</span>
              </div>
              <div className="h-8 w-8 rounded bg-surface-container-high flex items-center justify-center text-tertiary-fixed">
                <span className="material-symbols-outlined text-[18px]">hub</span>
              </div>
            </div>
          </div>
        </div>

        {/* STEPPER PROCESO COMPILACIÓN */}
        <div className="bg-surface-container-low rounded-xl p-3.5 shadow-lg flex flex-col gap-2 border border-outline-variant/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-tertiary text-[18px]">
                published_with_changes
              </span>
              <span className="text-xs text-on-surface font-semibold tracking-wide uppercase">
                Pipeline de Generación Java + Spring Boot
              </span>
            </div>
            {generationResult ? (
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-tertiary-container text-on-tertiary-container">
                <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse"></span>
                <span className="text-[11px] font-bold tracking-wider">
                  BACKEND GENERADO CORRECTAMENTE
                </span>
              </div>
            ) : isGenerating ? (
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-primary-container text-on-primary-container">
                <span className="w-2 h-2 rounded-full bg-primary animate-ping"></span>
                <span className="text-[11px] font-bold tracking-wider">
                  EJECUTANDO GENERADOR FASTAPI...
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant">
                <span className="w-2 h-2 rounded-full bg-outline"></span>
                <span className="text-[11px] font-medium tracking-wider">
                  ESPERANDO ACCIÓN DEL USUARIO
                </span>
              </div>
            )}
          </div>

          {/* PROGRESS TRACK */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1">
            {[
              { num: '1. Análisis UML', sub: 'Modelos PostgreSQL' },
              { num: '2. Multiplicidades', sub: 'Mapeo JPA (@OneToMany)' },
              { num: '3. Tipado Entidades', sub: 'Strict Java 17' },
              { num: '4. Repositorios', sub: 'Spring Data JPA' },
              { num: '5. Capas REST', sub: 'Service + Controller' },
              { num: '6. Configuración', sub: 'pom.xml + Properties' },
            ].map((st, i) => (
              <div
                key={i}
                className="bg-surface-container rounded-lg p-2 px-2.5 flex items-center gap-2 shadow-sm border border-outline-variant/10"
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[12px] font-bold ${
                    generationResult
                      ? 'bg-tertiary-container text-on-tertiary-container'
                      : isGenerating
                      ? 'bg-primary-container text-on-primary-container'
                      : 'bg-surface-container-high text-outline'
                  }`}
                >
                  <span className="material-symbols-outlined text-[13px]">
                    {generationResult ? 'check' : isGenerating ? 'hourglass_top' : 'radio_button_unchecked'}
                  </span>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs text-on-surface font-medium truncate">{st.num}</span>
                  <span className="font-mono text-[10px] text-outline">{st.sub}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* MAIN WORKSPACE: CODE EXPLORER & SYNTAX PREVIEW */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* COL LEFT: ARTIFACT EXPLORER & STACK (3 COLS) */}
          <div className="lg:col-span-4 xl:col-span-3 bg-surface-container-low rounded-xl p-4 shadow-xl flex flex-col gap-4 border border-outline-variant/20">
            {/* STACK INFO (OFFICIAL SPRING BOOT) */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-outline uppercase tracking-wider">
                Stack Tecnológico Oficial
              </label>
              <div className="bg-surface-container border border-primary/40 rounded-lg p-3 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-tertiary text-[24px]">
                    code_blocks
                  </span>
                  <div className="flex flex-col leading-tight">
                    <span className="text-xs text-on-surface font-bold">Spring Boot 3.2</span>
                    <span className="font-mono text-[11px] text-primary">
                      Java 17 + PostgreSQL
                    </span>
                    <span className="text-[10px] text-outline">Spring Data JPA + Maven</span>
                  </div>
                </div>
                <span className="material-symbols-outlined text-primary text-[20px]">
                  verified
                </span>
              </div>
            </div>

            {/* ACTION: GENERAR BACKEND (BUTTON IN SIDEBAR) */}
            {!generationResult && (
              <div className="flex flex-col gap-2 p-3 rounded-lg bg-surface-container-lowest border border-outline-variant/30">
                <div className="text-xs font-semibold text-on-surface">Generación Requerida</div>
                <p className="text-[11px] text-on-surface-variant leading-relaxed">
                  Para examinar el código Java generado, pulse el botón para invocar el endpoint oficial de FastAPI.
                </p>
                <button
                  onClick={handleGenerarBackend}
                  disabled={isGenerating || isLoadingDiagram || !diagrama || !isOwner || isOffline}
                  className={`w-full flex items-center justify-center gap-2 p-2.5 rounded-lg text-xs font-bold transition-all shadow-md ${
                    isGenerating
                      ? 'bg-surface-container text-on-surface-variant cursor-wait'
                      : isOffline
                      ? 'bg-surface-container text-outline cursor-not-allowed opacity-60'
                      : !isOwner
                      ? 'bg-surface-container text-outline cursor-not-allowed opacity-60'
                      : 'bg-primary hover:bg-inverse-primary text-on-primary transform active:scale-95 shadow-primary/20 cursor-pointer'
                  }`}
                  title={
                    isOffline
                      ? 'Esta función requiere conexión a internet. Disponible cuando vuelva la conexión.'
                      : !isOwner
                      ? 'Solo el propietario del proyecto puede ejecutar CU10.'
                      : 'Generar backend Java'
                  }
                >
                  <span className={`material-symbols-outlined text-[16px] ${isGenerating ? 'animate-spin' : ''}`}>
                    {isGenerating ? 'refresh' : 'bolt'}
                  </span>
                  <span>{isGenerating ? 'Compilando...' : 'Generar Backend Spring Boot'}</span>
                </button>
              </div>
            )}

            {/* FILE TREE */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-outline uppercase tracking-wider">
                  Artefactos Generados
                </span>
                <span className="font-mono text-[11px] text-primary">
                  {currentFiles.length} archivos
                </span>
              </div>

              <div className="bg-surface-container-lowest rounded-lg p-2 flex flex-col font-mono text-xs select-none max-h-[510px] overflow-y-auto border border-outline-variant/20">
                {generationResult ? (
                  <>
                    {/* Root project folder */}
                    <div className="flex items-center gap-1.5 py-1 px-1 text-on-surface-variant">
                      <span className="material-symbols-outlined text-[16px] text-primary">
                        folder_open
                      </span>
                      <span className="font-semibold text-on-surface">
                        {generationResult.project_name
                          ? generationResult.project_name.toLowerCase().replace(/\s+/g, '-') + '-backend'
                          : 'classflow-backend'}
                      </span>
                    </div>

                    <div className="pl-3 flex flex-col gap-0.5">
                      {/* Root files (pom.xml, Application.java) */}
                      {rootFiles.map((file) => (
                        <div
                          key={file.name}
                          onClick={() => setActiveFile(file.name)}
                          className={`flex items-center gap-1.5 py-1 px-1.5 rounded cursor-pointer transition-colors ${
                            activeFile === file.name
                              ? 'bg-surface-container-high text-primary font-semibold'
                              : 'hover:bg-surface-container text-on-surface-variant'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[14px]">
                            {file.name.endsWith('.xml') ? 'settings' : 'code'}
                          </span>
                          <span className="flex-1 truncate">{file.name}</span>
                          {activeFile === file.name && (
                            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                          )}
                        </div>
                      ))}

                      {/* Package java folder */}
                      <div className="flex items-center gap-1.5 py-0.5 text-on-surface-variant pt-1">
                        <span className="material-symbols-outlined text-[14px]">folder_open</span>
                        <span className="text-[11px] text-outline truncate">
                          src/main/java/{generationResult.package_name.replace(/\./g, '/')}
                        </span>
                      </div>

                      {/* model */}
                      {models.length > 0 && (
                        <div className="pl-3 flex flex-col">
                          <div className="flex items-center gap-1 py-0.5 text-on-surface-variant">
                            <span className="material-symbols-outlined text-[14px] text-primary-fixed-dim">
                              folder_open
                            </span>
                            <span className="text-on-surface font-medium text-[11px]">model</span>
                          </div>
                          <div className="pl-3 flex flex-col">
                            {models.map((f) => (
                              <div
                                key={f.name}
                                onClick={() => setActiveFile(f.name)}
                                className={`flex items-center gap-1.5 py-1 px-1.5 rounded cursor-pointer transition-colors ${
                                  activeFile === f.name
                                    ? 'bg-surface-container-high text-primary font-semibold'
                                    : 'hover:bg-surface-container text-on-surface-variant'
                                }`}
                              >
                                <span className="material-symbols-outlined text-[14px]">description</span>
                                <span className="flex-1 truncate">{f.name}</span>
                                {activeFile === f.name && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* repository */}
                      {repositories.length > 0 && (
                        <div className="pl-3 flex flex-col pt-1">
                          <div className="flex items-center gap-1 py-0.5 text-on-surface-variant">
                            <span className="material-symbols-outlined text-[14px] text-primary-fixed-dim">
                              folder
                            </span>
                            <span className="text-on-surface font-medium text-[11px]">repository</span>
                          </div>
                          <div className="pl-3 flex flex-col">
                            {repositories.map((f) => (
                              <div
                                key={f.name}
                                onClick={() => setActiveFile(f.name)}
                                className={`flex items-center gap-1.5 py-1 px-1.5 rounded cursor-pointer transition-colors ${
                                  activeFile === f.name
                                    ? 'bg-surface-container-high text-primary font-semibold'
                                    : 'hover:bg-surface-container text-on-surface-variant'
                                }`}
                              >
                                <span className="material-symbols-outlined text-[14px]">description</span>
                                <span className="flex-1 truncate">{f.name}</span>
                                {activeFile === f.name && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* service */}
                      {services.length > 0 && (
                        <div className="pl-3 flex flex-col pt-1">
                          <div className="flex items-center gap-1 py-0.5 text-on-surface-variant">
                            <span className="material-symbols-outlined text-[14px] text-primary-fixed-dim">
                              folder
                            </span>
                            <span className="text-on-surface font-medium text-[11px]">service</span>
                          </div>
                          <div className="pl-3 flex flex-col">
                            {services.map((f) => (
                              <div
                                key={f.name}
                                onClick={() => setActiveFile(f.name)}
                                className={`flex items-center gap-1.5 py-1 px-1.5 rounded cursor-pointer transition-colors ${
                                  activeFile === f.name
                                    ? 'bg-surface-container-high text-primary font-semibold'
                                    : 'hover:bg-surface-container text-on-surface-variant'
                                }`}
                              >
                                <span className="material-symbols-outlined text-[14px]">description</span>
                                <span className="flex-1 truncate">{f.name}</span>
                                {activeFile === f.name && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* controller */}
                      {controllers.length > 0 && (
                        <div className="pl-3 flex flex-col pt-1">
                          <div className="flex items-center gap-1 py-0.5 text-on-surface-variant">
                            <span className="material-symbols-outlined text-[14px] text-primary-fixed-dim">
                              folder
                            </span>
                            <span className="text-on-surface font-medium text-[11px]">controller</span>
                          </div>
                          <div className="pl-3 flex flex-col">
                            {controllers.map((f) => (
                              <div
                                key={f.name}
                                onClick={() => setActiveFile(f.name)}
                                className={`flex items-center gap-1.5 py-1 px-1.5 rounded cursor-pointer transition-colors ${
                                  activeFile === f.name
                                    ? 'bg-surface-container-high text-primary font-semibold'
                                    : 'hover:bg-surface-container text-on-surface-variant'
                                }`}
                              >
                                <span className="material-symbols-outlined text-[14px]">description</span>
                                <span className="flex-1 truncate">{f.name}</span>
                                {activeFile === f.name && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* resources/config */}
                      {configs.length > 0 && (
                        <div className="pl-3 flex flex-col pt-1">
                          <div className="flex items-center gap-1 py-0.5 text-on-surface-variant">
                            <span className="material-symbols-outlined text-[14px] text-tertiary">
                              folder
                            </span>
                            <span className="text-[11px]">src/main/resources</span>
                          </div>
                          <div className="pl-3 flex flex-col">
                            {configs.map((f) => (
                              <div
                                key={f.name}
                                onClick={() => setActiveFile(f.name)}
                                className={`flex items-center gap-1.5 py-1 px-1.5 rounded cursor-pointer transition-colors ${
                                  activeFile === f.name
                                    ? 'bg-surface-container-high text-tertiary font-semibold'
                                    : 'hover:bg-surface-container text-on-surface-variant'
                                }`}
                              >
                                <span className="material-symbols-outlined text-[14px]">tune</span>
                                <span className="flex-1 truncate">{f.name}</span>
                                {activeFile === f.name && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="p-4 text-center text-outline flex flex-col items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-[24px]">folder_special</span>
                    <span className="text-xs">Sin archivos generados todavía.</span>
                    <span className="text-[10px]">Pulse "Generar backend" para compilar.</span>
                  </div>
                )}
              </div>
            </div>

            {/* ACTION BUTTONS (CU11 DOWNLOAD ZIP & DOCKER HELPER) */}
            <div className="flex flex-col gap-2 pt-1">
              <button
                id="btn-descargar-backend"
                onClick={handleDownloadZip}
                disabled={isDownloadingZip || isLoadingDiagram || !diagrama || !isOwner || isOffline}
                className={`w-full flex items-center justify-center gap-2 p-3 rounded-lg text-xs font-bold shadow transition-all ${
                  isDownloadingZip
                    ? 'bg-surface-container text-on-surface-variant cursor-wait'
                    : isOffline
                    ? 'bg-surface-container text-outline cursor-not-allowed opacity-60'
                    : !isOwner
                    ? 'bg-surface-container text-outline cursor-not-allowed opacity-60'
                    : 'bg-primary/90 hover:bg-primary text-on-primary transform active:scale-95 shadow-primary/20 cursor-pointer'
                }`}
                title={
                  isOffline
                    ? 'Esta función requiere conexión a internet. Disponible cuando vuelva la conexión.'
                    : !isOwner
                    ? 'Solo el propietario del proyecto puede descargar el backend (CU11).'
                    : 'Descargar proyecto Java 17 + Spring Boot completo en archivo .ZIP (CU11)'
                }
              >
                <span className={`material-symbols-outlined text-[18px] ${isDownloadingZip ? 'animate-spin' : ''}`}>
                  {isDownloadingZip ? 'refresh' : 'download'}
                </span>
                <span>{isDownloadingZip ? 'EMPAQUETANDO ZIP...' : 'DESCARGAR BACKEND (.ZIP)'}</span>
              </button>

              <button
                onClick={handleCopyDocker}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-medium transition-colors shadow-sm border border-outline-variant/20"
              >
                <span className="material-symbols-outlined text-[16px] text-tertiary">terminal</span>
                <span>Copiar docker-compose.yml</span>
              </button>
            </div>
          </div>

          {/* COL RIGHT: SYNTAX VIEWER & CONFIGURATION (9 COLS) */}
          <div className="lg:col-span-8 xl:col-span-9 flex flex-col gap-4">
            {/* CODE EDITOR PANEL */}
            <div className="bg-surface-container-low rounded-xl shadow-xl overflow-hidden flex flex-col border border-outline-variant/20">
              {/* TAB HEADER */}
              <div className="bg-surface-container-lowest px-4 py-1.5 flex items-center justify-between border-b border-outline-variant/20">
                <div className="flex items-center gap-1 overflow-x-auto">
                  {generationResult && currentFiles.length > 0 ? (
                    currentFiles.slice(0, 5).map((f) => (
                      <div
                        key={f.name}
                        onClick={() => setActiveFile(f.name)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t text-xs font-mono cursor-pointer transition-colors whitespace-nowrap ${
                          activeFile === f.name
                            ? 'bg-surface-container text-primary font-semibold border-b-2 border-primary'
                            : 'text-on-surface-variant hover:bg-surface-container-high'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[14px]">code</span>
                        <span>{f.name}</span>
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-outline">
                      <span className="material-symbols-outlined text-[14px]">terminal</span>
                      <span>Vista previa de código</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-outline hidden sm:inline">
                    Java 17 • Spring Boot 3.2 • Spring Data JPA
                  </span>
                  <button
                    onClick={handleCopyCode}
                    disabled={!currentCode}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-mono text-xs transition-colors disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      {copiedCode ? 'check' : 'content_copy'}
                    </span>
                    <span>{copiedCode ? 'Copiado' : 'Copiar código'}</span>
                  </button>
                </div>
              </div>

              {/* CODE TEXT AREA WITH LINENUMBERS & HIGHLIGHTING */}
              <div className="bg-surface-container-lowest p-4 font-mono text-xs overflow-x-auto min-h-[440px] flex">
                {generationResult && currentCode ? (
                  <>
                    {/* Line numbers */}
                    <div className="select-none text-outline-variant pr-4 text-right flex flex-col leading-relaxed border-r border-outline-variant/10">
                      {Array.from({ length: currentCode.split('\n').length }).map((_, idx) => (
                        <span key={idx}>{(idx + 1).toString().padStart(2, '0')}</span>
                      ))}
                    </div>

                    {/* Code Body */}
                    <pre className="leading-relaxed text-on-surface flex-1 pl-4 font-mono text-xs m-0 whitespace-pre overflow-x-auto">
                      <code>{currentCode}</code>
                    </pre>
                  </>
                ) : (
                  <div className="w-full flex flex-col items-center justify-center p-12 text-center text-on-surface-variant gap-3">
                    <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                      <span className="material-symbols-outlined text-[32px]">code_blocks</span>
                    </div>
                    <div className="text-base font-bold text-on-surface">
                      Generación de Backend Spring Boot (CU10)
                    </div>
                    <p className="text-xs text-outline max-w-md">
                      El proyecto actualmente tiene <strong>{totalClassesCount}</strong> clase(s) y{' '}
                      <strong>{totalRelationsCount}</strong> relación(es) en PostgreSQL. Pulse el botón para compilar
                      las entidades JPA, repositorios, servicios y controladores en código Java 17 real.
                    </p>
                    {isOwner ? (
                      <button
                        onClick={handleGenerarBackend}
                        disabled={isGenerating || isLoadingDiagram || !diagrama}
                        className="mt-2 flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary hover:bg-inverse-primary text-on-primary font-semibold text-xs shadow-lg transition-transform active:scale-95 cursor-pointer shadow-primary/25"
                      >
                        <span className="material-symbols-outlined text-[18px]">bolt</span>
                        <span>Generar backend ahora</span>
                      </button>
                    ) : (
                      <div className="mt-2 px-4 py-2 rounded bg-surface-container text-xs text-outline flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px]">lock</span>
                        <span>Inicie sesión como Propietario para generar el backend.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* DDL & REPO DUAL DRAWER */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* POSTGRESQL CONFIGURATION PREVIEW */}
              <div className="bg-surface-container-low rounded-xl p-4 shadow-lg flex flex-col gap-2 border border-outline-variant/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-tertiary text-[18px]">
                      storage
                    </span>
                    <span className="text-xs text-on-surface font-semibold">
                      Configuración PostgreSQL (Spring Boot)
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-tertiary bg-surface-container-high px-2 py-0.5 rounded">
                    application.properties
                  </span>
                </div>
                <pre className="bg-surface-container-lowest rounded-lg p-3 font-mono text-xs text-on-surface-variant overflow-x-auto leading-relaxed max-h-56 border border-outline-variant/15">
                  <code>
                    {configs.find((f) => f.name === 'application.properties')?.content ||
                      `spring.application.name=classflow-backend
spring.datasource.url=jdbc:postgresql://localhost:5432/classflow_ai
spring.datasource.username=postgres
spring.datasource.password=password
spring.jpa.hibernate.ddl-auto=update
spring.jpa.show-sql=true
spring.jpa.properties.hibernate.format_sql=true`}
                  </code>
                </pre>
              </div>

              {/* CONTROLLER & ENDPOINTS SPEC */}
              <div className="bg-surface-container-low rounded-xl p-4 shadow-lg flex flex-col gap-2 border border-outline-variant/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary text-[18px]">api</span>
                    <span className="text-xs text-on-surface font-semibold">
                      Endpoints REST Derivados (CRUD)
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-primary-fixed-dim bg-surface-container-high px-2 py-0.5 rounded">
                    Spring MVC
                  </span>
                </div>
                <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto">
                  {(diagrama?.clases || []).length > 0 ? (
                    (diagrama?.clases || []).map((cls) => {
                      const basePath = `/api/v1/${cls.nombre.toLowerCase()}s`;
                      return (
                        <div key={cls.id_clase} className="flex flex-col gap-1 border-b border-outline-variant/10 pb-1.5">
                          <div className="p-1.5 rounded bg-surface-container flex items-center justify-between font-mono text-xs">
                            <div className="flex items-center gap-2">
                              <span className="px-1.5 py-0.2 rounded font-bold text-[9px] bg-tertiary-container text-on-tertiary-container">
                                GET
                              </span>
                              <span className="text-on-surface text-[11px]">{basePath}</span>
                            </div>
                            <span className="text-outline text-[10px]">findAll()</span>
                          </div>
                          <div className="p-1.5 rounded bg-surface-container flex items-center justify-between font-mono text-xs">
                            <div className="flex items-center gap-2">
                              <span className="px-1.5 py-0.2 rounded font-bold text-[9px] bg-primary-container text-on-primary-container">
                                POST
                              </span>
                              <span className="text-on-surface text-[11px]">{basePath}</span>
                            </div>
                            <span className="text-outline text-[10px]">create(@RequestBody)</span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-3 text-center text-outline text-xs">
                      Cargue clases en el editor para derivar endpoints REST.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TOAST NOTIFICATION */}
      {toastInfo.visible && (
        <div className="fixed bottom-6 right-6 z-50 bg-surface-container-highest text-on-surface p-3.5 px-4 rounded-xl shadow-2xl flex items-center gap-3 border border-outline-variant/30 animate-in fade-in slide-in-from-bottom-5">
          <span className="material-symbols-outlined text-tertiary">check_circle</span>
          <div className="flex flex-col">
            <span className="text-xs font-bold">{toastInfo.title}</span>
            <span className="text-[11px] text-on-surface-variant">{toastInfo.message}</span>
          </div>
        </div>
      )}
    </div>
  );
};
