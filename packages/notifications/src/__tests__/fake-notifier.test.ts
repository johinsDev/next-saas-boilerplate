import { describe, expect, it } from "vitest";
import { FakeNotifier } from "../fake-notifier";
import { NewUserNotification, ORG, PromoNotification } from "../test-fixtures";

const target = { customerId: "cust-1", organizationId: ORG };

describe("FakeNotifier", () => {
  it("records sends and returns a synthetic ok result", async () => {
    const fake = new FakeNotifier();
    const result = await fake.send(target, new NewUserNotification());
    expect(result.ok).toBe(true);
    expect(result.results).toHaveLength(5);
    fake.assertSent(NewUserNotification);
  });

  it("assertSent supports a predicate", async () => {
    const fake = new FakeNotifier();
    await fake.send(target, new NewUserNotification("Ana"));
    fake.assertSent(
      NewUserNotification,
      (n) => n instanceof NewUserNotification,
    );
    expect(() =>
      fake.assertSent(PromoNotification),
    ).toThrow(/PromoNotification/);
  });

  it("assertNotSent throws when present", async () => {
    const fake = new FakeNotifier();
    await fake.send(target, new PromoNotification());
    fake.assertNotSent(NewUserNotification);
    expect(() => fake.assertNotSent(PromoNotification)).toThrow();
  });

  it("assertSentOnChannel checks declared channels", async () => {
    const fake = new FakeNotifier();
    await fake.send(target, new NewUserNotification());
    fake.assertSentOnChannel(NewUserNotification, "mail");
    expect(() =>
      fake.assertSentOnChannel(NewUserNotification, "whatsapp"),
    ).toThrow(/whatsapp/);
  });

  it("assertSentCount with and without a class", async () => {
    const fake = new FakeNotifier();
    await fake.send(target, new NewUserNotification());
    await fake.send(target, new PromoNotification());
    fake.assertSentCount(2);
    fake.assertSentCount(NewUserNotification, 1);
    expect(() => fake.assertSentCount(3)).toThrow();
  });

  it("assertNoneSent + clear", async () => {
    const fake = new FakeNotifier();
    fake.assertNoneSent();
    await fake.send(target, new PromoNotification());
    expect(() => fake.assertNoneSent()).toThrow();
    fake.clear();
    fake.assertNoneSent();
  });
});
