"use client";

import { PartySocket } from "partysocket";
import { useEffect, useRef, useState } from "react";

import type { RealtimeEvent, RealtimeTicket, RoomName } from "../types";
import { parseRoom } from "../types";

export type ConnectionStatus = "idle" | "connecting" | "open" | "closed";

export interface UsePartyRoomOptions<E extends { event: string }> {
  /** PartyKit host: `<project>.<user>.partykit.dev` or local `127.0.0.1:1999`. */
  host: string;
  /** Defaults to `wss`. Use `ws` for local dev. */
  protocol?: "ws" | "wss";
  /** Fetches a fresh ticket. Called on first connect and before expiry. */
  getTicket: (roomId: RoomName) => Promise<RealtimeTicket>;
  /** Per-event callback. Runs for every message received, including `connection.ready`. */
  onEvent?: (event: E) => void;
}

export interface UsePartyRoomResult<E extends { event: string }> {
  status: ConnectionStatus;
  /** The most recent event received. Useful when you just want to react to a single channel. */
  lastEvent: E | null;
}

/**
 * Connect to a PartyKit room, handle auth tickets + reconnects, and
 * surface a tiny state machine for UI. The hook is opinionated:
 *
 *   - One room per hook call. Pass `null` to disconnect.
 *   - Tickets auto-refresh ~30s before `expiresAt`.
 *   - `partysocket` handles backoff + ping/pong; we just listen.
 *   - The hook never sends — this is a read-only channel from the
 *     client's perspective. For client-pushed events (chat, presence)
 *     reach for `partysocket` directly inside a different party.
 *
 * @example
 *   const { status, lastEvent } = usePartyRoom<StampEvent>(
 *     `customer:${customer.id}`,
 *     { host, getTicket: (room) => api.realtime.issueTicket.mutateAsync({ roomId: room }) },
 *   );
 */
export function usePartyRoom<E extends { event: string } = RealtimeEvent>(
  roomId: RoomName | null,
  options: UsePartyRoomOptions<E>,
): UsePartyRoomResult<E> {
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [lastEvent, setLastEvent] = useState<E | null>(null);
  const onEventRef = useRef(options.onEvent);
  onEventRef.current = options.onEvent;
  // Stabilize getTicket — callers typically build it inline from a tRPC
  // mutation that returns a new identity per render, which would
  // otherwise re-run the effect on every render and re-issue tickets in
  // a tight loop.
  const getTicketRef = useRef(options.getTicket);
  getTicketRef.current = options.getTicket;

  useEffect(() => {
    if (!roomId) {
      setStatus("idle");
      return;
    }
    let cancelled = false;
    let socket: PartySocket | null = null;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = async () => {
      setStatus("connecting");
      let ticket: RealtimeTicket;
      try {
        ticket = await getTicketRef.current(roomId);
      } catch {
        if (!cancelled) setStatus("closed");
        return;
      }
      if (cancelled) return;

      // Connect to the room the ticket actually grants — the server may
      // have prefixed the body (per-PR preview isolation), so trust
      // `ticket.roomId` over the logical `roomId` we asked for.
      const { kind, body } = parseRoom(ticket.roomId as RoomName);
      socket = new PartySocket({
        host: options.host,
        party: kind,
        room: body,
        query: { token: ticket.token },
        protocol: options.protocol,
      });

      socket.addEventListener("open", () => setStatus("open"));
      socket.addEventListener("close", () => setStatus("closed"));
      socket.addEventListener("error", () => setStatus("closed"));
      socket.addEventListener("message", (msg: MessageEvent<string>) => {
        try {
          const parsed = JSON.parse(msg.data) as E;
          setLastEvent(parsed);
          onEventRef.current?.(parsed);
        } catch {
          // bad payload — ignore
        }
      });

      // Refresh ticket 30s before expiry. partysocket reuses the same
      // URL on reconnect, so we tear down + reconnect to swap the
      // token. Cheap on the WebSocket budget; refreshes are rare.
      const expiresMs =
        new Date(ticket.expiresAt).getTime() - Date.now() - 30_000;
      if (expiresMs > 0) {
        refreshTimer = setTimeout(() => {
          if (cancelled) return;
          socket?.close();
          void connect();
        }, expiresMs);
      }
    };

    void connect();

    return () => {
      cancelled = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      socket?.close();
    };
  }, [roomId, options.host, options.protocol]);

  return { status, lastEvent };
}

export type { RealtimeEvent, RealtimeTicket, RoomName } from "../types";
