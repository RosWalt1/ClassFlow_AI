import { authService } from './authService';

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export interface ActiveParticipant {
  id_usuario: number;
  nombre: string;
  email: string;
  es_propietario: boolean;
  permiso_edicion: boolean;
}

export interface RemoteCursor {
  user_id: number;
  user_name: string;
  x: number;
  y: number;
  lastUpdated: number;
}

export type CollaborationEventListener = (event: any) => void;

class CollaborationService {
  private socket: WebSocket | null = null;
  private currentDiagramId: number | null = null;
  private status: ConnectionStatus = 'disconnected';
  private listeners: Map<string, Set<CollaborationEventListener>> = new Map();
  private statusListeners: Set<(status: ConnectionStatus) => void> = new Set();
  private reconnectTimer: any = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private isIntentionallyClosed = false;

  // Throttling para envío de cursor
  private lastCursorSent = 0;
  private cursorThrottleMs = 50;

  private getWsUrl(diagramaId: number, token: string): string {
    const apiBase = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000';
    const wsProto = apiBase.startsWith('https') ? 'wss' : 'ws';
    const host = apiBase.replace(/^https?:\/\//, '');
    return `${wsProto}://${host}/api/ws/diagramas/${diagramaId}?token=${encodeURIComponent(token)}`;
  }

  public connect(diagramaId: number): void {
    if (this.socket && this.currentDiagramId === diagramaId && this.status === 'connected') {
      return;
    }

    this.disconnect();
    this.currentDiagramId = diagramaId;
    this.isIntentionallyClosed = false;
    this.setStatus('connecting');

    const token = authService.getToken();
    if (!token) {
      console.warn('[Collab] No token available for WebSocket connection');
      this.setStatus('disconnected');
      return;
    }

    try {
      const url = this.getWsUrl(diagramaId, token);
      this.socket = new WebSocket(url);

      this.socket.onopen = () => {
        this.reconnectAttempts = 0;
        this.setStatus('connected');
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.dispatchEvent(data);
        } catch (e) {
          console.error('[Collab] Error parsing incoming WS message', e);
        }
      };

      this.socket.onerror = (err) => {
        console.warn('[Collab] WebSocket error', err);
      };

      this.socket.onclose = (event) => {
        this.socket = null;
        if (!this.isIntentionallyClosed) {
          this.handleReconnect();
        } else {
          this.setStatus('disconnected');
        }
      };
    } catch (err) {
      console.error('[Collab] Error initiating WebSocket connection', err);
      this.handleReconnect();
    }
  }

  public disconnect(): void {
    this.isIntentionallyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      try {
        this.socket.close();
      } catch {}
      this.socket = null;
    }
    this.currentDiagramId = null;
    this.setStatus('disconnected');
  }

  private handleReconnect(): void {
    if (this.isIntentionallyClosed || !this.currentDiagramId) return;

    this.reconnectAttempts++;
    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      this.setStatus('disconnected');
      return;
    }

    this.setStatus('reconnecting');
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 10000);

    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      if (this.currentDiagramId && !this.isIntentionallyClosed) {
        this.connect(this.currentDiagramId);
      }
    }, delay);
  }

  private setStatus(newStatus: ConnectionStatus): void {
    if (this.status === newStatus) return;
    this.status = newStatus;
    this.statusListeners.forEach((fn) => fn(newStatus));
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  public onStatusChange(callback: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(callback);
    callback(this.status);
    return () => this.statusListeners.delete(callback);
  }

  public on(eventType: string, listener: CollaborationEventListener): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener);
    return () => this.listeners.get(eventType)?.delete(listener);
  }

  private dispatchEvent(event: any): void {
    const type = event?.type;
    if (!type) return;

    // Dispatch specific event
    const specificListeners = this.listeners.get(type);
    if (specificListeners) {
      specificListeners.forEach((fn) => {
        try {
          fn(event);
        } catch (e) {
          console.error(`[Collab] Error in listener for ${type}`, e);
        }
      });
    }

    // Dispatch wildcard / all listener
    const allListeners = this.listeners.get('*');
    if (allListeners) {
      allListeners.forEach((fn) => {
        try {
          fn(event);
        } catch (e) {
          console.error('[Collab] Error in wildcard listener', e);
        }
      });
    }
  }

  public sendCursorMove(x: number, y: number): void {
    if (!this.socket || this.status !== 'connected') return;

    const now = Date.now();
    if (now - this.lastCursorSent < this.cursorThrottleMs) {
      return;
    }
    this.lastCursorSent = now;

    try {
      this.socket.send(
        JSON.stringify({
          type: 'cursor.move',
          x: Math.round(x),
          y: Math.round(y),
        })
      );
    } catch {}
  }
}

export const collaborationService = new CollaborationService();
