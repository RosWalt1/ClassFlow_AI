import React, { useState } from 'react';
import { AppScreen, UMLAttribute, UMLClassNode, UMLMethod, UMLRelation, UserProfile } from '../types';
import { ASSETS, INITIAL_CLASSES, INITIAL_RELATIONS } from '../data/mockData';

interface EditorScreenProps {
  onNavigate: (screen: AppScreen) => void;
  currentUser: UserProfile;
}

export const EditorScreen: React.FC<EditorScreenProps> = ({
  onNavigate,
  currentUser: _currentUser,
}) => {
  // State for UML classes and relations
  const [classes, setClasses] = useState<UMLClassNode[]>(INITIAL_CLASSES);
  const [relations] = useState<UMLRelation[]>(INITIAL_RELATIONS);
  const [selectedClassId, setSelectedClassId] = useState<string>('producto');
  const [inspectorTab, setInspectorTab] = useState<'general' | 'atributos' | 'metodos'>('atributos');
  
  // Selected attribute for editing inside Inspector
  const [editingAttrId, setEditingAttrId] = useState<string>('p3');
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  // Dragging state for nodes on canvas
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // AI Assistant Chat & Voice state
  const [isAiCollapsed, setIsAiCollapsed] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(true);
  const [aiInputText, setAiInputText] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<
    { sender: 'user' | 'ai'; text: string; highlight?: string }[]
  >([
    { sender: 'user', text: 'Crea una clase Cliente con id, nombre y correo.' },
    {
      sender: 'ai',
      text: 'creada correctamente con tipos estándar Long y String.',
      highlight: 'Clase Cliente',
    },
    { sender: 'user', text: 'Crea una relación uno a muchos entre Cliente y Venta.' },
  ]);

  // Toast collaborator state
  const [showCollabToast, setShowCollabToast] = useState<boolean>(true);
  const [shareModalOpen, setShareModalOpen] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Selected class helper
  const selectedClass = classes.find((c) => c.id === selectedClassId) || classes[0];

  // Drag handlers
  const handleMouseDown = (nodeId: string, e: React.MouseEvent) => {
    setSelectedClassId(nodeId);
    setDraggingNodeId(nodeId);
    const node = classes.find((c) => c.id === nodeId);
    if (node) {
      setDragOffset({
        x: e.clientX - node.x,
        y: e.clientY - node.y,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingNodeId) return;
    const newX = Math.max(20, Math.min(900, e.clientX - dragOffset.x));
    const newY = Math.max(20, Math.min(600, e.clientY - dragOffset.y));

    setClasses((prev) =>
      prev.map((cls) => (cls.id === draggingNodeId ? { ...cls, x: newX, y: newY } : cls))
    );
  };

  const handleMouseUp = () => {
    setDraggingNodeId(null);
  };

  // Inspector edit handlers
  const handleUpdateAttribute = (
    classId: string,
    attrId: string,
    updates: Partial<UMLAttribute>
  ) => {
    setClasses((prev) =>
      prev.map((cls) => {
        if (cls.id !== classId) return cls;
        return {
          ...cls,
          attributes: cls.attributes.map((attr) =>
            attr.id === attrId ? { ...attr, ...updates } : attr
          ),
        };
      })
    );
  };

  const handleAddAttribute = () => {
    if (!selectedClass) return;
    const newId = `attr_${Date.now()}`;
    const newAttr: UMLAttribute = {
      id: newId,
      visibility: '-',
      name: 'nuevoCampo',
      type: 'String',
      isNullable: true,
    };
    setClasses((prev) =>
      prev.map((cls) =>
        cls.id === selectedClass.id
          ? { ...cls, attributes: [...cls.attributes, newAttr] }
          : cls
      )
    );
    setEditingAttrId(newId);
  };

  const handleDeleteAttribute = (attrId: string) => {
    if (!selectedClass) return;
    setClasses((prev) =>
      prev.map((cls) =>
        cls.id === selectedClass.id
          ? { ...cls, attributes: cls.attributes.filter((a) => a.id !== attrId) }
          : cls
      )
    );
    if (editingAttrId === attrId) {
      setEditingAttrId('');
    }
  };

  const handleAddMethod = () => {
    if (!selectedClass) return;
    const newMethod: UMLMethod = {
      id: `method_${Date.now()}`,
      visibility: '+',
      name: 'nuevaOperacion',
      returnType: 'void',
    };
    setClasses((prev) =>
      prev.map((cls) =>
        cls.id === selectedClass.id
          ? { ...cls, methods: [...cls.methods, newMethod] }
          : cls
      )
    );
  };

  // Add new class button
  const handleCreateNewClass = () => {
    const classCount = classes.length + 1;
    const newClass: UMLClassNode = {
      id: `entidad_${Date.now()}`,
      name: `Entidad${classCount}`,
      stereotype: '«entity»',
      x: 180 + classCount * 40,
      y: 200 + classCount * 30,
      width: 250,
      isConcrete: true,
      attributes: [
        { id: `id_${Date.now()}`, visibility: '-', name: 'id', type: 'Long', isPk: true },
        { id: `desc_${Date.now()}`, visibility: '-', name: 'descripcion', type: 'String' },
      ],
      methods: [
        { id: `m_${Date.now()}`, visibility: '+', name: 'procesar', returnType: 'void' },
      ],
    };
    setClasses((prev) => [...prev, newClass]);
    setSelectedClassId(newClass.id);
  };

  // AI Assistant Chat Submit
  const handleAiSend = () => {
    if (!aiInputText.trim()) return;
    const query = aiInputText.trim();
    setChatMessages((prev) => [...prev, { sender: 'user', text: query }]);
    setAiInputText('');

    setTimeout(() => {
      if (query.toLowerCase().includes('factura') || query.toLowerCase().includes('clase')) {
        const newClassId = 'factura_' + Date.now();
        setClasses((prev) => [
          ...prev,
          {
            id: newClassId,
            name: 'Factura',
            stereotype: '«entity»',
            x: 640,
            y: 350,
            width: 240,
            isConcrete: true,
            attributes: [
              { id: 'f1', visibility: '-', name: 'id', type: 'Long', isPk: true },
              { id: 'f2', visibility: '-', name: 'numeroFiscal', type: 'String' },
              { id: 'f3', visibility: '-', name: 'montoTotal', type: 'BigDecimal' },
            ],
            methods: [
              { id: 'fm1', visibility: '+', name: 'emitirComprobante', returnType: 'void' },
            ],
          },
        ]);
        setSelectedClassId(newClassId);
        setChatMessages((prev) => [
          ...prev,
          {
            sender: 'ai',
            text: 'generada en el lienzo y sincronizada con el AST de Java/JPA.',
            highlight: 'Clase Factura',
          },
        ]);
      } else {
        setChatMessages((prev) => [
          ...prev,
          {
            sender: 'ai',
            text: `Comando interpretado: "${query}". El modelo UML ha sido validado contra la especificación OMG.`,
            highlight: 'AST Sincronizado',
          },
        ]);
      }
    }, 700);
  };

  return (
    <div
      className="flex flex-col w-full h-[calc(100vh-3.5rem)] select-none overflow-hidden relative"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Top Editor Toolbar Bar (Flush beneath Shell Header) */}
      <div className="w-full bg-surface-container-lowest px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-md z-30 border-b border-outline-variant/30">
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex items-center gap-1.5 truncate">
            <span className="text-base font-semibold text-on-surface truncate">
              Sistema de Ventas
            </span>
            <span className="text-outline-variant font-mono text-xs">/</span>
            <span className="text-sm text-primary font-medium truncate">
              Diagrama de clases principal
            </span>
          </div>

          {/* Sync Status Badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-container-low shadow-sm">
            <span className="material-symbols-outlined text-[15px] text-tertiary">
              check_circle
            </span>
            <span className="font-mono text-[11px] text-tertiary">Guardado</span>
            <span className="font-mono text-[11px] text-outline">• Hace 4s (WS Activo)</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Collaborators Avatar Stack */}
          <div className="flex items-center -space-x-2">
            <div className="relative group cursor-pointer" title="Carlos Mendoza (Propietario)">
              <img
                className="w-7 h-7 rounded-full object-cover shadow-sm ring-2 ring-surface-container-lowest"
                src={ASSETS.carlosMendozaAlt}
                alt="Carlos Mendoza"
              />
              <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-primary ring-1 ring-surface-container-lowest"></span>
            </div>
            <div className="relative group cursor-pointer" title="Ana López (Editando Producto)">
              <img
                className="w-7 h-7 rounded-full object-cover shadow-sm ring-2 ring-surface-container-lowest"
                src={ASSETS.anaLopez}
                alt="Ana López"
              />
              <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-tertiary animate-ping ring-1 ring-surface-container-lowest"></span>
              <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-tertiary ring-1 ring-surface-container-lowest"></span>
            </div>
            <div className="pl-3 hidden xl:flex flex-col">
              <span className="text-xs text-on-surface font-medium">Ana López</span>
              <span className="font-mono text-[11px] text-tertiary">Editando Producto</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShareModalOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface text-xs font-medium transition-colors shadow-sm"
              title="Compartir sesión colaborativa"
            >
              <span className="material-symbols-outlined text-[16px]">group_add</span>
              <span className="hidden sm:inline">Compartir</span>
            </button>

            <button
              onClick={() => onNavigate('proyectos')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface text-xs font-medium transition-colors shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">cloud_download</span>
              <span className="hidden sm:inline">Importar</span>
            </button>

            <button
              onClick={() => {
                alert('Exportando modelo XMI 2.4.1 compatible con Enterprise Architect y StarUML...');
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface text-xs font-medium transition-colors shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">file_export</span>
              <span className="hidden sm:inline">Exportar .xmi</span>
            </button>

            {/* GENERAR BACKEND ACTION BUTTON (CU10 LINK) */}
            <button
              onClick={() => onNavigate('backend')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:bg-primary-fixed-dim transition-all shadow-md shadow-primary/25 cursor-pointer transform hover:scale-[1.02] active:scale-98"
              title="Ir al pipeline de generación determinista de backend"
            >
              <span className="material-symbols-outlined text-[17px]">bolt</span>
              <span>Generar Backend</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Multi-Pane Visual Area */}
      <div className="relative flex-1 flex overflow-hidden bg-surface-container-lowest">
        {/* 2. LEFT FLOATING UML TOOLBAR (CASE TOOL STYLE) */}
        <div className="absolute left-4 top-4 z-20 flex flex-col items-center bg-surface-container-low/95 backdrop-blur-md rounded-xl p-1 shadow-xl space-y-1 border border-outline-variant/30">
          <button
            className="p-2 rounded-lg bg-primary text-on-primary shadow-sm flex items-center justify-center transition-all"
            title="Herramienta Seleccionar (V)"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_selector_tool</span>
          </button>
          <button
            onClick={handleCreateNewClass}
            className="p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors flex items-center justify-center"
            title="Agregar Clase UML (C)"
          >
            <span className="material-symbols-outlined text-[18px]">add_box</span>
          </button>
          <div className="w-5 h-px bg-surface-variant my-1"></div>

          {/* Connectors / UML Relations */}
          <button
            className="p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors flex items-center justify-center"
            title="Asociación Directa (---)"
          >
            <span className="material-symbols-outlined text-[18px]">horizontal_rule</span>
          </button>
          <button
            className="p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors flex items-center justify-center font-mono"
            title="Agregación (◇---)"
          >
            <span className="material-symbols-outlined text-[18px]">diamond</span>
          </button>
          <button
            className="p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors flex items-center justify-center"
            title="Composición (◆---)"
          >
            <span className="material-symbols-outlined text-[18px] text-secondary">diamond</span>
          </button>
          <button
            className="p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors flex items-center justify-center"
            title="Herencia / Generalización (△---)"
          >
            <span className="material-symbols-outlined text-[18px]">change_history</span>
          </button>
          <button
            className="p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors flex items-center justify-center"
            title="Dependencia (- - >)"
          >
            <span className="material-symbols-outlined text-[18px]">trending_flat</span>
          </button>
          <button
            className="p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors flex items-center justify-center"
            title="Realización (- - △)"
          >
            <span className="material-symbols-outlined text-[18px]">call_made</span>
          </button>
          <div className="w-5 h-px bg-surface-variant my-1"></div>

          <button
            onClick={() => {
              if (selectedClassId && classes.length > 1) {
                setClasses((prev) => prev.filter((c) => c.id !== selectedClassId));
                setSelectedClassId(classes[0].id);
              }
            }}
            className="p-2 rounded-lg hover:bg-error-container text-error hover:text-on-error-container transition-colors flex items-center justify-center"
            title="Eliminar Elemento Seleccionado (Supr)"
          >
            <span className="material-symbols-outlined text-[18px]">delete</span>
          </button>
          <div className="w-5 h-px bg-surface-variant my-1"></div>

          {/* Zoom controls */}
          <button
            onClick={() => setZoomLevel((z) => Math.min(150, z + 10))}
            className="p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors flex items-center justify-center"
            title="Acercar (+)"
          >
            <span className="material-symbols-outlined text-[18px]">zoom_in</span>
          </button>
          <button
            onClick={() => setZoomLevel((z) => Math.max(70, z - 10))}
            className="p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors flex items-center justify-center"
            title="Alejar (-)"
          >
            <span className="material-symbols-outlined text-[18px]">zoom_out</span>
          </button>
          <button
            onClick={() => setZoomLevel(100)}
            className="p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors flex items-center justify-center"
            title="Ajustar al Canvas (Fit)"
          >
            <span className="material-symbols-outlined text-[18px]">fit_screen</span>
          </button>
        </div>

        {/* 3. CENTRAL UML CANVAS */}
        <div className="relative flex-1 h-full overflow-hidden select-none bg-surface">
          {/* SVG Dot Matrix Canvas Pattern */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40">
            <defs>
              <pattern id="dot-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.2" className="fill-surface-variant" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dot-grid)" />
          </svg>

          {/* SVG ORTHOGONAL CONNECTORS LAYER */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
            {/* Dynamic Relation between Cliente and Venta */}
            <g className="transition-all">
              <path
                d="M 290 190 L 410 190 L 410 190 L 520 190"
                fill="none"
                stroke="#908fa0"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Multiplicity Left (1) */}
              <rect x="296" y="168" width="22" height="18" rx="4" className="fill-surface-container-high" />
              <text x="307" y="181" textAnchor="middle" className="fill-on-surface font-mono text-[11px] font-medium">
                1
              </text>
              {/* Midpoint Role label (compras) */}
              <rect x="375" y="166" width="60" height="18" rx="4" className="fill-surface-container-low shadow-sm" />
              <text x="405" y="179" textAnchor="middle" className="fill-primary font-mono text-[10px]">
                compras
              </text>
              {/* Multiplicity Right (0..*) */}
              <rect x="480" y="168" width="26" height="18" rx="4" className="fill-surface-container-high" />
              <text x="493" y="181" textAnchor="middle" className="fill-on-surface font-mono text-[11px] font-medium">
                0..*
              </text>
            </g>

            {/* Dynamic Relation between Venta and Producto */}
            <g className="transition-all">
              <path
                d="M 620 270 L 620 370 L 390 370 L 390 405"
                fill="none"
                stroke="#908fa0"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Filled Composition Diamond at Venta */}
              <polygon points="620,270 615,280 620,290 625,280" className="fill-secondary-container stroke-secondary" strokeWidth="1.5" />
              {/* Multiplicity Venta (0..*) */}
              <rect x="630" y="285" width="26" height="18" rx="4" className="fill-surface-container-high" />
              <text x="643" y="298" textAnchor="middle" className="fill-on-surface font-mono text-[11px] font-medium">
                0..*
              </text>
              {/* Multiplicity Producto (0..*) */}
              <rect x="400" y="380" width="26" height="18" rx="4" className="fill-surface-container-high" />
              <text x="413" y="393" textAnchor="middle" className="fill-on-surface font-mono text-[11px] font-medium">
                0..*
              </text>
            </g>
          </svg>

          {/* UML NODES LAYER */}
          <div
            className="relative w-full h-full"
            style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top left' }}
          >
            {classes.map((cls) => {
              const isSelected = cls.id === selectedClassId;
              return (
                <div
                  key={cls.id}
                  onMouseDown={(e) => handleMouseDown(cls.id, e)}
                  style={{ left: `${cls.x}px`, top: `${cls.y}px`, width: `${cls.width || 260}px` }}
                  className={`absolute rounded-xl transition-shadow duration-100 cursor-move ${
                    isSelected
                      ? 'bg-surface-container shadow-2xl ring-2 ring-primary z-10'
                      : 'bg-surface-container shadow-xl hover:shadow-2xl z-0'
                  }`}
                >
                  {/* Header Compartment */}
                  <div
                    className={`px-4 py-2.5 flex items-center justify-between rounded-t-xl ${
                      isSelected ? 'bg-primary/20 border-b border-primary/30' : 'bg-surface-container-high'
                    }`}
                  >
                    <div className="flex flex-col items-start">
                      <span
                        className={`font-mono text-xs italic ${
                          isSelected ? 'text-primary' : 'text-secondary'
                        }`}
                      >
                        {cls.stereotype}
                      </span>
                      <span
                        className={`text-base font-semibold leading-tight ${
                          isSelected ? 'text-primary-fixed' : 'text-on-surface'
                        }`}
                      >
                        {cls.name}
                      </span>
                    </div>
                    {isSelected && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-primary text-on-primary shadow-sm">
                        Seleccionada
                      </span>
                    )}
                  </div>

                  {/* Attributes Compartment */}
                  <div className="px-4 py-2 bg-surface-container space-y-1">
                    {cls.attributes.map((attr) => {
                      const isEditingThis = isSelected && editingAttrId === attr.id;
                      return (
                        <div
                          key={attr.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedClassId(cls.id);
                            setEditingAttrId(attr.id);
                          }}
                          className={`flex items-center justify-between font-mono text-xs p-1 rounded transition-colors cursor-pointer ${
                            isEditingThis
                              ? 'bg-secondary-container/40 text-on-surface ring-1 ring-secondary/50'
                              : 'hover:bg-surface-container-high text-on-surface'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`font-bold ${
                                attr.visibility === '-'
                                  ? 'text-error'
                                  : attr.visibility === '+'
                                  ? 'text-tertiary'
                                  : 'text-secondary'
                              }`}
                            >
                              {attr.visibility}
                            </span>
                            <span className={isEditingThis ? 'font-semibold' : ''}>
                              {attr.name}:
                            </span>
                            <span className="text-primary-fixed-dim">{attr.type}</span>
                          </div>
                          {attr.isPk && (
                            <span className="font-mono text-outline text-[10px] uppercase font-bold">
                              PK
                            </span>
                          )}
                          {isEditingThis && !attr.isPk && (
                            <span className="font-mono text-tertiary text-[10px]">Activo</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Separator Bar */}
                  <div className={`h-0.5 ${isSelected ? 'bg-primary/40' : 'bg-surface-variant'}`} />

                  {/* Methods Compartment */}
                  <div className="px-4 py-2 bg-surface-container-low rounded-b-xl space-y-1">
                    {cls.methods.map((method) => (
                      <div key={method.id} className="flex items-center gap-1.5 font-mono text-xs p-0.5">
                        <span className="text-tertiary font-bold">{method.visibility}</span>
                        <span className="text-on-surface">{method.name}():</span>
                        <span className="text-outline">{method.returnType}</span>
                      </div>
                    ))}
                  </div>

                  {/* REAL-TIME COLLABORATOR CURSOR: ANA LÓPEZ (ATTACHED TO PRODUCTO) */}
                  {cls.id === 'producto' && (
                    <div className="absolute -right-8 -top-7 pointer-events-none z-30 flex items-center gap-1 animate-bounce">
                      <span className="material-symbols-outlined text-tertiary text-[22px] drop-shadow-md">
                        near_me
                      </span>
                      <div className="px-2.5 py-0.5 rounded-full bg-tertiary text-on-tertiary-container text-[11px] font-semibold shadow-lg whitespace-nowrap">
                        Ana López (editando)
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 3.4 CANVAS MINIMAP (BOTTOM-LEFT) */}
          <div className="absolute left-4 bottom-4 w-44 h-32 rounded-xl bg-surface-container-lowest/90 backdrop-blur-md p-2 shadow-xl flex flex-col justify-between border border-outline-variant/30">
            <div className="flex items-center justify-between px-1">
              <span className="font-mono text-xs text-outline">Minimapa</span>
              <span className="font-mono text-xs text-tertiary font-medium">{zoomLevel}%</span>
            </div>
            {/* Mini View Representation */}
            <div className="relative w-full flex-1 bg-surface-container-low rounded overflow-hidden mt-1 border border-outline-variant/20">
              {/* Mini nodes preview */}
              <div className="absolute left-3 top-2 w-6 h-5 bg-surface-variant rounded-xs" />
              <div className="absolute left-20 top-2 w-7 h-5 bg-surface-variant rounded-xs" />
              <div className="absolute left-10 top-14 w-8 h-6 bg-primary rounded-xs ring-1 ring-primary-fixed" />
              {/* Viewport Window Outline */}
              <div className="absolute inset-0 bg-primary/10 rounded pointer-events-none border border-primary/30" />
            </div>
          </div>
        </div>

        {/* 4. RIGHT PROPERTIES PANEL (UML CLASS INSPECTOR) */}
        <div className="w-96 h-full bg-surface-container-low flex flex-col shadow-2xl z-20 overflow-y-auto border-l border-outline-variant/30">
          {/* Inspector Header */}
          <div className="p-4 bg-surface-container flex items-center justify-between border-b border-outline-variant/20">
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-outline">
                Inspector de Clase
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-base font-semibold text-on-surface">
                  {selectedClass.name}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-surface-container-high text-primary font-mono text-[11px]">
                  {selectedClass.isConcrete ? 'Concrete' : 'Abstract'}
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                const newName = prompt('Cambiar nombre de clase:', selectedClass.name);
                if (newName) {
                  setClasses((prev) =>
                    prev.map((c) => (c.id === selectedClass.id ? { ...c, name: newName } : c))
                  );
                }
              }}
              className="p-1 text-on-surface-variant hover:text-on-surface rounded hover:bg-surface-bright transition-colors"
              title="Opciones de clase"
            >
              <span className="material-symbols-outlined text-[18px]">more_vert</span>
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex px-4 bg-surface-container-low border-b border-outline-variant/20">
            <button
              onClick={() => setInspectorTab('general')}
              className={`py-2 px-3 text-xs font-medium transition-colors ${
                inspectorTab === 'general'
                  ? 'text-primary font-semibold border-b-2 border-primary'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              General
            </button>
            <button
              onClick={() => setInspectorTab('atributos')}
              className={`py-2 px-3 text-xs font-medium transition-colors relative ${
                inspectorTab === 'atributos'
                  ? 'text-primary font-semibold border-b-2 border-primary'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Atributos ({selectedClass.attributes.length})
            </button>
            <button
              onClick={() => setInspectorTab('metodos')}
              className={`py-2 px-3 text-xs font-medium transition-colors ${
                inspectorTab === 'metodos'
                  ? 'text-primary font-semibold border-b-2 border-primary'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Métodos ({selectedClass.methods.length})
            </button>
          </div>

          {/* Inspector Body */}
          <div className="p-4 flex-1 space-y-4">
            {/* GENERAL TAB */}
            {inspectorTab === 'general' && (
              <div className="space-y-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-outline">Nombre de Entidad</label>
                  <input
                    type="text"
                    value={selectedClass.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      setClasses((prev) =>
                        prev.map((c) => (c.id === selectedClass.id ? { ...c, name: val } : c))
                      );
                    }}
                    className="w-full bg-surface-container-lowest text-on-surface text-xs p-2 rounded outline-none border border-outline-variant/30 focus:border-primary"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-outline">Estereotipo</label>
                  <input
                    type="text"
                    value={selectedClass.stereotype}
                    onChange={(e) => {
                      const val = e.target.value;
                      setClasses((prev) =>
                        prev.map((c) => (c.id === selectedClass.id ? { ...c, stereotype: val } : c))
                      );
                    }}
                    className="w-full bg-surface-container-lowest text-primary text-xs p-2 rounded outline-none border border-outline-variant/30"
                  />
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="concreteCheck"
                    checked={selectedClass.isConcrete}
                    onChange={(e) => {
                      const chk = e.target.checked;
                      setClasses((prev) =>
                        prev.map((c) => (c.id === selectedClass.id ? { ...c, isConcrete: chk } : c))
                      );
                    }}
                    className="accent-primary"
                  />
                  <label htmlFor="concreteCheck" className="text-xs text-on-surface cursor-pointer">
                    Clase Concreta (genera tabla en DB)
                  </label>
                </div>
              </div>
            )}

            {/* ATRIBUTOS TAB */}
            {inspectorTab === 'atributos' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-on-surface">Campos / Atributos</span>
                  <button
                    onClick={handleAddAttribute}
                    className="flex items-center gap-1 text-xs text-primary hover:text-primary-fixed font-medium"
                  >
                    <span className="material-symbols-outlined text-[15px]">add</span>
                    <span>Agregar Atributo</span>
                  </button>
                </div>

                {/* Attributes List */}
                <div className="space-y-2">
                  {selectedClass.attributes.map((attr) => {
                    const isEditing = editingAttrId === attr.id;

                    if (isEditing) {
                      return (
                        <div
                          key={attr.id}
                          className="p-3 rounded-lg bg-surface-container-high shadow-md space-y-3 border border-primary/30"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="material-symbols-outlined text-[16px] text-primary">
                                edit_note
                              </span>
                              <span className="text-xs font-medium text-primary">
                                Editando: {attr.name}
                              </span>
                            </div>
                            <button
                              onClick={() => setEditingAttrId('')}
                              className="text-outline hover:text-on-surface"
                            >
                              <span className="material-symbols-outlined text-[16px]">close</span>
                            </button>
                          </div>

                          {/* Form Grid */}
                          <div className="grid grid-cols-3 gap-2">
                            <div className="col-span-1">
                              <label className="text-[11px] text-outline block mb-1">Visibilidad</label>
                              <select
                                value={attr.visibility}
                                onChange={(e) =>
                                  handleUpdateAttribute(selectedClass.id, attr.id, {
                                    visibility: e.target.value as any,
                                  })
                                }
                                className="w-full bg-surface-container-lowest text-on-surface font-mono text-xs p-1.5 rounded outline-none border border-outline-variant/30"
                              >
                                <option value="-">- (Private)</option>
                                <option value="+">+ (Public)</option>
                                <option value="#"># (Protected)</option>
                                <option value="~">~ (Package)</option>
                              </select>
                            </div>
                            <div className="col-span-2">
                              <label className="text-[11px] text-outline block mb-1">Nombre</label>
                              <input
                                type="text"
                                value={attr.name}
                                onChange={(e) =>
                                  handleUpdateAttribute(selectedClass.id, attr.id, {
                                    name: e.target.value,
                                  })
                                }
                                className="w-full bg-surface-container-lowest text-on-surface font-mono text-xs p-1.5 rounded outline-none border border-outline-variant/30"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-[11px] text-outline block mb-1">
                              Tipo de Dato (Java/ORM)
                            </label>
                            <input
                              type="text"
                              value={attr.type}
                              onChange={(e) =>
                                handleUpdateAttribute(selectedClass.id, attr.id, {
                                  type: e.target.value,
                                })
                              }
                              className="w-full bg-surface-container-lowest text-primary font-mono text-xs p-1.5 rounded outline-none border border-outline-variant/30"
                            />
                          </div>

                          <div className="flex items-center gap-3 pt-1">
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={attr.isNullable ?? false}
                                onChange={(e) =>
                                  handleUpdateAttribute(selectedClass.id, attr.id, {
                                    isNullable: e.target.checked,
                                  })
                                }
                                className="accent-primary rounded"
                              />
                              <span className="text-[11px] text-on-surface">Nullable</span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={attr.isStatic ?? false}
                                onChange={(e) =>
                                  handleUpdateAttribute(selectedClass.id, attr.id, {
                                    isStatic: e.target.checked,
                                  })
                                }
                                className="accent-primary rounded"
                              />
                              <span className="text-[11px] text-on-surface">Estático</span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={attr.isFinal ?? false}
                                onChange={(e) =>
                                  handleUpdateAttribute(selectedClass.id, attr.id, {
                                    isFinal: e.target.checked,
                                  })
                                }
                                className="accent-primary rounded"
                              />
                              <span className="text-[11px] text-on-surface">Final</span>
                            </label>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={attr.id}
                        className="p-2.5 rounded-lg bg-surface-container flex items-center justify-between shadow-sm border border-outline-variant/10 hover:border-outline-variant/30 transition-all"
                      >
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[16px] text-outline cursor-grab">
                            drag_indicator
                          </span>
                          <span className="w-5 h-5 flex items-center justify-center rounded bg-error/20 text-error font-bold font-mono text-xs">
                            {attr.visibility}
                          </span>
                          <div className="flex flex-col">
                            <span className="font-mono text-xs text-on-surface font-semibold">
                              {attr.name}
                            </span>
                            <span className="font-mono text-[11px] text-primary">{attr.type}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-on-surface-variant">
                          <button
                            onClick={() => setEditingAttrId(attr.id)}
                            className="p-1 hover:text-on-surface rounded hover:bg-surface-bright"
                            title="Editar atributo"
                          >
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                          </button>
                          <button
                            onClick={() => handleDeleteAttribute(attr.id)}
                            className="p-1 hover:text-error rounded hover:bg-surface-bright"
                            title="Eliminar atributo"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* METODOS TAB */}
            {inspectorTab === 'metodos' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-on-surface">
                    Métodos / Operaciones
                  </span>
                  <button
                    onClick={handleAddMethod}
                    className="flex items-center gap-1 text-xs text-primary hover:text-primary-fixed font-medium"
                  >
                    <span className="material-symbols-outlined text-[15px]">add</span>
                    <span>Agregar Método</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {selectedClass.methods.map((method) => (
                    <div
                      key={method.id}
                      className="p-2.5 rounded-lg bg-surface-container flex items-center justify-between shadow-sm border border-outline-variant/10"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 flex items-center justify-center rounded bg-tertiary/20 text-tertiary font-bold font-mono text-xs">
                          {method.visibility}
                        </span>
                        <div className="flex flex-col">
                          <span className="font-mono text-xs text-on-surface font-semibold">
                            {method.name}(...)
                          </span>
                          <span className="font-mono text-[11px] text-outline">
                            retorno: {method.returnType}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-on-surface-variant">
                        <button
                          onClick={() => {
                            const newName = prompt('Nombre del método:', method.name);
                            if (newName) {
                              setClasses((prev) =>
                                prev.map((c) =>
                                  c.id === selectedClass.id
                                    ? {
                                        ...c,
                                        methods: c.methods.map((m) =>
                                          m.id === method.id ? { ...m, name: newName } : m
                                        ),
                                      }
                                    : c
                                )
                              );
                            }
                          }}
                          className="p-1 hover:text-on-surface rounded hover:bg-surface-bright"
                        >
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                        </button>
                        <button
                          onClick={() => {
                            setClasses((prev) =>
                              prev.map((c) =>
                                c.id === selectedClass.id
                                  ? {
                                      ...c,
                                      methods: c.methods.filter((m) => m.id !== method.id),
                                    }
                                  : c
                              )
                            );
                          }}
                          className="p-1 hover:text-error rounded hover:bg-surface-bright"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 5. FLOATING AI ASSISTANT & VOICE PROMPT DRAWER */}
        <div className="absolute right-[25rem] bottom-4 w-[26rem] bg-surface-container-low/95 backdrop-blur-xl rounded-xl shadow-2xl z-30 overflow-hidden flex flex-col border border-outline-variant/30">
          {/* Header */}
          <div className="px-4 py-2 bg-surface-container flex items-center justify-between border-b border-outline-variant/20">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[18px]">neurology</span>
              <span className="text-xs font-semibold text-on-surface">ClassFlow AI Assistant</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-tertiary animate-ping"></span>
              <span className="font-mono text-[11px] text-tertiary">Copilot Online</span>
              <button
                onClick={() => setIsAiCollapsed(!isAiCollapsed)}
                className="p-1 text-on-surface-variant hover:text-on-surface ml-1 focus:outline-none"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {isAiCollapsed ? 'expand_less' : 'expand_more'}
                </span>
              </button>
            </div>
          </div>

          {!isAiCollapsed && (
            <>
              {/* Chat Stream */}
              <div className="p-3 max-h-56 overflow-y-auto space-y-2 text-xs">
                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start gap-2'}`}
                  >
                    {msg.sender === 'ai' && (
                      <span className="material-symbols-outlined text-primary text-[16px] mt-1">
                        smart_toy
                      </span>
                    )}
                    <div
                      className={`px-3 py-1.5 rounded-lg text-xs max-w-[85%] shadow-sm ${
                        msg.sender === 'user'
                          ? 'bg-surface-container-high rounded-tr-none text-on-surface'
                          : 'bg-surface-container-lowest rounded-tl-none text-on-surface border border-outline-variant/20'
                      }`}
                    >
                      {msg.highlight && (
                        <span className="text-tertiary font-semibold mr-1">{msg.highlight}</span>
                      )}
                      {msg.text}
                    </div>
                  </div>
                ))}

                {/* VOICE INPUT ACTIVE STATE SIMULATION */}
                {isListening && (
                  <div className="bg-secondary-container/40 p-2.5 rounded-lg space-y-1.5 border border-secondary/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-secondary">
                        <span className="material-symbols-outlined text-[16px] animate-pulse">mic</span>
                        <span className="text-[11px] font-semibold tracking-wide">
                          COMANDO DE VOZ: ESCUCHANDO...
                        </span>
                      </div>
                      {/* Waveform */}
                      <div className="flex items-center gap-1 h-3">
                        <div className="w-1 bg-secondary rounded-full h-3 animate-pulse"></div>
                        <div
                          className="w-1 bg-secondary rounded-full h-1 animate-pulse"
                          style={{ animationDelay: '75ms' }}
                        ></div>
                        <div
                          className="w-1 bg-secondary rounded-full h-2.5 animate-pulse"
                          style={{ animationDelay: '150ms' }}
                        ></div>
                        <div
                          className="w-1 bg-secondary rounded-full h-3 animate-pulse"
                          style={{ animationDelay: '300ms' }}
                        ></div>
                      </div>
                    </div>
                    <p className="font-mono text-[11px] text-on-surface italic">
                      "Agrega un atributo correo de tipo String a la clase Cliente"
                    </p>
                  </div>
                )}
              </div>

              {/* Chat Input Field */}
              <div className="p-2 bg-surface-container flex items-center gap-2 border-t border-outline-variant/20">
                <button
                  onClick={() => setIsListening(!isListening)}
                  className={`p-2 rounded-lg transition-colors flex items-center justify-center shadow-md ${
                    isListening
                      ? 'bg-secondary text-on-secondary ring-2 ring-secondary/50'
                      : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                  }`}
                  title="Activar/Desactivar micrófono para comandos de voz"
                >
                  <span className="material-symbols-outlined text-[18px]">mic</span>
                </button>
                <input
                  type="text"
                  value={aiInputText}
                  onChange={(e) => setAiInputText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAiSend()}
                  placeholder="Instruye al asistente para modelar o refactorizar..."
                  className="flex-1 bg-surface-container-lowest text-on-surface placeholder-outline text-xs px-3 py-1.5 rounded-lg outline-none border border-outline-variant/20 focus:border-primary"
                />
                <button
                  onClick={handleAiSend}
                  className="p-2 rounded-lg bg-primary text-on-primary hover:bg-primary-container transition-colors shadow-sm flex items-center justify-center"
                >
                  <span className="material-symbols-outlined text-[18px]">send</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* COLLABORATION POPUP TOAST (CORNER OVERLAY) */}
        {showCollabToast && (
          <div className="absolute left-20 bottom-4 z-30 flex items-center gap-3 bg-surface-container-high/95 backdrop-blur-md px-4 py-2.5 rounded-xl shadow-2xl border border-outline-variant/30">
            <div className="relative">
              <img
                className="w-7 h-7 rounded-full object-cover"
                src={ASSETS.anaLopezAlt}
                alt="Ana López"
              />
              <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-tertiary ring-1 ring-surface-container-high"></span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-on-surface">Ana López</span>
              <span className="text-[11px] text-on-surface-variant">
                Se ha conectado a la sesión colaborativa
              </span>
            </div>
            <button
              onClick={() => setShowCollabToast(false)}
              className="text-outline hover:text-on-surface ml-2 focus:outline-none"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        )}
      </div>

      {/* SHARE MODAL */}
      {shareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface-container-low rounded-xl p-6 max-w-md w-full shadow-2xl border border-outline-variant/30 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">share</span>
                <h3 className="text-base font-bold text-on-surface">Compartir Espacio de Trabajo</h3>
              </div>
              <button
                onClick={() => setShareModalOpen(false)}
                className="text-outline hover:text-on-surface"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <p className="text-xs text-on-surface-variant">
              Invita a otros arquitectos y desarrolladores a colaborar en tiempo real sobre el diagrama
              UML y la generación de backend.
            </p>
            <div className="flex items-center gap-2 p-2 rounded bg-surface-container font-mono text-xs text-on-surface border border-outline-variant/20">
              <span className="truncate flex-1">
                https://classflow.ai/ws/microservices-core-v2?token=7f90e12
              </span>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(
                    'https://classflow.ai/ws/microservices-core-v2?token=7f90e12'
                  );
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2000);
                }}
                className="px-2.5 py-1 rounded bg-primary text-on-primary font-sans font-semibold text-xs flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[14px]">
                  {copiedLink ? 'check' : 'content_copy'}
                </span>
                <span>{copiedLink ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
