import React, { useState } from 'react';
import JSZip from 'jszip';
import confetti from 'canvas-confetti';
import { AppScreen, UserProfile } from '../types';
import { NESTJS_FILES, SPRING_BOOT_FILES } from '../data/mockData';

interface BackendGeneratorScreenProps {
  onNavigate: (screen: AppScreen) => void;
  currentUser: UserProfile;
}

export const BackendGeneratorScreen: React.FC<BackendGeneratorScreenProps> = ({
  onNavigate,
  currentUser: _currentUser,
}) => {
  const [selectedStack, setSelectedStack] = useState<'spring' | 'nest'>('spring');
  const [activeFile, setActiveFile] = useState<string>('Cliente.java');
  const [copiedCode, setCopiedCode] = useState(false);
  const [toastInfo, setToastInfo] = useState<{ title: string; message: string; visible: boolean }>({
    title: '',
    message: '',
    visible: false,
  });

  // Modal states
  const [modalOcrOpen, setModalOcrOpen] = useState(false);
  const [modalXmiOpen, setModalXmiOpen] = useState(false);
  const [isGeneratingZip, setIsGeneratingZip] = useState(false);

  const showToast = (title: string, message: string) => {
    setToastInfo({ title, message, visible: true });
    setTimeout(() => {
      setToastInfo((prev) => ({ ...prev, visible: false }));
    }, 3500);
  };

  const currentFiles = selectedStack === 'spring' ? SPRING_BOOT_FILES : NESTJS_FILES;
  const currentCode = currentFiles[activeFile] || Object.values(currentFiles)[0];

  // Actual ZIP creation with JSZip
  const handleDownloadZip = async () => {
    setIsGeneratingZip(true);
    try {
      const zip = new JSZip();
      const folderName =
        selectedStack === 'spring' ? 'sistema-ventas-backend-spring' : 'sistema-ventas-backend-nest';
      const root = zip.folder(folderName);

      // Add files
      Object.entries(currentFiles).forEach(([name, content]) => {
        if (name.endsWith('.java')) {
          root?.file(`src/main/java/com/app/ventas/${name}`, content);
        } else if (name.endsWith('.sql')) {
          root?.file(`src/main/resources/db/${name}`, content);
        } else {
          root?.file(name, content);
        }
      });

      // Add a standard README
      root?.file(
        'README.md',
        `# Sistema de Ventas Backend\nGenerado de forma determinista por ClassFlow AI (AST Engine v2.4).\n\n## Ejecución rápida\n\`\`\`bash\ndocker-compose up -d\n\`\`\`\n`
      );

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${folderName}.zip`;
      a.click();
      URL.revokeObjectURL(url);

      confetti({
        particleCount: 60,
        spread: 60,
        origin: { y: 0.8 },
      });

      showToast('Descarga completada', `${folderName}.zip generado y descargado con éxito`);
    } catch (e) {
      showToast('Error', 'No se pudo generar el archivo ZIP');
    } finally {
      setIsGeneratingZip(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard?.writeText(currentCode);
    setCopiedCode(true);
    showToast('Código copiado', `${activeFile} copiado al portapapeles`);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyDocker = () => {
    const dockerContent = SPRING_BOOT_FILES['docker-compose.yml'];
    navigator.clipboard?.writeText(dockerContent);
    showToast('Docker copiado', 'docker-compose.yml copiado al portapapeles');
  };

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
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-tertiary-container text-on-tertiary-container shadow-sm">
                  <span className="material-symbols-outlined text-[14px]">verified</span>
                  <span className="text-xs font-semibold">
                    Validación sintáctica exitosa: 0 advertencias, 0 errores
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-on-surface-variant text-xs flex-wrap">
                <span>
                  Proyecto: <strong className="text-on-surface font-medium">Sistema de Ventas</strong>
                </span>
                <span>•</span>
                <span>
                  Diagrama:{' '}
                  <strong className="text-primary-fixed-dim font-medium">
                    Diagrama de clases principal
                  </strong>
                </span>
                <span>•</span>
                <span className="font-mono text-[11px] text-outline">
                  Engine: Deterministic AST Compiler v2.4
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setModalOcrOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-surface-container-high hover:bg-surface-container-highest text-on-surface transition-colors shadow-sm text-xs font-medium border border-outline-variant/20"
              >
                <span className="material-symbols-outlined text-[16px] text-primary">
                  document_scanner
                </span>
                <span>Importar OCR</span>
              </button>
              <button
                onClick={() => setModalXmiOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-surface-container-high hover:bg-surface-container-highest text-on-surface transition-colors shadow-sm text-xs font-medium border border-outline-variant/20"
              >
                <span className="material-symbols-outlined text-[16px] text-secondary">
                  file_upload
                </span>
                <span>Importar XMI</span>
              </button>
              <button
                onClick={() => onNavigate('editor')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-surface-variant hover:bg-surface-bright text-on-surface transition-colors shadow-sm text-xs font-medium"
              >
                <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                <span>Volver al Editor UML</span>
              </button>
            </div>
          </div>

          {/* METRIC CHIPS */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 pt-1">
            <div className="bg-surface-container rounded-lg p-2.5 px-3 flex items-center justify-between shadow-sm border border-outline-variant/15">
              <div className="flex flex-col">
                <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
                  Entidades
                </span>
                <span className="text-base text-on-surface font-bold">3 Clases</span>
              </div>
              <div className="h-8 w-8 rounded bg-surface-container-high flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[18px]">schema</span>
              </div>
            </div>

            <div className="bg-surface-container rounded-lg p-2.5 px-3 flex items-center justify-between shadow-sm border border-outline-variant/15">
              <div className="flex flex-col">
                <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
                  Nombres
                </span>
                <span className="text-xs text-on-surface truncate font-semibold">
                  Cliente, Venta, Prod.
                </span>
              </div>
              <div className="h-8 w-8 rounded bg-surface-container-high flex items-center justify-center text-secondary">
                <span className="material-symbols-outlined text-[18px]">dataset</span>
              </div>
            </div>

            <div className="bg-surface-container rounded-lg p-2.5 px-3 flex items-center justify-between shadow-sm border border-outline-variant/15">
              <div className="flex flex-col">
                <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
                  Campos
                </span>
                <span className="text-base text-on-surface font-bold">9 Atributos</span>
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
                <span className="text-base text-on-surface font-bold">3 Métodos</span>
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
                <span className="text-base text-on-surface font-bold">2 Asoc. UML</span>
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
                Pipeline de Generación Determinista
              </span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-tertiary-container text-on-tertiary-container">
              <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse"></span>
              <span className="text-[11px] font-bold tracking-wider">
                BACKEND GENERADO CORRECTAMENTE
              </span>
            </div>
          </div>

          {/* PROGRESS TRACK */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1">
            {[
              { num: '1. Análisis UML', sub: 'P-AST ok' },
              { num: '2. Multiplicidades', sub: '1..N resuelto' },
              { num: '3. Tipado Entidades', sub: 'Strict Java 21' },
              { num: '4. Mapeo ORM', sub: 'JPA / Hibernate' },
              { num: '5. Capas REST', sub: 'Ctrl / Svc / Repo' },
              { num: '6. SQL & Zip', sub: 'DDL Postgres' },
            ].map((st, i) => (
              <div
                key={i}
                className="bg-surface-container rounded-lg p-2 px-2.5 flex items-center gap-2 shadow-sm border border-outline-variant/10"
              >
                <div className="w-5 h-5 rounded-full bg-tertiary-container flex items-center justify-center text-on-tertiary-container">
                  <span className="material-symbols-outlined text-[13px] font-bold">check</span>
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
          {/* COL LEFT: ARTIFACT EXPLORER & STACK SELECTOR (3 COLS) */}
          <div className="lg:col-span-4 xl:col-span-3 bg-surface-container-low rounded-xl p-4 shadow-xl flex flex-col gap-4 border border-outline-variant/20">
            {/* STACK PICKER */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-outline uppercase tracking-wider">
                Stack Tecnológico
              </label>
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={() => {
                    setSelectedStack('spring');
                    setActiveFile('Cliente.java');
                    showToast('Stack activo', 'Spring Boot 3.2 (Java 21) seleccionado');
                  }}
                  className={`flex items-center justify-between p-2.5 rounded text-left transition-colors shadow-sm border ${
                    selectedStack === 'spring'
                      ? 'bg-surface-container border-primary/40'
                      : 'bg-surface-container/40 border-outline-variant/10 hover:bg-surface-container'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-tertiary text-[20px]">
                      code_blocks
                    </span>
                    <div className="flex flex-col leading-tight">
                      <span className="text-xs text-on-surface font-semibold">Spring Boot 3.2</span>
                      <span className="font-mono text-[11px] text-on-surface-variant">
                        Java 21 + PostgreSQL
                      </span>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-primary text-[18px]">
                    {selectedStack === 'spring' ? 'radio_button_checked' : 'radio_button_unchecked'}
                  </span>
                </button>

                <button
                  onClick={() => {
                    setSelectedStack('nest');
                    setActiveFile('cliente.entity.ts');
                    showToast('Stack alternado', 'NestJS 10 (TypeScript + Prisma) seleccionado');
                  }}
                  className={`flex items-center justify-between p-2.5 rounded text-left transition-colors border ${
                    selectedStack === 'nest'
                      ? 'bg-surface-container border-primary/40 shadow-sm'
                      : 'bg-surface-container/40 border-outline-variant/10 hover:bg-surface-container'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary text-[20px]">
                      javascript
                    </span>
                    <div className="flex flex-col leading-tight">
                      <span className="text-xs text-on-surface-variant font-medium">NestJS 10</span>
                      <span className="font-mono text-[11px] text-outline">TypeScript + Prisma</span>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-outline text-[18px]">
                    {selectedStack === 'nest' ? 'radio_button_checked' : 'radio_button_unchecked'}
                  </span>
                </button>
              </div>
            </div>

            {/* FILE TREE */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-outline uppercase tracking-wider">
                  Artefactos Generados
                </span>
                <span className="font-mono text-[11px] text-primary">
                  {Object.keys(currentFiles).length} archivos
                </span>
              </div>

              <div className="bg-surface-container-lowest rounded-lg p-2 flex flex-col font-mono text-xs select-none max-h-[510px] overflow-y-auto border border-outline-variant/20">
                {/* Root folder */}
                <div className="flex items-center gap-1.5 py-1 px-1 text-on-surface-variant">
                  <span className="material-symbols-outlined text-[16px] text-primary">
                    folder_open
                  </span>
                  <span className="font-semibold text-on-surface">
                    {selectedStack === 'spring'
                      ? 'sistema-ventas-backend'
                      : 'sistema-ventas-nestjs'}
                  </span>
                </div>

                {selectedStack === 'spring' ? (
                  <div className="pl-4 flex flex-col">
                    <div className="flex items-center gap-1.5 py-0.5 text-on-surface-variant">
                      <span className="material-symbols-outlined text-[14px]">folder_open</span>
                      <span>src/main/java/com/app/ventas</span>
                    </div>

                    {/* model */}
                    <div className="pl-4 flex flex-col">
                      <div className="flex items-center gap-1 py-0.5 text-on-surface-variant">
                        <span className="material-symbols-outlined text-[14px] text-primary-fixed-dim">
                          folder_open
                        </span>
                        <span className="text-on-surface font-medium">model</span>
                      </div>
                      <div className="pl-4 flex flex-col">
                        {['Cliente.java', 'Venta.java', 'Producto.java'].map((fname) => (
                          <div
                            key={fname}
                            onClick={() => setActiveFile(fname)}
                            className={`flex items-center gap-1.5 py-1 px-1.5 rounded cursor-pointer transition-colors ${
                              activeFile === fname
                                ? 'bg-surface-container-high text-primary font-semibold'
                                : 'hover:bg-surface-container text-on-surface-variant'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              description
                            </span>
                            <span className="flex-1 truncate">{fname}</span>
                            {activeFile === fname && (
                              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* repository */}
                    <div className="pl-4 flex flex-col pt-1">
                      <div className="flex items-center gap-1 py-0.5 text-on-surface-variant">
                        <span className="material-symbols-outlined text-[14px] text-primary-fixed-dim">
                          folder
                        </span>
                        <span>repository</span>
                      </div>
                      <div className="pl-4 flex flex-col">
                        {['ClienteRepository.java', 'VentaRepository.java'].map((fname) => (
                          <div
                            key={fname}
                            onClick={() => setActiveFile(fname)}
                            className={`flex items-center gap-1.5 py-1 px-1.5 rounded cursor-pointer transition-colors ${
                              activeFile === fname
                                ? 'bg-surface-container-high text-primary font-semibold'
                                : 'hover:bg-surface-container text-on-surface-variant'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              description
                            </span>
                            <span className="flex-1 truncate">{fname}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* service */}
                    <div className="pl-4 flex flex-col pt-1">
                      <div className="flex items-center gap-1 py-0.5 text-on-surface-variant">
                        <span className="material-symbols-outlined text-[14px] text-primary-fixed-dim">
                          folder
                        </span>
                        <span>service</span>
                      </div>
                      <div className="pl-4 flex flex-col">
                        {['ClienteService.java', 'VentaService.java'].map((fname) => (
                          <div
                            key={fname}
                            onClick={() => setActiveFile(fname)}
                            className={`flex items-center gap-1.5 py-1 px-1.5 rounded cursor-pointer transition-colors ${
                              activeFile === fname
                                ? 'bg-surface-container-high text-primary font-semibold'
                                : 'hover:bg-surface-container text-on-surface-variant'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              description
                            </span>
                            <span className="flex-1 truncate">{fname}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* controller */}
                    <div className="pl-4 flex flex-col pt-1">
                      <div className="flex items-center gap-1 py-0.5 text-on-surface-variant">
                        <span className="material-symbols-outlined text-[14px] text-primary-fixed-dim">
                          folder
                        </span>
                        <span>controller</span>
                      </div>
                      <div className="pl-4 flex flex-col">
                        <div
                          onClick={() => setActiveFile('ClienteController.java')}
                          className={`flex items-center gap-1.5 py-1 px-1.5 rounded cursor-pointer transition-colors ${
                            activeFile === 'ClienteController.java'
                              ? 'bg-surface-container-high text-primary font-semibold'
                              : 'hover:bg-surface-container text-on-surface-variant'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[14px]">
                            description
                          </span>
                          <span className="flex-1 truncate">ClienteController.java</span>
                        </div>
                      </div>
                    </div>

                    {/* database ddl */}
                    <div className="pl-4 flex flex-col pt-1">
                      <div className="flex items-center gap-1 py-0.5 text-on-surface-variant">
                        <span className="material-symbols-outlined text-[14px] text-tertiary">
                          folder
                        </span>
                        <span>resources/db</span>
                      </div>
                      <div className="pl-4 flex flex-col">
                        <div
                          onClick={() => setActiveFile('V1__init_schema.sql')}
                          className={`flex items-center gap-1.5 py-1 px-1.5 rounded cursor-pointer transition-colors ${
                            activeFile === 'V1__init_schema.sql'
                              ? 'bg-surface-container-high text-tertiary font-semibold'
                              : 'hover:bg-surface-container text-tertiary'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[14px]">database</span>
                          <span className="flex-1 truncate">V1__init_schema.sql</span>
                        </div>
                      </div>
                    </div>

                    {/* docker-compose */}
                    <div className="pl-4 flex flex-col pt-1">
                      <div
                        onClick={() => setActiveFile('docker-compose.yml')}
                        className={`flex items-center gap-1.5 py-1 px-1.5 rounded cursor-pointer transition-colors ${
                          activeFile === 'docker-compose.yml'
                            ? 'bg-surface-container-high text-secondary font-semibold'
                            : 'hover:bg-surface-container text-on-surface-variant'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[14px] text-secondary">
                          terminal
                        </span>
                        <span className="flex-1 truncate">docker-compose.yml</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="pl-4 flex flex-col gap-1">
                    {Object.keys(NESTJS_FILES).map((fname) => (
                      <div
                        key={fname}
                        onClick={() => setActiveFile(fname)}
                        className={`flex items-center gap-1.5 py-1 px-1.5 rounded cursor-pointer transition-colors ${
                          activeFile === fname
                            ? 'bg-surface-container-high text-primary font-semibold'
                            : 'hover:bg-surface-container text-on-surface-variant'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[14px]">description</span>
                        <span className="flex-1 truncate">{fname}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={handleDownloadZip}
                disabled={isGeneratingZip}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-lg bg-primary hover:bg-inverse-primary text-on-primary text-sm font-bold shadow-lg transition-all transform active:scale-95 cursor-pointer shadow-primary/20"
              >
                {isGeneratingZip ? (
                  <>
                    <span className="material-symbols-outlined text-[20px] animate-spin">
                      refresh
                    </span>
                    <span>EMPAQUETANDO ARCHIVOS...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[20px]">download</span>
                    <span>DESCARGAR BACKEND (.ZIP)</span>
                  </>
                )}
              </button>

              <button
                onClick={handleCopyDocker}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-medium transition-colors shadow-sm border border-outline-variant/20"
              >
                <span className="material-symbols-outlined text-[16px] text-tertiary">terminal</span>
                <span>Copiar Dockerfile / compose up</span>
              </button>
            </div>
          </div>

          {/* COL RIGHT: SYNTAX VIEWER & SQL DDL (9 COLS) */}
          <div className="lg:col-span-8 xl:col-span-9 flex flex-col gap-4">
            {/* CODE EDITOR PANEL */}
            <div className="bg-surface-container-low rounded-xl shadow-xl overflow-hidden flex flex-col border border-outline-variant/20">
              {/* TAB HEADER */}
              <div className="bg-surface-container-lowest px-4 py-1.5 flex items-center justify-between border-b border-outline-variant/20">
                <div className="flex items-center gap-1">
                  {['Cliente.java', 'Venta.java', 'V1__init_schema.sql'].map((tab) => (
                    <div
                      key={tab}
                      onClick={() => setActiveFile(tab)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t text-xs font-mono cursor-pointer transition-colors ${
                        activeFile === tab
                          ? 'bg-surface-container text-primary font-semibold border-b-2 border-primary'
                          : 'text-on-surface-variant hover:bg-surface-container-high'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]">code</span>
                      <span>{tab}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-outline hidden sm:inline">
                    {selectedStack === 'spring'
                      ? 'JPA 3.1 • Hibernate 6 • Spring 3.2'
                      : 'TypeORM • Prisma 5 • Node 20'}
                  </span>
                  <button
                    onClick={handleCopyCode}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-mono text-xs transition-colors"
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
                {/* Line numbers */}
                <div className="select-none text-outline-variant pr-4 text-right flex flex-col leading-relaxed border-r border-outline-variant/10">
                  {Array.from({ length: Math.min(30, currentCode.split('\n').length) }).map(
                    (_, idx) => (
                      <span key={idx}>{(idx + 1).toString().padStart(2, '0')}</span>
                    )
                  )}
                </div>

                {/* Code Body */}
                <pre className="leading-relaxed text-on-surface flex-1 pl-4 font-mono text-xs m-0 whitespace-pre overflow-x-auto">
                  <code>{currentCode}</code>
                </pre>
              </div>
            </div>

            {/* DDL & REPO DUAL DRAWER */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* POSTGRESQL DDL PREVIEW */}
              <div className="bg-surface-container-low rounded-xl p-4 shadow-lg flex flex-col gap-2 border border-outline-variant/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-tertiary text-[18px]">
                      storage
                    </span>
                    <span className="text-xs text-on-surface font-semibold">
                      PostgreSQL DDL Generado
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-tertiary bg-surface-container-high px-2 py-0.5 rounded">
                    V1__init.sql
                  </span>
                </div>
                <pre className="bg-surface-container-lowest rounded-lg p-3 font-mono text-xs text-on-surface-variant overflow-x-auto leading-relaxed max-h-56 border border-outline-variant/15">
                  <code>{SPRING_BOOT_FILES['V1__init_schema.sql']}</code>
                </pre>
              </div>

              {/* CONTROLLER & ENDPOINTS SPEC */}
              <div className="bg-surface-container-low rounded-xl p-4 shadow-lg flex flex-col gap-2 border border-outline-variant/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary text-[18px]">api</span>
                    <span className="text-xs text-on-surface font-semibold">
                      Endpoints REST Derivados
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-primary-fixed-dim bg-surface-container-high px-2 py-0.5 rounded">
                    OpenAPI 3.0 ready
                  </span>
                </div>
                <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto">
                  {[
                    { method: 'GET', path: '/api/v1/clientes', handler: 'findAll()' },
                    {
                      method: 'POST',
                      path: '/api/v1/clientes',
                      handler: 'save(@Valid body)',
                    },
                    {
                      method: 'GET',
                      path: '/api/v1/ventas',
                      handler: 'findByClienteId()',
                    },
                    {
                      method: 'POST',
                      path: '/api/v1/ventas',
                      handler: 'procesarVenta()',
                    },
                  ].map((ep, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded bg-surface-container flex items-center justify-between font-mono text-xs border border-outline-variant/10"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                            ep.method === 'GET'
                              ? 'bg-tertiary-container text-on-tertiary-container'
                              : 'bg-primary-container text-on-primary-container'
                          }`}
                        >
                          {ep.method}
                        </span>
                        <span className="text-on-surface">{ep.path}</span>
                      </div>
                      <span className="text-outline">{ep.handler}</span>
                    </div>
                  ))}
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

      {/* MODAL 1: OCR IMPORT */}
      {modalOcrOpen && (
        <div className="fixed inset-0 z-50 bg-surface-container-lowest/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container rounded-xl max-w-xl w-full p-6 shadow-2xl flex flex-col gap-4 border border-outline-variant/30">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">
                  document_scanner
                </span>
                <h3 className="text-base font-bold text-on-surface">
                  Importar diagrama desde imagen (OCR)
                </h3>
              </div>
              <button
                onClick={() => setModalOcrOpen(false)}
                className="text-outline hover:text-on-surface"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Sube un boceto en pizarra, fotografía o captura digital de tu diagrama de clases. El
              motor OCR de ClassFlow AI detectará clases, atributos, visibilidad (+, -, #) y
              multiplicidades automáticamente.
            </p>
            {/* Dropzone */}
            <div
              onClick={() => {
                showToast('OCR Procesado', 'Modelo UML sincronizado con éxito desde imagen');
                setModalOcrOpen(false);
              }}
              className="rounded-xl bg-surface-container-low p-6 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-surface-container-high transition-colors border-2 border-dashed border-outline-variant/30"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-[28px]">
                  add_photo_alternate
                </span>
              </div>
              <span className="text-xs font-semibold text-on-surface">
                Arrastra tu diagrama PNG, JPG o WebP
              </span>
              <span className="text-[11px] text-outline">
                o haz clic para explorar en tu equipo (Máx. 15MB)
              </span>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="font-mono text-[11px] text-tertiary flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                <span>Visión artificial v4.2 activa</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setModalOcrOpen(false)}
                  className="px-3.5 py-1.5 rounded bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    showToast('OCR Procesado', 'Modelo UML sincronizado con éxito desde imagen');
                    setModalOcrOpen(false);
                  }}
                  className="px-4 py-1.5 rounded bg-primary hover:bg-inverse-primary text-on-primary text-xs font-semibold transition-colors"
                >
                  Procesar y Extraer AST
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: XMI IMPORT */}
      {modalXmiOpen && (
        <div className="fixed inset-0 z-50 bg-surface-container-lowest/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container rounded-xl max-w-xl w-full p-6 shadow-2xl flex flex-col gap-4 border border-outline-variant/30">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[22px]">
                  file_upload
                </span>
                <h3 className="text-base font-bold text-on-surface">
                  Importar diagrama UML (XMI / XML)
                </h3>
              </div>
              <button
                onClick={() => setModalXmiOpen(false)}
                className="text-outline hover:text-on-surface"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Importa esquemas estandarizados de herramientas como Enterprise Architect, Visual
              Paradigm, StarUML o Papyrus mediante XMI 2.1 / 2.4.1.
            </p>
            {/* Dropzone */}
            <div
              onClick={() => {
                showToast('XMI Importado', 'Entidades y multiplicidades reconstruidas');
                setModalXmiOpen(false);
              }}
              className="rounded-xl bg-surface-container-low p-6 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-surface-container-high transition-colors border-2 border-dashed border-outline-variant/30"
            >
              <div className="w-12 h-12 rounded-full bg-secondary/10 text-secondary flex items-center justify-center">
                <span className="material-symbols-outlined text-[28px]">account_tree</span>
              </div>
              <span className="text-xs font-semibold text-on-surface">
                Selecciona archivo .xmi o .uml
              </span>
              <span className="text-[11px] text-outline">
                Formato XML Metadata Interchange
              </span>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="font-mono text-[11px] text-secondary flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">rule</span>
                <span>Parsing Schema XMI 2.4.1</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setModalXmiOpen(false)}
                  className="px-3.5 py-1.5 rounded bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    showToast('XMI Importado', 'Entidades y multiplicidades reconstruidas');
                    setModalXmiOpen(false);
                  }}
                  className="px-4 py-1.5 rounded bg-secondary-container hover:bg-secondary text-on-secondary-container text-xs font-semibold transition-colors"
                >
                  Importar y Compilar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
