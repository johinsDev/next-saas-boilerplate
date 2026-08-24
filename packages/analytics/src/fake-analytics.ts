import type {
  AnalyticsEvent,
  AnalyticsStrategy,
  EventProperties,
} from "./types";

interface CapturedEvent {
  distinctId: string;
  event: AnalyticsEvent;
  properties: EventProperties;
}

interface IdentifiedCall {
  distinctId: string;
  properties: EventProperties;
}

/**
 * Test double for both the server `AnalyticsStrategy` and (via the
 * binding factory) the React side. Records every call, exposes
 * assertions, has no side effects.
 *
 * @example
 *   const fake = analytics.fake();
 *   // ...exercise the unit...
 *   fake.assertCaptured("subscription.started");
 */
export class FakeAnalytics implements AnalyticsStrategy {
  readonly name = "fake";
  readonly captured: CapturedEvent[] = [];
  readonly identified: IdentifiedCall[] = [];

  capture(args: CapturedEvent): void {
    this.captured.push(args);
  }

  identify(args: IdentifiedCall): void {
    this.identified.push(args);
  }

  async flush(): Promise<void> {}
  async shutdown(): Promise<void> {}

  assertCaptured(
    event: AnalyticsEvent,
    match?: (e: CapturedEvent) => boolean,
  ): this {
    const found = this.captured.find(
      (c) => c.event === event && (match ? match(c) : true),
    );
    if (!found) {
      throw new Error(
        `Expected analytics event "${event}" to have been captured. Got: ${this.captured.map((c) => c.event).join(", ") || "<none>"}`,
      );
    }
    return this;
  }

  assertNotCaptured(event: AnalyticsEvent): this {
    if (this.captured.some((c) => c.event === event)) {
      throw new Error(`Expected analytics event "${event}" NOT to have been captured.`);
    }
    return this;
  }

  assertIdentified(distinctId: string): this {
    if (!this.identified.some((i) => i.distinctId === distinctId)) {
      throw new Error(
        `Expected identify("${distinctId}"). Got: ${this.identified.map((i) => i.distinctId).join(", ") || "<none>"}`,
      );
    }
    return this;
  }

  clear(): void {
    this.captured.length = 0;
    this.identified.length = 0;
  }
}
