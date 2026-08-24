/**
 * Wire shape every event published into a party uses. Producers fill in
 * `event` + `data`; the publisher (or the party itself for server-emitted
 * events like `connection.ready`) sets `emittedAt`.
 */
export interface RealtimeEvent {
  event: string;
  data: Record<string, unknown>;
  emittedAt: string;
}
