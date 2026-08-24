import type { FlagsStrategy, FlagValue } from "./types";

/**
 * Test double. Records every read, lets a test pin flag values:
 *
 *   const fake = flags.fake();
 *   fake.set("new-checkout-flow", true);
 *   // …exercise the unit…
 *   fake.assertChecked("new-checkout-flow");
 *
 * Values for flags you didn't `set()` are `undefined` (so the caller's
 * default takes over) — same semantics as a missing flag in PostHog.
 */
export class FakeFlags implements FlagsStrategy {
  readonly name = "fake";
  readonly checked: Array<{ distinctId: string; key: string }> = [];
  readonly #values = new Map<string, FlagValue>();

  set(key: string, value: FlagValue): this {
    this.#values.set(key, value);
    return this;
  }

  unset(key: string): this {
    this.#values.delete(key);
    return this;
  }

  async isEnabled(args: { distinctId: string; key: string }): Promise<boolean | undefined> {
    this.checked.push(args);
    const v = this.#values.get(args.key);
    if (v === undefined) return undefined;
    return Boolean(v);
  }

  async getValue(args: { distinctId: string; key: string }): Promise<FlagValue | undefined> {
    this.checked.push(args);
    return this.#values.get(args.key);
  }

  async getAllFlags(_args: { distinctId: string }): Promise<Record<string, FlagValue>> {
    return Object.fromEntries(this.#values);
  }

  async shutdown(): Promise<void> {}

  assertChecked(key: string): this {
    if (!this.checked.some((c) => c.key === key)) {
      throw new Error(
        `Expected flag "${key}" to have been checked. Got: ${this.checked.map((c) => c.key).join(", ") || "<none>"}`,
      );
    }
    return this;
  }

  clear(): void {
    this.checked.length = 0;
    this.#values.clear();
  }
}
