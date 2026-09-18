import React, { useState, useEffect, useCallback } from 'react';
import {
  AppScreen,
  CanonicalUMLRelationType,
  toCanonicalRelationType,
  UMLAttribute,
  UMLClassNode,
  UMLMethod,
  UMLRelation,
  UserProfile,
} from '../types';
import { ASSETS } from '../data/mockData';
import { diagramaService, DiagramaApiItem, ClaseApiItem, RelacionApiItem } from '../services/diagramaService';
import { proyectoService } from '../services/proyectoService';
import {
  collaborationService,
  ConnectionStatus,
  ActiveParticipant,
  RemoteCursor,
} from '../services/collaborationService';

interface EditorScreenProps {
  onNavigate: (screen: AppScreen) => void;
  currentUser: UserProfile;
  projectId?: number | null;
}

// Visibilities conversion helpers
const toVisChar = (vis: string): '-' | '+' | '#' | '~' => {
  switch (vis) {
    case 'public':
      return '+';
    case 'private':
      return '-';
    case 'protected':
      return '#';
    case 'package':
      return '~';
    default:
      return '+';
  }
};

const toVisWord = (char: '-' | '+' | '#' | '~'): string => {
  switch (char) {
    case '+':
      return 'public';
    case '-':
      return 'private';
    case '#':
      return 'protected';
    case '~':
      return 'package';
    default:
      return 'public';
  }
};

