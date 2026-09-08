// Public API of @saas/realtime (server-side).
// React client hook lives under `@saas/realtime/client`.
// See .claude/skills/realtime/SKILL.md for the full handbook.

export { RealtimeClient, type RealtimeClientConfig } from "./client";
export { FakeRealtime } from "./fake";
export { signHmac, signTicket } from "./ticket";
export { verifyHmac, verifyTicket } from "./verify";
export {
  parseRoom,
  PARTY_KINDS,
  type OrganizationRoom,
  type ParsedRoom,
  type PartyKind,
  type RealtimeEvent,
  type RealtimeTicket,
  type RoomName,
  type UserRoom,
} from "./types";
