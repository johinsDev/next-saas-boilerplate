import { describe, expect, it } from "vitest";
import { DatabaseChannel } from "../channels/database";
import { MailChannel } from "../channels/mail";
import { PushChannel } from "../channels/push";
import { RealtimeChannel } from "../channels/realtime";
import { SmsChannel } from "../channels/sms";
import { Notification } from "../notification";
import { Notifier } from "../notifier";
import type { ChannelName, ResolvedCustomerNotifiable } from "../types";
import {
  NewUserNotification,
  ORG,
  PromoNotification,
  recordingGateway,
  StubDatabaseRepository,
  StubNotifiableRepository,
  StubPreferencesRepository,
  fakeRealtime,
} from "../test-fixtures";

const resolved: ResolvedCustomerNotifiable = {
  kind: "customer",
  customerId: "cust-1",
  organizationId: ORG,
  phone: "+5491155555555",
  email: "lucia@example.com",
  name: "Lucia",
};

function buildNotifier(opts?: {
  optedOut?: Set<ChannelName>;
  rows?: Record<string, ResolvedCustomerNotifiable>;
}) {
  const mail = recordingGateway();
  const sms = recordingGateway();
  const push = recordingGateway();
  const realtime = fakeRealtime();
  const dbRepo = new StubDatabaseRepository();
  const notifier = new Notifier({
    channels: {
      mail: new MailChannel(mail.gateway),
      sms: new SmsChannel(sms.gateway),
      push: new PushChannel(push.gateway),
      realtime: new RealtimeChannel(realtime.gateway),
      database: new DatabaseChannel(dbRepo),
    },
    notifiables: new StubNotifiableRepository(
      opts?.rows ?? { "cust-1": resolved },
    ),
    preferences: new StubPreferencesRepository(opts?.optedOut),
    logLevel: "silent",
  });
  return { notifier, mail, sms, push, realtime, dbRepo };
}

describe("Notifier", () => {
  it("resolves the recipient and fans out to all declared channels", async () => {
    const { notifier, mail, sms, push, realtime, dbRepo } = buildNotifier();
    const result = await notifier.send(
      { customerId: "cust-1", organizationId: ORG },
      new NewUserNotification("Lucia"),
    );

    expect(result.ok).toBe(true);
    expect(result.notification).toBe("NewUserNotification");
    expect(result.results.map((r) => r.status)).toEqual([
      "sent",
      "sent",
      "sent",
      "sent",
      "sent",
    ]);
    expect(mail.calls.length).toBeGreaterThan(0);
    expect(sms.calls).toContainEqual(["content", "¡Bienvenido a Acme, Lucia!"]);
    expect(push.calls).toContainEqual(["toUser", "cust-1"]);
    expect(realtime.published[0]?.room).toBe("customer:cust-1");
    expect(dbRepo.created[0]?.category).toBe("transactional");
  });

  it("uses a fully-resolved notifiable without hitting the repository", async () => {
    const { notifier, sms } = buildNotifier({ rows: {} });
    const result = await notifier.send(resolved, new NewUserNotification());
    expect(result.ok).toBe(true);
    expect(sms.calls).toContainEqual(["to", "+5491155555555"]);
  });

  it("throws when the customer cannot be resolved", async () => {
    const { notifier } = buildNotifier({ rows: {} });
    await expect(
      notifier.send(
        { customerId: "ghost", organizationId: ORG },
        new NewUserNotification(),
      ),
    ).rejects.toThrow(/not found/);
  });

  it("isolates a failing channel — siblings still send", async () => {
    const dbRepo = new StubDatabaseRepository();
    const sms = recordingGateway();
    const notifier = new Notifier({
      channels: {
        sms: new SmsChannel(sms.gateway),
        database: new DatabaseChannel({
          async create() {
            throw new Error("db down");
          },
        }),
      },
      notifiables: new StubNotifiableRepository({ "cust-1": resolved }),
      preferences: new StubPreferencesRepository(),
      logLevel: "silent",
    });

    class TwoChannel extends Notification {
      readonly category = "transactional" as const;
      via(): ChannelName[] {
        return ["sms", "database"];
      }
      toSms() {
        return { body: "hi" };
      }
      toDatabase() {
        return { type: "x", title: "x", body: "x" };
      }
    }

    const result = await notifier.send(resolved, new TwoChannel());
    expect(result.ok).toBe(false);
    const byChannel = Object.fromEntries(
      result.results.map((r) => [r.channel, r.status]),
    );
    expect(byChannel.sms).toBe("sent");
    expect(byChannel.database).toBe("failed");
    expect(sms.calls).toContainEqual(["content", "hi"]);
    void dbRepo;
  });

  it("skips channels declared but not registered", async () => {
    const sms = recordingGateway();
    const notifier = new Notifier({
      channels: { sms: new SmsChannel(sms.gateway) },
      notifiables: new StubNotifiableRepository({ "cust-1": resolved }),
      preferences: new StubPreferencesRepository(),
      logLevel: "silent",
    });
    const result = await notifier.send(resolved, new PromoNotification());
    const byChannel = Object.fromEntries(
      result.results.map((r) => [r.channel, r]),
    );
    expect(byChannel.sms?.status).toBe("sent");
    expect(byChannel.mail?.status).toBe("skipped");
    expect(byChannel.mail?.reason).toBe("not-registered");
  });

  it("skips opted-out channels for marketing", async () => {
    const { notifier } = buildNotifier({ optedOut: new Set(["sms"]) });
    const result = await notifier.send(resolved, new PromoNotification());
    const byChannel = Object.fromEntries(
      result.results.map((r) => [r.channel, r]),
    );
    expect(byChannel.sms?.status).toBe("skipped");
    expect(byChannel.sms?.reason).toBe("opted-out");
    expect(byChannel.mail?.status).toBe("sent");
  });

  it("restricts delivery to onlyChannels (automated-trigger channel override)", async () => {
    const { notifier } = buildNotifier();
    const result = await notifier.send(
      { customerId: "cust-1", organizationId: ORG },
      new NewUserNotification("Lucia"),
      { onlyChannels: ["mail", "sms"] },
    );
    // NewUser declares 6 channels; the override narrows to the 2 allowed.
    expect(result.results.map((r) => r.channel).sort()).toEqual(["mail", "sms"]);
    expect(result.results.every((r) => r.status === "sent")).toBe(true);
  });

  it("ignores opt-out for transactional notifications", async () => {
    const { notifier } = buildNotifier({
      optedOut: new Set(["sms", "mail", "push"]),
    });
    const result = await notifier.send(resolved, new NewUserNotification());
    expect(result.results.every((r) => r.status === "sent")).toBe(true);
  });
});