export const EditorScreen: React.FC<EditorScreenProps> = ({
  onNavigate,
  currentUser: _currentUser,
  projectId: propProjectId,
}) => {
  // Diagram & Project Data
  const [diagrama, setDiagrama] = useState<DiagramaApiItem | null>(null);
  const [projectName, setProjectName] = useState<string>('Proyecto');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'guardado' | 'guardando' | 'error'>('guardado');

  // UML nodes and relations state
  const [classes, setClasses] = useState<UMLClassNode[]>([]);
  const [relations, setRelations] = useState<UMLRelation[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<'general' | 'atributos' | 'metodos'>('atributos');

  // Selected attribute / method for editing in Inspector
  const [editingAttrId, setEditingAttrId] = useState<string>('');
  const [editingMethodId, setEditingMethodId] = useState<string>('');
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  // Dragging state for nodes on canvas
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Modal to create Relation
  const [isRelationModalOpen, setIsRelationModalOpen] = useState<boolean>(false);
  const [relType, setRelType] = useState<CanonicalUMLRelationType>('asociacion');
  const [relTargetId, setRelTargetId] = useState<string>('');
  const [relSourceMult, setRelSourceMult] = useState<string>('1');
  const [relTargetMult, setRelTargetMult] = useState<string>('0..*');
  const [relName, setRelName] = useState<string>('');

  // AI Assistant Chat & Voice mock state (preserved for visual fidelity and future Phase 6)
  const [isAiCollapsed, setIsAiCollapsed] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
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

  // Toast collaborator state & real-time presence
  const [showCollabToast, setShowCollabToast] = useState<boolean>(false);
  const [collabToastMessage, setCollabToastMessage] = useState<{
    text: string;
    subtext: string;
    name: string;
    isJoin: boolean;
  } | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Real-time WebSocket collaboration state (CU04)
  const [wsStatus, setWsStatus] = useState<ConnectionStatus>('disconnected');
  const [activeParticipants, setActiveParticipants] = useState<ActiveParticipant[]>([]);
  const [sessionCode, setSessionCode] = useState<string>('');
  const [remoteCursors, setRemoteCursors] = useState<Record<number, RemoteCursor>>({});

  // Determine permissions
  const canEdit = Boolean(diagrama?.permiso_edicion);

  // Convert backend API class item to frontend UMLClassNode
  const mapApiClassToNode = (c: ClaseApiItem): UMLClassNode => ({
    id: c.id_clase.toString(),
    name: c.nombre,
    stereotype: c.estereotipo || '«entity»',
    x: Number(c.posicion_x) || 100,
    y: Number(c.posicion_y) || 100,
    width: Number(c.ancho) || 260,
    isConcrete: !c.es_abstracta,
    attributes: (c.atributos || []).map((a) => ({
      id: a.id_atributo.toString(),
      visibility: toVisChar(a.visibilidad),
      name: a.nombre,
      type: a.tipo_dato,
      isPk: a.nombre.toLowerCase() === 'id' || a.orden === 0,
      isNullable: a.es_nullable,
      isStatic: a.es_estatico,
      isFinal: a.es_final,
    })),
    methods: (c.metodos || []).map((m) => ({
      id: m.id_metodo.toString(),
      visibility: toVisChar(m.visibilidad),
      name: m.nombre,
      returnType: m.tipo_retorno || 'void',
      params: (m.parametros || []).map((p) => `${p.nombre}: ${p.tipo_dato}`).join(', '),
      isStatic: m.es_estatico,
      isAbstract: m.es_abstracto,
      order: m.orden,
      parametersList: (m.parametros || []).map((p) => ({
        id: p.id_parametro.toString(),
        name: p.nombre,
        type: p.tipo_dato,
        defaultValue: p.valor_defecto || undefined,
        order: p.orden,
      })),
    })),
  });

  // Convert backend API relation item to frontend UMLRelation
  const mapApiRelToUml = (r: RelacionApiItem): UMLRelation => ({
    id: r.id_relacion.toString(),
    sourceId: r.id_clase_origen.toString(),
    targetId: r.id_clase_destino.toString(),
    type: toCanonicalRelationType(r.tipo),
    sourceMultiplicity: r.multiplicidad_origen || '1',
    targetMultiplicity: r.multiplicidad_destino || '1',
    roleName: r.nombre || r.rol_destino || '',
  });

  // Load Diagram from API
  const loadDiagramData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      let activeId = propProjectId;
      if (!activeId) {
        const stored = localStorage.getItem('classflow_active_project_id');
        if (stored) {
          activeId = parseInt(stored, 10);
        }
      }

      // If still no project ID, fetch the user's projects to select the first one
      if (!activeId) {
        const userProjects = await proyectoService.getProyectos('all');
        if (userProjects.length > 0) {
          activeId = userProjects[0].id_proyecto;
          localStorage.setItem('classflow_active_project_id', activeId.toString());
        } else {
          setErrorMessage('No tienes ningún proyecto creado. Crea uno primero en la sección de Proyectos.');
          setIsLoading(false);
          return;
        }
      }

      // Fetch project details for title
      try {
        const proj = await proyectoService.getProyecto(activeId);
        setProjectName(proj.nombre);
      } catch {
        // Fallback
        setProjectName(`Proyecto #${activeId}`);
      }

      // Fetch Diagram
      const diagData = await diagramaService.getDiagramaProyecto(activeId);
      setDiagrama(diagData);

      const mappedNodes = (diagData.clases || []).map(mapApiClassToNode);
      const mappedRels = (diagData.relaciones || []).map(mapApiRelToUml);

      setClasses(mappedNodes);
      setRelations(mappedRels);

      if (mappedNodes.length > 0) {
        setSelectedClassId(mappedNodes[0].id);
        if (mappedNodes[0].attributes.length > 0) {
          setEditingAttrId(mappedNodes[0].attributes[0].id);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al cargar el diagrama UML');
    } finally {
      setIsLoading(false);
    }
  }, [propProjectId]);

  useEffect(() => {
    loadDiagramData();
  }, [loadDiagramData]);

  // =========================================================================
  // WEBSOCKET REAL-TIME COLLABORATION (CU04)
  // =========================================================================
  useEffect(() => {
    if (!diagrama?.id_diagrama) return;

    collaborationService.connect(diagrama.id_diagrama);

    const reloadDiagramFromRest = async () => {
      if (!diagrama?.id_diagrama) return;
      try {
        const fullDiagram = await diagramaService.getDiagrama(diagrama.id_diagrama);
        setDiagrama(fullDiagram);
        const mappedClasses = (fullDiagram.clases || []).map(mapApiClassToNode);
        const mappedRelations = (fullDiagram.relaciones || []).map(mapApiRelToUml);
        setClasses(mappedClasses);
        setRelations(mappedRelations);
      } catch (err) {
        console.error('[Collab] Error refrescando diagrama tras diagram.changed:', err);
      }
    };

    const unsubStatus = collaborationService.onStatusChange((newStatus) => {
      setWsStatus(newStatus);
      if (newStatus === 'connected') {
        reloadDiagramFromRest();
      }
    });

    const unsubInit = collaborationService.on('session.init', (e: any) => {
      if (e.active_participants) {
        setActiveParticipants(e.active_participants);
      }
      if (e.codigo_sesion || e.session_code) {
        setSessionCode(e.codigo_sesion || e.session_code);
      }
      if (e.user && typeof e.user.permiso_edicion === 'boolean') {
        setDiagrama((prev) => (prev ? { ...prev, permiso_edicion: e.user.permiso_edicion } : prev));
      }
    });

    const unsubJoin = collaborationService.on('presence.join', (e: any) => {
      if (e.user) {
        setActiveParticipants((prev) => {
          if (prev.some((p) => p.id_usuario === e.user.id_usuario)) {
            return prev;
          }
          return [...prev, e.user];
        });
        setCollabToastMessage({
          name: e.user.nombre,
          text: 'Colaborador Conectado',
          subtext: `${e.user.nombre} se ha unido a la sesión`,
          isJoin: true,
        });
        setShowCollabToast(true);
        setTimeout(() => setShowCollabToast(false), 3500);
      }
    });

    const unsubLeave = collaborationService.on('presence.leave', (e: any) => {
      if (e.user_id) {
        setActiveParticipants((prev) => {
          const departing = prev.find((p) => p.id_usuario === e.user_id);
          if (departing) {
            setCollabToastMessage({
              name: departing.nombre,
              text: 'Colaborador Desconectado',
              subtext: `${departing.nombre} ha salido de la sesión`,
              isJoin: false,
            });
            setShowCollabToast(true);
            setTimeout(() => setShowCollabToast(false), 3500);
          }
          return prev.filter((p) => p.id_usuario !== e.user_id);
        });
      }
    });

    // CU04: Escuchar diagram.changed para recargar automáticamente desde REST
    const unsubDiagramChanged = collaborationService.on('diagram.changed', (e: any) => {
      if (e.diagram_id === diagrama.id_diagrama) {
        reloadDiagramFromRest();
      }
    });

    return () => {
      unsubStatus();
      unsubInit();
      unsubJoin();
      unsubLeave();
      unsubDiagramChanged();
      collaborationService.disconnect();
    };
  }, [diagrama?.id_diagrama]);

  // Selected class helper
  const selectedClass = classes.find((c) => c.id === selectedClassId) || classes[0];

  // Drag handlers with backend persistence on mouse up
  const handleMouseDown = (nodeId: string, e: React.MouseEvent) => {
    setSelectedClassId(nodeId);
    if (!canEdit) return; // Block dragging in read-only mode

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
    if (!draggingNodeId || !canEdit) return;
    const newX = Math.max(20, Math.min(2400, e.clientX - dragOffset.x));
    const newY = Math.max(20, Math.min(1800, e.clientY - dragOffset.y));

    setClasses((prev) =>
      prev.map((cls) => (cls.id === draggingNodeId ? { ...cls, x: newX, y: newY } : cls))
    );
  };

  const handleMouseUp = async () => {
    if (!draggingNodeId || !diagrama || !canEdit) {
      setDraggingNodeId(null);
      return;
    }

    const currentId = draggingNodeId;
    setDraggingNodeId(null);
    const node = classes.find((c) => c.id === currentId);
    if (!node) return;

    try {
      setSaveStatus('guardando');
      await diagramaService.updateClasePosicion(
        diagrama.id_diagrama,
        parseInt(node.id, 10),
        node.x,
        node.y
      );
      setSaveStatus('guardado');
    } catch (err) {
      console.error('Error al persistir posición:', err);
      setSaveStatus('error');
    }
  };

  // =========================================================================
  // CLASE OPERATIONS (CRUD)
  // =========================================================================
  const handleCreateNewClass = async () => {
    if (!diagrama || !canEdit) return;
    const nextCount = classes.length + 1;
    const proposedName = prompt('Nombre de la nueva clase UML:', `Entidad${nextCount}`);
    if (!proposedName || !proposedName.trim()) return;

    try {
      setSaveStatus('guardando');
      const newPos = {
        x: 180 + (nextCount % 5) * 60,
        y: 150 + (nextCount % 5) * 40,
      };
      const created = await diagramaService.createClase(diagrama.id_diagrama, {
        nombre: proposedName.trim(),
        estereotipo: '«entity»',
        visibilidad: 'public',
        es_abstracta: false,
        posicion_x: newPos.x,
        posicion_y: newPos.y,
        ancho: 260,
        alto: 160,
      });

      // Default attributes: id
      await diagramaService.createAtributo(created.id_clase, {
        nombre: 'id',
        tipo_dato: 'Long',
        visibilidad: 'private',
        es_nullable: false,
        orden: 0,
      });

      // Reload diagram to get synchronized state
      await loadDiagramData();
      setSelectedClassId(created.id_clase.toString());
      setSaveStatus('guardado');
    } catch (err: any) {
      alert(`Error al crear clase: ${err.message}`);
      setSaveStatus('error');
    }
  };

  const handleDeleteSelectedClass = async () => {
    if (!diagrama || !canEdit || !selectedClass) return;
    const ok = confirm(`¿Estás seguro de eliminar la clase '${selectedClass.name}' y todas sus relaciones asociadas?`);
    if (!ok) return;

    try {
      setSaveStatus('guardando');
      await diagramaService.deleteClase(diagrama.id_diagrama, parseInt(selectedClass.id, 10));
      // Remove from local state
      const remainingClasses = classes.filter((c) => c.id !== selectedClass.id);
      setClasses(remainingClasses);
      setRelations((prev) =>
        prev.filter((r) => r.sourceId !== selectedClass.id && r.targetId !== selectedClass.id)
      );
      setSelectedClassId(remainingClasses.length > 0 ? remainingClasses[0].id : null);
      setSaveStatus('guardado');
    } catch (err: any) {
      alert(`Error al eliminar clase: ${err.message}`);
      setSaveStatus('error');
    }
  };

  const handleUpdateClassName = async (newName: string) => {
    if (!diagrama || !canEdit || !selectedClass) return;
    const clean = newName.trim();
    if (!clean) return;

    try {
      setSaveStatus('guardando');
      await diagramaService.updateClase(diagrama.id_diagrama, parseInt(selectedClass.id, 10), {
        nombre: clean,
      });
      setClasses((prev) =>
        prev.map((c) => (c.id === selectedClass.id ? { ...c, name: clean } : c))
      );
      setSaveStatus('guardado');
    } catch (err: any) {
      alert(`Error al renombrar clase: ${err.message}`);
      setSaveStatus('error');
    }
  };

  const handleUpdateClassStereotype = async (st: string) => {
    if (!diagrama || !canEdit || !selectedClass) return;
    try {
      setSaveStatus('guardando');
      await diagramaService.updateClase(diagrama.id_diagrama, parseInt(selectedClass.id, 10), {
        estereotipo: st.trim() || undefined,
      });
      setClasses((prev) =>
        prev.map((c) => (c.id === selectedClass.id ? { ...c, stereotype: st } : c))
      );
      setSaveStatus('guardado');
    } catch (err: any) {
      console.error(err);
      setSaveStatus('error');
    }
  };

  const handleToggleConcrete = async (isConcrete: boolean) => {
    if (!diagrama || !canEdit || !selectedClass) return;
    try {
      setSaveStatus('guardando');
      await diagramaService.updateClase(diagrama.id_diagrama, parseInt(selectedClass.id, 10), {
        es_abstracta: !isConcrete,
      });
      setClasses((prev) =>
        prev.map((c) => (c.id === selectedClass.id ? { ...c, isConcrete } : c))
      );
      setSaveStatus('guardado');
    } catch (err: any) {
      console.error(err);
      setSaveStatus('error');
    }
  };

  // =========================================================================
  // ATRIBUTOS OPERATIONS (CRUD)
  // =========================================================================
  const handleAddAttribute = async () => {
    if (!diagrama || !canEdit || !selectedClass) return;
    try {
      setSaveStatus('guardando');
      const nextCount = selectedClass.attributes.length + 1;
      const created = await diagramaService.createAtributo(parseInt(selectedClass.id, 10), {
        nombre: `campo${nextCount}`,
        tipo_dato: 'String',
        visibilidad: 'private',
        es_nullable: true,
        orden: nextCount,
      });

      const newAttr: UMLAttribute = {
        id: created.id_atributo.toString(),
        visibility: toVisChar(created.visibilidad),
        name: created.nombre,
        type: created.tipo_dato,
        isNullable: created.es_nullable,
        isStatic: created.es_estatico,
        isFinal: created.es_final,
      };

      setClasses((prev) =>
        prev.map((c) =>
          c.id === selectedClass.id ? { ...c, attributes: [...c.attributes, newAttr] } : c
        )
      );
      setEditingAttrId(newAttr.id);
      setSaveStatus('guardado');
    } catch (err: any) {
      alert(`Error al agregar atributo: ${err.message}`);
      setSaveStatus('error');
    }
  };

  const handleUpdateAttribute = async (
    attrId: string,
    updates: Partial<UMLAttribute>
  ) => {
    if (!diagrama || !canEdit || !selectedClass) return;

    // Local optimistic update
    setClasses((prev) =>
      prev.map((cls) => {
        if (cls.id !== selectedClass.id) return cls;
        return {
          ...cls,
          attributes: cls.attributes.map((attr) =>
            attr.id === attrId ? { ...attr, ...updates } : attr
          ),
        };
      })
    );

    // Debounce / send update to backend
    try {
      setSaveStatus('guardando');
      const payload: any = {};
      if (updates.name !== undefined) payload.nombre = updates.name;
      if (updates.type !== undefined) payload.tipo_dato = updates.type;
      if (updates.visibility !== undefined) payload.visibilidad = toVisWord(updates.visibility);
      if (updates.isNullable !== undefined) payload.es_nullable = updates.isNullable;
      if (updates.isStatic !== undefined) payload.es_estatico = updates.isStatic;
      if (updates.isFinal !== undefined) payload.es_final = updates.isFinal;

      await diagramaService.updateAtributo(parseInt(attrId, 10), payload);
      setSaveStatus('guardado');
    } catch (err: any) {
      console.error('Error al actualizar atributo:', err);
      setSaveStatus('error');
    }
  };

  const handleDeleteAttribute = async (attrId: string) => {
    if (!diagrama || !canEdit || !selectedClass) return;
    try {
      setSaveStatus('guardando');
      await diagramaService.deleteAtributo(parseInt(attrId, 10));
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
      setSaveStatus('guardado');
    } catch (err: any) {
      alert(`Error al eliminar atributo: ${err.message}`);
      setSaveStatus('error');
    }
  };

  // =========================================================================
  // MÉTODOS OPERATIONS (CRUD)
  // =========================================================================
  const handleAddMethod = async () => {
    if (!diagrama || !canEdit || !selectedClass) return;
    try {
      setSaveStatus('guardando');
      const nextCount = selectedClass.methods.length + 1;
      const created = await diagramaService.createMetodo(parseInt(selectedClass.id, 10), {
        nombre: `operacion${nextCount}`,
        tipo_retorno: 'void',
        visibilidad: 'public',
        es_estatico: false,
        es_abstracto: false,
        orden: nextCount,
      });

      const newMethod: UMLMethod = {
        id: created.id_metodo.toString(),
        visibility: toVisChar(created.visibilidad),
        name: created.nombre,
        returnType: created.tipo_retorno || 'void',
        params: '',
        isStatic: created.es_estatico,
        isAbstract: created.es_abstracto,
        order: created.orden,
        parametersList: [],
      };

      setClasses((prev) =>
        prev.map((cls) =>
          cls.id === selectedClass.id ? { ...cls, methods: [...cls.methods, newMethod] } : cls
        )
      );
      setEditingMethodId(newMethod.id);
      setSaveStatus('guardado');
    } catch (err: any) {
      alert(`Error al agregar método: ${err.message}`);
      setSaveStatus('error');
    }
  };

  const handleUpdateMethod = async (
    methodId: string,
    data: {
      name?: string;
      returnType?: string;
      visibility?: '-' | '+' | '#' | '~';
      isStatic?: boolean;
      isAbstract?: boolean;
      order?: number;
    }
  ) => {
    if (!diagrama || !canEdit || !selectedClass) return;
    try {
      setSaveStatus('guardando');
      const payload: any = {};
      if (data.name !== undefined) payload.nombre = data.name;
      if (data.returnType !== undefined) payload.tipo_retorno = data.returnType;
      if (data.visibility !== undefined) payload.visibilidad = toVisWord(data.visibility);
      if (data.isStatic !== undefined) payload.es_estatico = data.isStatic;
      if (data.isAbstract !== undefined) payload.es_abstracto = data.isAbstract;
      if (data.order !== undefined) payload.orden = data.order;

      await diagramaService.updateMetodo(parseInt(methodId, 10), payload);

      setClasses((prev) =>
        prev.map((cls) =>
          cls.id === selectedClass.id
            ? {
                ...cls,
                methods: cls.methods.map((m) =>
                  m.id === methodId
                    ? {
                        ...m,
                        ...(data.name !== undefined ? { name: data.name } : {}),
                        ...(data.returnType !== undefined ? { returnType: data.returnType } : {}),
                        ...(data.visibility !== undefined ? { visibility: data.visibility } : {}),
                        ...(data.isStatic !== undefined ? { isStatic: data.isStatic } : {}),
                        ...(data.isAbstract !== undefined ? { isAbstract: data.isAbstract } : {}),
                        ...(data.order !== undefined ? { order: data.order } : {}),
                      }
                    : m
                ),
              }
            : cls
        )
      );
      setSaveStatus('guardado');
    } catch (err: any) {
      alert(`Error al actualizar método: ${err.message}`);
      setSaveStatus('error');
    }
  };

  const handleAddParametro = async (methodId: string) => {
    if (!diagrama || !canEdit || !selectedClass) return;
    const targetMethod = selectedClass.methods.find((m) => m.id === methodId);
    const nextOrder = (targetMethod?.parametersList?.length || 0) + 1;
    const proposedName = prompt('Nombre del nuevo parámetro:', `p${nextOrder}`);
    if (!proposedName || !proposedName.trim()) return;

    try {
      setSaveStatus('guardando');
      const created = await diagramaService.createParametro(parseInt(methodId, 10), {
        nombre: proposedName.trim(),
        tipo_dato: 'String',
        orden: nextOrder,
      });

      const newParam = {
        id: created.id_parametro.toString(),
        name: created.nombre,
        type: created.tipo_dato,
        order: created.orden,
        defaultValue: created.valor_defecto || undefined,
      };

      setClasses((prev) =>
        prev.map((cls) =>
          cls.id === selectedClass.id
            ? {
                ...cls,
                methods: cls.methods.map((m) => {
                  if (m.id === methodId) {
                    const updatedParams = [...(m.parametersList || []), newParam];
                    const paramsStr = updatedParams.map((p) => `${p.name}: ${p.type}`).join(', ');
                    return {
                      ...m,
                      parametersList: updatedParams,
                      params: paramsStr,
                    };
                  }
                  return m;
                }),
              }
            : cls
        )
      );
      setSaveStatus('guardado');
    } catch (err: any) {
      alert(`Error al agregar parámetro: ${err.message}`);
      setSaveStatus('error');
    }
  };

  const handleUpdateParametro = async (
    methodId: string,
    paramId: string,
    data: { name?: string; type?: string }
  ) => {
    if (!diagrama || !canEdit || !selectedClass) return;
    try {
      setSaveStatus('guardando');
      const payload: any = {};
      if (data.name !== undefined) payload.nombre = data.name;
      if (data.type !== undefined) payload.tipo_dato = data.type;

      await diagramaService.updateParametro(parseInt(paramId, 10), payload);

      setClasses((prev) =>
        prev.map((cls) =>
          cls.id === selectedClass.id
            ? {
                ...cls,
                methods: cls.methods.map((m) => {
                  if (m.id === methodId) {
                    const updatedParams = (m.parametersList || []).map((p) =>
                      p.id === paramId
                        ? {
                            ...p,
                            ...(data.name !== undefined ? { name: data.name } : {}),
                            ...(data.type !== undefined ? { type: data.type } : {}),
                          }
                        : p
                    );
                    const paramsStr = updatedParams.map((p) => `${p.name}: ${p.type}`).join(', ');
                    return {
                      ...m,
                      parametersList: updatedParams,
                      params: paramsStr,
                    };
                  }
                  return m;
                }),
              }
            : cls
        )
      );
      setSaveStatus('guardado');
    } catch (err: any) {
      alert(`Error al actualizar parámetro: ${err.message}`);
      setSaveStatus('error');
    }
  };

  const handleDeleteParametro = async (methodId: string, paramId: string) => {
    if (!diagrama || !canEdit || !selectedClass) return;
    try {
      setSaveStatus('guardando');
      await diagramaService.deleteParametro(parseInt(paramId, 10));

      setClasses((prev) =>
        prev.map((cls) =>
          cls.id === selectedClass.id
            ? {
                ...cls,
                methods: cls.methods.map((m) => {
                  if (m.id === methodId) {
                    const updatedParams = (m.parametersList || []).filter((p) => p.id !== paramId);
                    const paramsStr = updatedParams.map((p) => `${p.name}: ${p.type}`).join(', ');
                    return {
                      ...m,
                      parametersList: updatedParams,
                      params: paramsStr,
                    };
                  }
                  return m;
                }),
              }
            : cls
        )
      );
      setSaveStatus('guardado');
    } catch (err: any) {
      alert(`Error al eliminar parámetro: ${err.message}`);
      setSaveStatus('error');
    }
  };

  const handleDeleteMethod = async (methodId: string) => {
    if (!diagrama || !canEdit || !selectedClass) return;
    try {
      setSaveStatus('guardando');
      await diagramaService.deleteMetodo(parseInt(methodId, 10));
      setClasses((prev) =>
        prev.map((cls) =>
          cls.id === selectedClass.id
            ? { ...cls, methods: cls.methods.filter((m) => m.id !== methodId) }
            : cls
        )
      );
      setSaveStatus('guardado');
    } catch (err: any) {
      alert(`Error al eliminar método: ${err.message}`);
      setSaveStatus('error');
    }
  };

  // =========================================================================
  // RELACIONES OPERATIONS (CRUD)
  // =========================================================================
  const handleOpenRelationModal = (type: CanonicalUMLRelationType | string) => {
    if (!canEdit) {
      alert('Modo solo lectura: No tienes permisos para crear relaciones.');
      return;
    }
    if (classes.length < 2) {
      alert('Debes tener al menos 2 clases para crear una relación UML.');
      return;
    }
    const otherClasses = classes.filter((c) => c.id !== selectedClassId);
    setRelType(toCanonicalRelationType(type));
    setRelTargetId(otherClasses.length > 0 ? otherClasses[0].id : '');
    setRelSourceMult('1');
    setRelTargetMult('0..*');
    setRelName('');
    setIsRelationModalOpen(true);
  };

  const handleCreateRelationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!diagrama || !canEdit || !selectedClassId || !relTargetId) return;

    try {
      setSaveStatus('guardando');
      const canonicalType = toCanonicalRelationType(relType);
      const created = await diagramaService.createRelacion(diagrama.id_diagrama, {
        id_clase_origen: parseInt(selectedClassId, 10),
        id_clase_destino: parseInt(relTargetId, 10),
        tipo: canonicalType,
        nombre: relName.trim() || undefined,
        multiplicidad_origen: relSourceMult.trim() || undefined,
        multiplicidad_destino: relTargetMult.trim() || undefined,
      });

      const newUmlRel = mapApiRelToUml(created);
      setRelations((prev) => [...prev, newUmlRel]);
      setIsRelationModalOpen(false);
      setSaveStatus('guardado');
    } catch (err: any) {
      alert(`Error al crear relación UML: ${err.message}`);
      setSaveStatus('error');
    }
  };

  const handleDeleteRelation = async (relId: string) => {
    if (!diagrama || !canEdit) return;
    const ok = confirm('¿Deseas eliminar esta relación UML?');
    if (!ok) return;

    try {
      setSaveStatus('guardando');
      await diagramaService.deleteRelacion(parseInt(relId, 10));
      setRelations((prev) => prev.filter((r) => r.id !== relId));
      setSaveStatus('guardado');
    } catch (err: any) {
      alert(`Error al eliminar relación: ${err.message}`);
      setSaveStatus('error');
    }
  };

  // Mock AI Assistant prompt submit
  const handleAiSend = () => {
    if (!aiInputText.trim()) return;
    const query = aiInputText.trim();
    setChatMessages((prev) => [...prev, { sender: 'user', text: query }]);
    setAiInputText('');

    setTimeout(() => {
      setChatMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: `Comando recibido: "${query}". La generación inteligente por IA se activará en la Fase 6 (CU05). Actualmente el modelo está persistido en PostgreSQL.`,
          highlight: 'Modo Persistente',
        },
      ]);
    }, 500);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-[calc(100vh-3.5rem)] bg-surface text-on-surface">
        <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium text-outline">Cargando modelo UML desde PostgreSQL...</p>
      </div>
    );
  }

  // Error state
  if (errorMessage && !diagrama) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-[calc(100vh-3.5rem)] bg-surface p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-error-container/40 flex items-center justify-center text-error mb-4">
          <span className="material-symbols-outlined text-3xl">error_outline</span>
        </div>
        <h2 className="text-lg font-bold text-on-surface mb-2">No se pudo abrir el diagrama</h2>
        <p className="text-sm text-outline max-w-md mb-6">{errorMessage}</p>
        <button
          onClick={() => onNavigate('proyectos')}
          className="px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:bg-primary-fixed-dim transition-colors"
        >
          Volver a Proyectos
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col w-full h-[calc(100vh-3.5rem)] select-none overflow-hidden relative"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* 1. TOP TOOLBAR HEADER */}
      <div className="w-full bg-surface-container-lowest px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-md z-30 border-b border-outline-variant/30">
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex items-center gap-1.5 truncate">
            <span className="text-base font-semibold text-on-surface truncate">
              {projectName}
            </span>
            <span className="text-outline-variant font-mono text-xs">/</span>
            <span className="text-sm text-primary font-medium truncate">
              {diagrama?.nombre || 'Diagrama Principal'}
            </span>
          </div>

          {/* Real-time Collaboration Status Badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-container-low shadow-sm border border-outline-variant/30">
            <span
              className={`material-symbols-outlined text-[15px] ${
                wsStatus === 'connected'
                  ? 'text-tertiary'
                  : wsStatus === 'connecting' || wsStatus === 'reconnecting'
                  ? 'text-primary animate-spin'
                  : 'text-error'
              }`}
            >
              {wsStatus === 'connected'
                ? 'sensors'
                : wsStatus === 'connecting' || wsStatus === 'reconnecting'
                ? 'sync'
                : 'sensors_off'}
            </span>
            <span
              className={`font-mono text-[11px] font-medium ${
                wsStatus === 'connected'
                  ? 'text-tertiary'
                  : wsStatus === 'connecting' || wsStatus === 'reconnecting'
                  ? 'text-primary'
                  : 'text-error'
              }`}
            >
              {wsStatus === 'connected'
                ? `En vivo • ${activeParticipants.length} online`
                : wsStatus === 'connecting'
                ? 'Conectando...'
                : wsStatus === 'reconnecting'
                ? 'Reconectando...'
                : 'Desconectado'}
            </span>
          </div>

          {/* Active Participants Avatars Stack in Toolbar */}
          {activeParticipants.length > 0 && (
            <div className="hidden md:flex items-center -space-x-2 overflow-hidden py-0.5">
              {activeParticipants.slice(0, 4).map((p) => (
                <div
                  key={p.id_usuario}
                  className="relative group/avatar cursor-pointer"
                  title={`${p.nombre} (${p.es_propietario ? 'Propietario' : p.permiso_edicion ? 'Editor' : 'Lector'})`}
                >
                  <div className="w-7 h-7 rounded-full ring-2 ring-surface bg-primary-container text-on-primary-container flex items-center justify-center text-[11px] font-bold uppercase shadow-sm">
                    {p.nombre.charAt(0)}
                  </div>
                  <span
                    className={`absolute bottom-0 right-0 w-2 h-2 rounded-full ring-1 ring-surface ${
                      p.permiso_edicion ? 'bg-tertiary' : 'bg-amber-400'
                    }`}
                  />
                </div>
              ))}
              {activeParticipants.length > 4 && (
                <div className="w-7 h-7 rounded-full ring-2 ring-surface bg-surface-container-high text-on-surface-variant flex items-center justify-center text-[10px] font-mono font-semibold">
                  +{activeParticipants.length - 4}
                </div>
              )}
            </div>
          )}

          {/* Sync Status Badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-container-low shadow-sm">
            <span
              className={`material-symbols-outlined text-[15px] ${
                saveStatus === 'guardado'
                  ? 'text-tertiary'
                  : saveStatus === 'guardando'
                  ? 'text-primary animate-spin'
                  : 'text-error'
              }`}
            >
              {saveStatus === 'guardado' ? 'check_circle' : saveStatus === 'guardando' ? 'sync' : 'error'}
            </span>
            <span
              className={`font-mono text-[11px] ${
                saveStatus === 'guardado'
                  ? 'text-tertiary'
                  : saveStatus === 'guardando'
                  ? 'text-primary'
                  : 'text-error'
              }`}
            >
              {saveStatus === 'guardado' ? 'Persistido' : saveStatus === 'guardando' ? 'Guardando...' : 'Error al guardar'}
            </span>
            <span className="font-mono text-[11px] text-outline">• PostgreSQL v18</span>
          </div>

          {/* Read-Only Badge */}
          {!canEdit && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-semibold">
              <span className="material-symbols-outlined text-[15px]">visibility</span>
              <span>Modo Solo Lectura</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('proyectos')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface text-xs font-medium transition-colors shadow-sm cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              <span className="hidden sm:inline">Proyectos</span>
            </button>

            <button
              onClick={() => setShareModalOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface text-xs font-medium transition-colors shadow-sm cursor-pointer"
              title="Información de colaboración"
            >
              <span className="material-symbols-outlined text-[16px]">group_add</span>
              <span className="hidden sm:inline">Compartir</span>
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

      {/* 2. MAIN MULTI-PANE VISUAL AREA */}
      <div className="relative flex-1 flex overflow-hidden bg-surface-container-lowest">
        {/* LEFT FLOATING UML TOOLBAR */}
        <div className="absolute left-4 top-4 z-20 flex flex-col items-center bg-surface-container-low/95 backdrop-blur-md rounded-xl p-1 shadow-xl space-y-1 border border-outline-variant/30">
          <button
            className="p-2 rounded-lg bg-primary text-on-primary shadow-sm flex items-center justify-center transition-all"
            title="Herramienta Seleccionar (V)"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_selector_tool</span>
          </button>
          <button
            onClick={handleCreateNewClass}
            disabled={!canEdit}
            className={`p-2 rounded-lg transition-colors flex items-center justify-center ${
              canEdit
                ? 'hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface cursor-pointer'
                : 'opacity-40 cursor-not-allowed text-outline'
            }`}
            title={canEdit ? 'Agregar Clase UML (C)' : 'Modo solo lectura'}
          >
            <span className="material-symbols-outlined text-[18px]">add_box</span>
          </button>
          <div className="w-5 h-px bg-surface-variant my-1"></div>

          {/* UML Relation Connectors */}
          <button
            onClick={() => handleOpenRelationModal('asociacion')}
            disabled={!canEdit}
            className={`p-2 rounded-lg transition-colors flex items-center justify-center ${
              canEdit
                ? 'hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface cursor-pointer'
                : 'opacity-40 cursor-not-allowed text-outline'
            }`}
            title={canEdit ? 'Asociación (---)' : 'Modo solo lectura'}
          >
            <span className="material-symbols-outlined text-[18px]">horizontal_rule</span>
          </button>
          <button
            onClick={() => handleOpenRelationModal('agregacion')}
            disabled={!canEdit}
            className={`p-2 rounded-lg transition-colors flex items-center justify-center ${
              canEdit
                ? 'hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface cursor-pointer'
                : 'opacity-40 cursor-not-allowed text-outline'
            }`}
            title={canEdit ? 'Agregación (◇---)' : 'Modo solo lectura'}
          >
            <span className="material-symbols-outlined text-[18px]">diamond</span>
          </button>
          <button
            onClick={() => handleOpenRelationModal('composicion')}
            disabled={!canEdit}
            className={`p-2 rounded-lg transition-colors flex items-center justify-center ${
              canEdit
                ? 'hover:bg-surface-container-high text-secondary hover:text-secondary cursor-pointer'
                : 'opacity-40 cursor-not-allowed text-outline'
            }`}
            title={canEdit ? 'Composición (◆---)' : 'Modo solo lectura'}
          >
            <span className="material-symbols-outlined text-[18px] text-secondary">diamond</span>
          </button>
          <button
            onClick={() => handleOpenRelationModal('herencia')}
            disabled={!canEdit}
            className={`p-2 rounded-lg transition-colors flex items-center justify-center ${
              canEdit
                ? 'hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface cursor-pointer'
                : 'opacity-40 cursor-not-allowed text-outline'
            }`}
            title={canEdit ? 'Herencia / Generalización (△---)' : 'Modo solo lectura'}
          >
            <span className="material-symbols-outlined text-[18px]">change_history</span>
          </button>
          <button
            onClick={() => handleOpenRelationModal('dependencia')}
            disabled={!canEdit}
            className={`p-2 rounded-lg transition-colors flex items-center justify-center ${
              canEdit
                ? 'hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface cursor-pointer'
                : 'opacity-40 cursor-not-allowed text-outline'
            }`}
            title={canEdit ? 'Dependencia (- - >)' : 'Modo solo lectura'}
          >
            <span className="material-symbols-outlined text-[18px]">trending_flat</span>
          </button>
          <button
            onClick={() => handleOpenRelationModal('realizacion')}
            disabled={!canEdit}
            className={`p-2 rounded-lg transition-colors flex items-center justify-center ${
              canEdit
                ? 'hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface cursor-pointer'
                : 'opacity-40 cursor-not-allowed text-outline'
            }`}
            title={canEdit ? 'Realización (- - △)' : 'Modo solo lectura'}
          >
            <span className="material-symbols-outlined text-[18px]">call_made</span>
          </button>
          <div className="w-5 h-px bg-surface-variant my-1"></div>

          <button
            onClick={handleDeleteSelectedClass}
            disabled={!canEdit || !selectedClassId}
            className={`p-2 rounded-lg transition-colors flex items-center justify-center ${
              canEdit && selectedClassId
                ? 'hover:bg-error-container text-error hover:text-on-error-container cursor-pointer'
                : 'opacity-40 cursor-not-allowed text-outline'
            }`}
            title={canEdit ? 'Eliminar Clase Seleccionada' : 'Modo solo lectura'}
          >
            <span className="material-symbols-outlined text-[18px]">delete</span>
          </button>
          <div className="w-5 h-px bg-surface-variant my-1"></div>

          {/* Zoom controls */}
          <button
            onClick={() => setZoomLevel((z) => Math.min(150, z + 10))}
            className="p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors flex items-center justify-center cursor-pointer"
            title="Acercar (+)"
          >
            <span className="material-symbols-outlined text-[18px]">zoom_in</span>
          </button>
          <button
            onClick={() => setZoomLevel((z) => Math.max(60, z - 10))}
            className="p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors flex items-center justify-center cursor-pointer"
            title="Alejar (-)"
          >
            <span className="material-symbols-outlined text-[18px]">zoom_out</span>
          </button>
          <button
            onClick={() => setZoomLevel(100)}
            className="p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors flex items-center justify-center cursor-pointer"
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

          {/* SVG DYNAMIC UML CONNECTORS LAYER */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none z-0"
            style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top left' }}
          >
            <defs>
              {/* Markers for relationship heads */}
              <marker
                id="marker-herencia"
                viewBox="0 0 12 12"
                refX="10"
                refY="6"
                markerWidth="10"
                markerHeight="10"
                orient="auto-start-reverse"
              >
                <polygon points="0,1 10,6 0,11" fill="#1e1e24" stroke="#908fa0" strokeWidth="1.5" />
              </marker>
              <marker
                id="marker-dependencia"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="8"
                markerHeight="8"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 8 5 L 0 9" fill="none" stroke="#908fa0" strokeWidth="1.5" />
              </marker>
            </defs>

            {relations.map((rel) => {
              const src = classes.find((c) => c.id === rel.sourceId);
              const tgt = classes.find((c) => c.id === rel.targetId);
              if (!src || !tgt) return null;

              const srcW = src.width || 260;
              const tgtW = tgt.width || 260;
              const srcH = 150;
              const tgtH = 150;

              // Compute orthogonal connector coordinates
              let startX = src.x + srcW / 2;
              let startY = src.y + srcH / 2;
              let endX = tgt.x + tgtW / 2;
              let endY = tgt.y + tgtH / 2;

              if (src.x + srcW < tgt.x) {
                // Target is to the right
                startX = src.x + srcW;
                startY = src.y + 60;
                endX = tgt.x;
                endY = tgt.y + 60;
              } else if (tgt.x + tgtW < src.x) {
                // Target is to the left
                startX = src.x;
                startY = src.y + 60;
                endX = tgt.x + tgtW;
                endY = tgt.y + 60;
              } else if (src.y + srcH < tgt.y) {
                // Target is below
                startX = src.x + srcW / 2;
                startY = src.y + srcH;
                endX = tgt.x + tgtW / 2;
                endY = tgt.y;
              } else if (tgt.y + tgtH < src.y) {
                // Target is above
                startX = src.x + srcW / 2;
                startY = src.y;
                endX = tgt.x + tgtW / 2;
                endY = tgt.y + tgtH;
              }

              const midX = (startX + endX) / 2;
              const pathD = `M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`;
              const isDashed = rel.type === 'dependencia' || rel.type === 'realizacion';

              return (
                <g key={rel.id} className="transition-all pointer-events-auto">
                  <path
                    d={pathD}
                    fill="none"
                    stroke="#908fa0"
                    strokeWidth="2"
                    strokeDasharray={isDashed ? '6 4' : 'none'}
                    markerEnd={
                      rel.type === 'herencia' || rel.type === 'realizacion'
                        ? 'url(#marker-herencia)'
                        : rel.type === 'dependencia'
                        ? 'url(#marker-dependencia)'
                        : undefined
                    }
                  />

                  {/* Agregación diamond (hollow diamond at source) */}
                  {rel.type === 'agregacion' && (
                    <polygon
                      points={`${startX},${startY} ${startX + (startX < midX ? 8 : -8)},${startY - 6} ${startX + (startX < midX ? 16 : -16)},${startY} ${startX + (startX < midX ? 8 : -8)},${startY + 6}`}
                      className="fill-surface stroke-[#908fa0]"
                      strokeWidth="1.5"
                    />
                  )}

                  {/* Composición diamond (filled diamond at source) */}
                  {rel.type === 'composicion' && (
                    <polygon
                      points={`${startX},${startY} ${startX + (startX < midX ? 8 : -8)},${startY - 6} ${startX + (startX < midX ? 16 : -16)},${startY} ${startX + (startX < midX ? 8 : -8)},${startY + 6}`}
                      className="fill-secondary stroke-secondary"
                      strokeWidth="1.5"
                    />
                  )}

                  {/* Multiplicity Source */}
                  {rel.sourceMultiplicity && (
                    <g transform={`translate(${startX + (startX < midX ? 10 : -35)}, ${startY - 18})`}>
                      <rect width="26" height="16" rx="4" className="fill-surface-container-high" />
                      <text x="13" y="12" textAnchor="middle" className="fill-on-surface font-mono text-[10px] font-medium">
                        {rel.sourceMultiplicity}
                      </text>
                    </g>
                  )}

                  {/* Multiplicity Target */}
                  {rel.targetMultiplicity && (
                    <g transform={`translate(${endX + (endX > midX ? -35 : 10)}, ${endY - 18})`}>
                      <rect width="26" height="16" rx="4" className="fill-surface-container-high" />
                      <text x="13" y="12" textAnchor="middle" className="fill-on-surface font-mono text-[10px] font-medium">
                        {rel.targetMultiplicity}
                      </text>
                    </g>
                  )}

                  {/* Role name / Midpoint label */}
                  {rel.roleName && (
                    <g transform={`translate(${midX - 30}, ${(startY + endY) / 2 - 10})`}>
                      <rect width="60" height="18" rx="4" className="fill-surface-container-low shadow-sm" />
                      <text x="30" y="13" textAnchor="middle" className="fill-primary font-mono text-[10px]">
                        {rel.roleName}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
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
                  className={`absolute rounded-xl transition-shadow duration-100 ${
                    canEdit ? 'cursor-move' : 'cursor-default'
                  } ${
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
                    {cls.attributes.length === 0 && (
                      <div className="text-[11px] text-outline font-mono italic py-1">Sin atributos</div>
                    )}
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
                    {cls.methods.length === 0 && (
                      <div className="text-[11px] text-outline font-mono italic py-0.5">Sin métodos</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* CANVAS MINIMAP (BOTTOM-LEFT) */}
          <div className="absolute left-4 bottom-4 w-44 h-32 rounded-xl bg-surface-container-lowest/90 backdrop-blur-md p-2 shadow-xl flex flex-col justify-between border border-outline-variant/30">
            <div className="flex items-center justify-between px-1">
              <span className="font-mono text-xs text-outline">Minimapa</span>
              <span className="font-mono text-xs text-tertiary font-medium">{zoomLevel}%</span>
            </div>
            <div className="relative w-full flex-1 bg-surface-container-low rounded overflow-hidden mt-1 border border-outline-variant/20">
              {classes.map((c) => (
                <div
                  key={c.id}
                  style={{
                    left: `${Math.max(2, Math.min(130, c.x / 14))}px`,
                    top: `${Math.max(2, Math.min(60, c.y / 14))}px`,
                    width: '12px',
                    height: '8px',
                  }}
                  className={`absolute rounded-xs ${
                    c.id === selectedClassId ? 'bg-primary ring-1 ring-primary-fixed' : 'bg-surface-variant'
                  }`}
                />
              ))}
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
              {selectedClass ? (
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-base font-semibold text-on-surface">
                    {selectedClass.name}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-surface-container-high text-primary font-mono text-[11px]">
                    {selectedClass.isConcrete ? 'Concrete' : 'Abstract'}
                  </span>
                </div>
              ) : (
                <span className="text-sm text-outline mt-1 italic">Ninguna clase seleccionada</span>
              )}
            </div>
            {selectedClass && canEdit && (
              <button
                onClick={() => {
                  const newName = prompt('Cambiar nombre de clase:', selectedClass.name);
                  if (newName) handleUpdateClassName(newName);
                }}
                className="p-1 text-on-surface-variant hover:text-on-surface rounded hover:bg-surface-bright transition-colors cursor-pointer"
                title="Cambiar nombre de clase"
              >
                <span className="material-symbols-outlined text-[18px]">edit</span>
              </button>
            )}
          </div>

          {/* Navigation Tabs */}
          {selectedClass && (
            <>
              <div className="flex px-4 bg-surface-container-low border-b border-outline-variant/20">
                <button
                  onClick={() => setInspectorTab('general')}
                  className={`py-2 px-3 text-xs font-medium transition-colors cursor-pointer ${
                    inspectorTab === 'general'
                      ? 'text-primary font-semibold border-b-2 border-primary'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  General
                </button>
                <button
                  onClick={() => setInspectorTab('atributos')}
                  className={`py-2 px-3 text-xs font-medium transition-colors cursor-pointer relative ${
                    inspectorTab === 'atributos'
                      ? 'text-primary font-semibold border-b-2 border-primary'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  Atributos ({selectedClass.attributes.length})
                </button>
                <button
                  onClick={() => setInspectorTab('metodos')}
                  className={`py-2 px-3 text-xs font-medium transition-colors cursor-pointer ${
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
                        disabled={!canEdit}
                        onChange={(e) => handleUpdateClassName(e.target.value)}
                        className={`w-full bg-surface-container-lowest text-on-surface text-xs p-2 rounded outline-none border border-outline-variant/30 focus:border-primary ${
                          !canEdit ? 'opacity-60 cursor-not-allowed' : ''
                        }`}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-outline">Estereotipo</label>
                      <input
                        type="text"
                        value={selectedClass.stereotype}
                        disabled={!canEdit}
                        onChange={(e) => handleUpdateClassStereotype(e.target.value)}
                        className={`w-full bg-surface-container-lowest text-primary text-xs p-2 rounded outline-none border border-outline-variant/30 ${
                          !canEdit ? 'opacity-60 cursor-not-allowed' : ''
                        }`}
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <input
                        type="checkbox"
                        id="concreteCheck"
                        checked={selectedClass.isConcrete}
                        disabled={!canEdit}
                        onChange={(e) => handleToggleConcrete(e.target.checked)}
                        className="accent-primary"
                      />
                      <label htmlFor="concreteCheck" className="text-xs text-on-surface cursor-pointer">
                        Clase Concreta (genera entidad/tabla en PostgreSQL)
                      </label>
                    </div>

                    {/* Relaciones conectadas */}
                    <div className="pt-3 border-t border-outline-variant/20">
                      <span className="text-xs font-semibold text-on-surface block mb-2">
                        Relaciones Conectadas
                      </span>
                      {relations.filter(
                        (r) => r.sourceId === selectedClass.id || r.targetId === selectedClass.id
                      ).length === 0 ? (
                        <p className="text-xs text-outline italic">Sin relaciones para esta clase.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {relations
                            .filter((r) => r.sourceId === selectedClass.id || r.targetId === selectedClass.id)
                            .map((r) => {
                              const otherId = r.sourceId === selectedClass.id ? r.targetId : r.sourceId;
                              const otherClass = classes.find((c) => c.id === otherId);
                              return (
                                <div
                                  key={r.id}
                                  className="flex items-center justify-between p-2 rounded bg-surface-container text-xs font-mono"
                                >
                                  <span className="truncate">
                                    {r.type} con <b className="text-primary">{otherClass?.name || otherId}</b>
                                  </span>
                                  {canEdit && (
                                    <button
                                      onClick={() => handleDeleteRelation(r.id)}
                                      className="text-error hover:text-error/80 ml-2"
                                      title="Eliminar relación"
                                    >
                                      <span className="material-symbols-outlined text-[15px]">delete</span>
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ATRIBUTOS TAB */}
                {inspectorTab === 'atributos' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-on-surface">Campos / Atributos</span>
                      {canEdit && (
                        <button
                          onClick={handleAddAttribute}
                          className="flex items-center gap-1 text-xs text-primary hover:text-primary-fixed font-medium cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[15px]">add</span>
                          <span>Agregar Atributo</span>
                        </button>
                      )}
                    </div>

                    {/* Attributes List */}
                    <div className="space-y-2">
                      {selectedClass.attributes.map((attr) => {
                        const isEditing = editingAttrId === attr.id;

                        if (isEditing && canEdit) {
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
                                      handleUpdateAttribute(attr.id, {
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
                                      handleUpdateAttribute(attr.id, {
                                        name: e.target.value,
                                      })
                                    }
                                    className="w-full bg-surface-container-lowest text-on-surface font-mono text-xs p-1.5 rounded outline-none border border-outline-variant/30"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="text-[11px] text-outline block mb-1">
                                  Tipo de Dato (Java/JPA)
                                </label>
                                <input
                                  type="text"
                                  value={attr.type}
                                  onChange={(e) =>
                                    handleUpdateAttribute(attr.id, {
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
                                    checked={attr.isNullable ?? true}
                                    onChange={(e) =>
                                      handleUpdateAttribute(attr.id, {
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
                                      handleUpdateAttribute(attr.id, {
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
                                      handleUpdateAttribute(attr.id, {
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
                            {canEdit && (
                              <div className="flex items-center gap-1 text-on-surface-variant">
                                <button
                                  onClick={() => setEditingAttrId(attr.id)}
                                  className="p-1 hover:text-on-surface rounded hover:bg-surface-bright cursor-pointer"
                                  title="Editar atributo"
                                >
                                  <span className="material-symbols-outlined text-[16px]">edit</span>
                                </button>
                                <button
                                  onClick={() => handleDeleteAttribute(attr.id)}
                                  className="p-1 hover:text-error rounded hover:bg-surface-bright cursor-pointer"
                                  title="Eliminar atributo"
                                >
                                  <span className="material-symbols-outlined text-[16px]">delete</span>
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* MÉTODOS TAB */}
                {inspectorTab === 'metodos' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-on-surface">
                        Métodos / Operaciones
                      </span>
                      {canEdit && (
                        <button
                          onClick={handleAddMethod}
                          className="flex items-center gap-1 text-xs text-primary hover:text-primary-fixed font-medium cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[15px]">add</span>
                          <span>Agregar Método</span>
                        </button>
                      )}
                    </div>

                    <div className="space-y-2">
                      {selectedClass.methods.map((method) => {
                        const isEditingThisMethod = editingMethodId === method.id;

                        if (isEditingThisMethod && canEdit) {
                          return (
                            <div
                              key={method.id}
                              className="p-3 rounded-lg bg-surface-container-high shadow-md space-y-3 border border-tertiary/40"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="material-symbols-outlined text-[16px] text-tertiary">
                                    edit_note
                                  </span>
                                  <span className="text-xs font-medium text-tertiary">
                                    Editando: {method.name}()
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setEditingMethodId('')}
                                  className="text-outline hover:text-on-surface cursor-pointer"
                                  title="Cerrar edición"
                                >
                                  <span className="material-symbols-outlined text-[16px]">close</span>
                                </button>
                              </div>

                              {/* Form Grid: Visibilidad, Nombre */}
                              <div className="grid grid-cols-3 gap-2">
                                <div className="col-span-1">
                                  <label className="text-[11px] text-outline block mb-1">Visibilidad</label>
                                  <select
                                    value={method.visibility}
                                    onChange={(e) =>
                                      handleUpdateMethod(method.id, {
                                        visibility: e.target.value as any,
                                      })
                                    }
                                    className="w-full bg-surface-container-lowest text-on-surface font-mono text-xs p-1.5 rounded outline-none border border-outline-variant/30"
                                  >
                                    <option value="+">+ (Public)</option>
                                    <option value="-">- (Private)</option>
                                    <option value="#"># (Protected)</option>
                                    <option value="~">~ (Package)</option>
                                  </select>
                                </div>
                                <div className="col-span-2">
                                  <label className="text-[11px] text-outline block mb-1">Nombre</label>
                                  <input
                                    type="text"
                                    value={method.name}
                                    onChange={(e) =>
                                      handleUpdateMethod(method.id, {
                                        name: e.target.value,
                                      })
                                    }
                                    className="w-full bg-surface-container-lowest text-on-surface font-mono text-xs p-1.5 rounded outline-none border border-outline-variant/30"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="text-[11px] text-outline block mb-1">
                                  Tipo de Retorno (Java / Spring)
                                </label>
                                <input
                                  type="text"
                                  value={method.returnType}
                                  placeholder="void, String, BigDecimal..."
                                  onChange={(e) =>
                                    handleUpdateMethod(method.id, {
                                      returnType: e.target.value,
                                    })
                                  }
                                  className="w-full bg-surface-container-lowest text-primary font-mono text-xs p-1.5 rounded outline-none border border-outline-variant/30"
                                />
                              </div>

                              <div className="flex items-center gap-4 pt-1">
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={method.isStatic ?? false}
                                    onChange={(e) =>
                                      handleUpdateMethod(method.id, {
                                        isStatic: e.target.checked,
                                      })
                                    }
                                    className="accent-primary rounded"
                                  />
                                  <span className="text-[11px] text-on-surface">Estático (static)</span>
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={method.isAbstract ?? false}
                                    onChange={(e) =>
                                      handleUpdateMethod(method.id, {
                                        isAbstract: e.target.checked,
                                      })
                                    }
                                    className="accent-primary rounded"
                                  />
                                  <span className="text-[11px] text-on-surface">Abstracto (abstract)</span>
                                </label>
                              </div>

                              {/* PARÁMETROS SUB-SECTION */}
                              <div className="pt-2 border-t border-outline-variant/20 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-semibold text-outline uppercase tracking-wider">
                                    Parámetros ({method.parametersList?.length || 0})
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleAddParametro(method.id)}
                                    className="flex items-center gap-1 text-[11px] text-primary hover:text-primary-fixed font-medium cursor-pointer"
                                  >
                                    <span className="material-symbols-outlined text-[14px]">add</span>
                                    <span>Agregar parámetro</span>
                                  </button>
                                </div>

                                {(!method.parametersList || method.parametersList.length === 0) ? (
                                  <p className="text-[11px] text-outline italic">Sin parámetros (método sin argumentos).</p>
                                ) : (
                                  <div className="space-y-1.5">
                                    {method.parametersList.map((param) => (
                                      <div
                                        key={param.id}
                                        className="flex items-center gap-2 p-1.5 rounded bg-surface-container-lowest border border-outline-variant/20"
                                      >
                                        <input
                                          type="text"
                                          value={param.name}
                                          placeholder="nombre"
                                          onChange={(e) =>
                                            handleUpdateParametro(method.id, param.id, { name: e.target.value })
                                          }
                                          className="w-1/2 bg-transparent text-on-surface font-mono text-[11px] p-1 rounded outline-none border border-outline-variant/20 focus:border-primary"
                                        />
                                        <span className="text-outline text-xs">:</span>
                                        <input
                                          type="text"
                                          value={param.type}
                                          placeholder="tipo (ej. Integer)"
                                          onChange={(e) =>
                                            handleUpdateParametro(method.id, param.id, { type: e.target.value })
                                          }
                                          className="w-1/2 bg-transparent text-primary font-mono text-[11px] p-1 rounded outline-none border border-outline-variant/20 focus:border-primary"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteParametro(method.id, param.id)}
                                          className="p-1 text-error hover:bg-error/10 rounded cursor-pointer"
                                          title="Eliminar parámetro"
                                        >
                                          <span className="material-symbols-outlined text-[14px]">delete</span>
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div className="pt-2 flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => setEditingMethodId('')}
                                  className="px-3 py-1 rounded bg-surface-container hover:bg-surface-bright text-xs font-medium text-on-surface cursor-pointer"
                                >
                                  Listo
                                </button>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={method.id}
                            className="p-2.5 rounded-lg bg-surface-container flex items-center justify-between shadow-sm border border-outline-variant/10 hover:border-outline-variant/30 transition-all"
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 flex items-center justify-center rounded bg-tertiary/20 text-tertiary font-bold font-mono text-xs">
                                {method.visibility}
                              </span>
                              <div className="flex flex-col">
                                <span className="font-mono text-xs text-on-surface font-semibold">
                                  {method.name}({method.params || ''})
                                </span>
                                <div className="flex items-center gap-2 font-mono text-[11px]">
                                  <span className="text-secondary font-medium">: {method.returnType}</span>
                                  {method.isStatic && (
                                    <span className="px-1 py-0.2 rounded bg-surface-container-high text-[10px] text-primary font-sans">
                                      static
                                    </span>
                                  )}
                                  {method.isAbstract && (
                                    <span className="px-1 py-0.2 rounded bg-surface-container-high text-[10px] text-tertiary font-sans italic">
                                      abstract
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            {canEdit && (
                              <div className="flex items-center gap-1 text-on-surface-variant">
                                <button
                                  onClick={() => setEditingMethodId(method.id)}
                                  className="p-1 hover:text-on-surface rounded hover:bg-surface-bright cursor-pointer"
                                  title="Editar método y parámetros"
                                >
                                  <span className="material-symbols-outlined text-[16px]">edit</span>
                                </button>
                                <button
                                  onClick={() => handleDeleteMethod(method.id)}
                                  className="p-1 hover:text-error rounded hover:bg-surface-bright cursor-pointer"
                                  title="Eliminar método"
                                >
                                  <span className="material-symbols-outlined text-[16px]">delete</span>
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* 5. FLOATING AI ASSISTANT & VOICE PROMPT DRAWER (PRESERVED FOR FASE 6) */}
        <div className="absolute right-[25rem] bottom-4 w-[26rem] bg-surface-container-low/95 backdrop-blur-xl rounded-xl shadow-2xl z-30 overflow-hidden flex flex-col border border-outline-variant/30">
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
                className="p-1 text-on-surface-variant hover:text-on-surface ml-1 focus:outline-none cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {isAiCollapsed ? 'expand_less' : 'expand_more'}
                </span>
              </button>
            </div>
          </div>

          {!isAiCollapsed && (
            <>
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

                {isListening && (
                  <div className="bg-secondary-container/40 p-2.5 rounded-lg space-y-1.5 border border-secondary/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-secondary">
                        <span className="material-symbols-outlined text-[16px] animate-pulse">mic</span>
                        <span className="text-[11px] font-semibold tracking-wide">
                          COMANDO DE VOZ: ESCUCHANDO...
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-2 bg-surface-container flex items-center gap-2 border-t border-outline-variant/20">
                <button
                  onClick={() => setIsListening(!isListening)}
                  className={`p-2 rounded-lg transition-colors flex items-center justify-center shadow-md ${
                    isListening
                      ? 'bg-secondary text-on-secondary ring-2 ring-secondary/50'
                      : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                  }`}
                  title="Activar/Desactivar micrófono"
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
                  className="p-2 rounded-lg bg-primary text-on-primary hover:bg-primary-container transition-colors shadow-sm flex items-center justify-center cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">send</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* REAL COLLABORATION POPUP TOAST */}
        {showCollabToast && collabToastMessage && (
          <div className="absolute left-20 bottom-4 z-30 flex items-center gap-3 bg-surface-container-high/95 backdrop-blur-md px-4 py-2.5 rounded-xl shadow-2xl border border-outline-variant/30 animate-in fade-in slide-in-from-bottom-2">
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">
                {collabToastMessage.name.charAt(0)}
              </div>
              <span
                className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-1 ring-surface-container-high ${
                  collabToastMessage.isJoin ? 'bg-tertiary' : 'bg-outline'
                }`}
              ></span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-on-surface">{collabToastMessage.text}</span>
              <span className="text-[11px] text-on-surface-variant">
                {collabToastMessage.subtext}
              </span>
            </div>
            <button
              onClick={() => setShowCollabToast(false)}
              className="text-outline hover:text-on-surface ml-2 focus:outline-none cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        )}
      </div>

      {/* CREATE RELATION MODAL */}
      {isRelationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface-container-low rounded-xl p-6 max-w-md w-full shadow-2xl border border-outline-variant/30 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">hub</span>
                <h3 className="text-base font-bold text-on-surface">Crear Relación UML</h3>
              </div>
              <button
                onClick={() => setIsRelationModalOpen(false)}
                className="text-outline hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateRelationSubmit} className="space-y-3">
              <div>
                <label className="text-xs text-outline block mb-1">Clase Origen</label>
                <input
                  type="text"
                  disabled
                  value={selectedClass?.name || ''}
                  className="w-full bg-surface-container-lowest text-on-surface text-xs p-2 rounded border border-outline-variant/20 opacity-70"
                />
              </div>

              <div>
                <label className="text-xs text-outline block mb-1">Clase Destino</label>
                <select
                  value={relTargetId}
                  onChange={(e) => setRelTargetId(e.target.value)}
                  required
                  className="w-full bg-surface-container-lowest text-on-surface text-xs p-2 rounded border border-outline-variant/30 outline-none"
                >
                  {classes
                    .filter((c) => c.id !== selectedClassId)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-outline block mb-1">Tipo de Relación</label>
                <select
                  value={relType}
                  onChange={(e) => setRelType(toCanonicalRelationType(e.target.value))}
                  className="w-full bg-surface-container-lowest text-on-surface text-xs p-2 rounded border border-outline-variant/30 outline-none"
                >
                  <option value="asociacion">Asociación Directa (---)</option>
                  <option value="agregacion">Agregación (◇---)</option>
                  <option value="composicion">Composición (◆---)</option>
                  <option value="herencia">Herencia / Generalización (△---)</option>
                  <option value="dependencia">Dependencia (- - &gt;)</option>
                  <option value="realizacion">Realización (- - △)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-outline block mb-1">Multiplicidad Origen</label>
                  <input
                    type="text"
                    value={relSourceMult}
                    onChange={(e) => setRelSourceMult(e.target.value)}
                    placeholder="1, 0..*, *"
                    className="w-full bg-surface-container-lowest text-on-surface font-mono text-xs p-2 rounded border border-outline-variant/30"
                  />
                </div>
                <div>
                  <label className="text-xs text-outline block mb-1">Multiplicidad Destino</label>
                  <input
                    type="text"
                    value={relTargetMult}
                    onChange={(e) => setRelTargetMult(e.target.value)}
                    placeholder="1, 0..*, *"
                    className="w-full bg-surface-container-lowest text-on-surface font-mono text-xs p-2 rounded border border-outline-variant/30"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-outline block mb-1">Nombre / Rol (Opcional)</label>
                <input
                  type="text"
                  value={relName}
                  onChange={(e) => setRelName(e.target.value)}
                  placeholder="ej. compras, detalle"
                  className="w-full bg-surface-container-lowest text-on-surface text-xs p-2 rounded border border-outline-variant/30"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-outline-variant/20">
                <button
                  type="button"
                  onClick={() => setIsRelationModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-bright text-xs text-on-surface cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:bg-primary-fixed-dim cursor-pointer"
                >
                  Crear Relación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                className="text-outline hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="flex flex-col gap-2 p-3 rounded-lg bg-surface-container border border-outline-variant/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-on-surface">Código de Sesión Colaborativa:</span>
                <span className="font-mono text-xs font-bold text-primary px-2 py-0.5 rounded bg-primary/10">
                  {sessionCode || 'Activa'}
                </span>
              </div>
              <div className="text-[11px] text-on-surface-variant">
                Participantes activos: {activeParticipants.map((p) => p.nombre).join(', ') || 'Solo tú'}
              </div>
            </div>

            <p className="text-xs text-on-surface-variant">
              Gestiona los colaboradores con permisos de lectura o edición desde la pantalla de Proyectos.
            </p>
            <div className="flex items-center gap-2 p-2 rounded bg-surface-container font-mono text-xs text-on-surface border border-outline-variant/20">
              <span className="truncate flex-1">
                https://classflow.ai/proyectos/{diagrama?.id_proyecto}
              </span>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(
                    `https://classflow.ai/proyectos/${diagrama?.id_proyecto}`
                  );
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2000);
                }}
                className="px-2.5 py-1 rounded bg-primary text-on-primary font-sans font-semibold text-xs flex items-center gap-1 cursor-pointer"
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
