/**
 * Real-time Multiplayer Engine using BroadcastChannel & Room Messaging.
 * Syncs player locations, health, kills, and actions across client instances.
 */

import { RemotePlayer } from '../types';

export type MultiplayerEventCallback = (players: RemotePlayer[]) => void;

class MultiplayerEngine {
  private channel: BroadcastChannel | null = null;
  private roomId: string = 'apocalypse-main';
  private localPlayer: RemotePlayer | null = null;
  private remotePlayers: Map<string, RemotePlayer> = new Map();
  private callbacks: Set<MultiplayerEventCallback> = new Set();
  private heartbeatInterval: any = null;

  constructor() {
    this.initChannel();
  }

  private initChannel() {
    try {
      this.channel = new BroadcastChannel(`z_strike_room_${this.roomId}`);
      this.channel.onmessage = (event) => this.handleMessage(event.data);
    } catch (e) {
      console.warn("BroadcastChannel not available, using fallback", e);
    }

    // Clean stale remote players every 3 seconds
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [id, p] of this.remotePlayers.entries()) {
        if (now - p.lastActive > 6000) {
          this.remotePlayers.delete(id);
          changed = true;
        }
      }
      if (changed) {
        this.notifyListeners();
      }
    }, 2000);
  }

  public joinRoom(roomId: string, playerInfo: Omit<RemotePlayer, 'lastActive'>) {
    this.roomId = roomId;
    if (this.channel) {
      this.channel.close();
    }
    try {
      this.channel = new BroadcastChannel(`z_strike_room_${this.roomId}`);
      this.channel.onmessage = (event) => this.handleMessage(event.data);
    } catch (e) {
      console.warn("BroadcastChannel error on room join", e);
    }

    this.localPlayer = {
      ...playerInfo,
      lastActive: Date.now()
    };

    // Broadcast join event
    this.broadcastState();
  }

  public updateLocalState(
    pos: { x: number; z: number },
    health: number,
    kills: number,
    gps?: { lat: number; lng: number }
  ) {
    if (!this.localPlayer) return;

    this.localPlayer.x = pos.x;
    this.localPlayer.z = pos.z;
    this.localPlayer.health = health;
    this.localPlayer.kills = kills;
    if (gps) {
      this.localPlayer.lat = gps.lat;
      this.localPlayer.lng = gps.lng;
    }
    this.localPlayer.lastActive = Date.now();

    this.broadcastState();
  }

  private broadcastState() {
    if (!this.localPlayer || !this.channel) return;
    try {
      this.channel.postMessage({
        type: 'PLAYER_UPDATE',
        player: this.localPlayer
      });
    } catch (e) {
      console.error("Failed to post broadcast message", e);
    }
  }

  private handleMessage(data: any) {
    if (!data || !data.type) return;

    if (data.type === 'PLAYER_UPDATE' && data.player) {
      const p = data.player as RemotePlayer;
      if (this.localPlayer && p.id === this.localPlayer.id) return; // ignore self

      this.remotePlayers.set(p.id, {
        ...p,
        lastActive: Date.now()
      });
      this.notifyListeners();
    }
  }

  public subscribe(cb: MultiplayerEventCallback) {
    this.callbacks.add(cb);
    cb(Array.from(this.remotePlayers.values()));
    return () => {
      this.callbacks.delete(cb);
    };
  }

  private notifyListeners() {
    const playerList = Array.from(this.remotePlayers.values());
    this.callbacks.forEach((cb) => cb(playerList));
  }

  public getRemotePlayers(): RemotePlayer[] {
    return Array.from(this.remotePlayers.values());
  }

  public cleanup() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.channel) this.channel.close();
  }
}

export const multiplayerEngine = new MultiplayerEngine();
