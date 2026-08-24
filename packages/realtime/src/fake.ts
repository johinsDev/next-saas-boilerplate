import type { RealtimeClient } from "./client";
import type { RealtimeEvent, RoomName } from "./types";

interface RecordedPublish {
  room: RoomName;
  event: RealtimeEvent;
}

/**
 * Drop-in replacement for `RealtimeClient` in tests + local dev when
 * PartyKit isn't configured. Records every publish in memory; never
 * touches the network.
 *
 * Implements the same `publish` signature so any caller typed against
 * `RealtimeClient | FakeRealtime` (or a structural `{ publish(...) }`)
 * compiles without conditionals.
 */
export class FakeRealtime
  implements Pick<RealtimeClient, "publish">
{
  readonly name: string = "fake";
  readonly published: RecordedPublish[] = [];

  async publish(
    room: RoomName,
    event: Omit<RealtimeEvent, "emittedAt">,
  ): Promise<void> {
    this.published.push({
      room,
      event: {
        event: event.event,
        data: event.data,
        emittedAt: new Date().toISOString(),
      },
    });
  }

  clear(): void {
    this.published.length = 0;
  }

  assertPublished(
    room: RoomName,
    predicate?: (event: RealtimeEvent) => boolean,
  ): this {
    const match = this.published.find((p) => {
      if (p.room !== room) return false;
      return predicate ? predicate(p.event) : true;
    });
    if (!match) {
      throw new Error(`expected a publish to "${room}" but none matched`);
    }
    return this;
  }

  assertPublishedCount(count: number): this {
    if (this.published.length !== count) {
      throw new Error(
        `expected ${count} realtime publishes, got ${this.published.length}`,
      );
    }
    return this;
  }

  assertNonePublished(): this {
    if (this.published.length > 0) {
      const rooms = this.published.map((p) => p.room).join(", ");
      throw new Error(`expected no realtime publishes, got: ${rooms}`);
    }
    return this;
  }
}
