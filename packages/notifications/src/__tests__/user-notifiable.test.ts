import { describe, expect, it } from "vitest";
import { DatabaseChannel } from "../channels/database";
import { MailChannel } from "../channels/mail";
import { PushChannel } from "../channels/push";
import { RealtimeChannel } from "../channels/realtime";
import { SmsChannel } from "../channels/sms";
import { WhatsAppChannel } from "../channels/whatsapp";
import { Notification, type NotificationRenderers } from "../notification";
import { Notifier } from "../notifier";
import {
  fakeRealtime,
  ORG,
  recordingGateway,
  StubAdminDatabaseRepository,
  StubDatabaseRepository,
  StubNotifiableRepository,
  StubPreferencesRepository,
  userNotifiable,
} from "../test-fixtures";
import type { ChannelName, ResolvedUserNotifiable } from "../types";

const resolvedUser: ResolvedUserNotifiable = {
  kind: "user",
  userId: "user-1",
  organizationId: ORG,
  storeId: null,
  phone: null,
  email: "duena@example.com",
  name: "Dueña",
};

/** Stands in for an admin alert: in-app inbox + mail, never realtime. */
class AlertNotification extends Notification implements NotificationRenderers {
  readonly category = "transactional" as const;
  constructor(private readonly channels: ChannelName[] = ["database", "mail"]) {
    super();
  }
  via(): ChannelName[] {
    return this.channels;
  }
  toMail() {
    return { subject: "Ajuste manual", html: "<p>+500 puntos</p>" };
  }
  toSms() {
    return { body: "Ajuste manual de 500 puntos" };
  }
  toWhatsApp() {
    return { body: "Ajuste manual de 500 puntos" };
  }
  toPush() {
    return { title: "Ajuste manual", body: "+500 puntos" };
  }
  toRealtime() {
    return { event: "admin.alert", data: { type: "points-adjusted" } };
  }
  toDatabase() {
    return {
      type: "points-adjusted",
      title: "Ajuste manual de puntos",
      body: "Ana le sumó 500 puntos a Lucía",
      severity: "warning",
      entityType: "customer",
      entityId: "cust-9",
    };
  }
}

function buildNotifier(opts?: {
  optedOut?: Set<ChannelName>;
  withAdminRepo?: boolean;
}) {
  const mail = recordingGateway();
  const sms = recordingGateway();
  const push = recordingGateway();
  const whatsapp = recordingGateway();
  const realtime = fakeRealtime();
  const adminRepo = new StubAdminDatabaseRepository();
  const customerRepo = new StubDatabaseRepository();
  const notifier = new Notifier({
    channels: {
      mail: new MailChannel(mail.gateway),
      sms: new SmsChannel(sms.gateway),
      push: new PushChannel(push.gateway),
      whatsapp: new WhatsAppChannel(whatsapp.gateway),
      realtime: new RealtimeChannel(realtime.gateway),
      database: new DatabaseChannel(
        customerRepo,
        opts?.withAdminRepo === false ? undefined : adminRepo,
      ),
    },
    notifiables: new StubNotifiableRepository({}, { "user-1": resolvedUser }),
    // Every channel is opted out — a staff alert must ignore this entirely.
    preferences: new StubPreferencesRepository(opts?.optedOut),
    logLevel: "silent",
  });
  return { notifier, mail, sms, push, whatsapp, realtime, adminRepo, customerRepo };
}

function statuses(results: { channel: string; status: string }[]) {
  return Object.fromEntries(results.map((r) => [r.channel, r.status]));
}

describe("staff (user) notifiable", () => {
  it("writes the admin inbox row, not the customer feed", async () => {
    const { notifier, adminRepo, customerRepo } = buildNotifier();

    const result = await notifier.send(
      userNotifiable({ storeId: "store-1" }),
      new AlertNotification(["database"]),
    );

    expect(result.recipient).toEqual({ kind: "user", id: "user-1" });
    expect(customerRepo.created).toHaveLength(0);
    expect(adminRepo.created).toHaveLength(1);
    expect(adminRepo.created[0]).toMatchObject({
      userId: "user-1",
      organizationId: ORG,
      storeId: "store-1",
      type: "points-adjusted",
      severity: "warning",
      entityType: "customer",
      entityId: "cust-9",
    });
  });

  it("ignores marketing opt-outs (an internal alert is not suppressible)", async () => {
    const { notifier, adminRepo } = buildNotifier({
      optedOut: new Set<ChannelName>(["mail", "database"]),
    });

    const result = await notifier.send(
      userNotifiable(),
      new AlertNotification(["database", "mail"]),
    );

    expect(statuses(result.results)).toEqual({
      database: "sent",
      mail: "sent",
    });
    expect(adminRepo.created).toHaveLength(1);
  });

  it("skips sms and whatsapp when the employee has no phone", async () => {
    const { notifier, sms, whatsapp } = buildNotifier();

    const result = await notifier.send(
      userNotifiable({ phone: null }),
      new AlertNotification(["sms", "whatsapp"]),
    );

    expect(statuses(result.results)).toEqual({
      sms: "skipped",
      whatsapp: "skipped",
    });
    expect(result.results.every((r) => r.reason === "no-contact")).toBe(true);
    expect(sms.calls).toHaveLength(0);
    expect(whatsapp.calls).toHaveLength(0);
  });

  it("still reaches an employee who does have a phone", async () => {
    const { notifier, sms } = buildNotifier();

    const result = await notifier.send(
      userNotifiable({ phone: "+5491166666666" }),
      new AlertNotification(["sms"]),
    );

    expect(statuses(result.results)).toEqual({ sms: "sent" });
    expect(sms.calls).toContainEqual(["to", "+5491166666666"]);
  });

  it("skips push (staff have no registered devices)", async () => {
    const { notifier, push } = buildNotifier();

    const result = await notifier.send(
      userNotifiable(),
      new AlertNotification(["push"]),
    );

    expect(result.results[0]).toMatchObject({
      status: "skipped",
      reason: "not-registered",
    });
    expect(push.calls).toHaveLength(0);
  });

  it("skips realtime without an explicit room (the job publishes org-wide once)", async () => {
    const { notifier, realtime } = buildNotifier();

    const result = await notifier.send(
      userNotifiable(),
      new AlertNotification(["realtime"]),
    );

    expect(result.results[0]).toMatchObject({
      status: "skipped",
      reason: "no-method",
    });
    expect(realtime.published).toHaveLength(0);
  });

  it("hydrates contact info from the repository when only the id is known", async () => {
    const { notifier, mail } = buildNotifier();

    await notifier.send(
      { kind: "user", userId: "user-1", organizationId: ORG },
      new AlertNotification(["mail"]),
    );

    expect(mail.calls).toContainEqual(["to", "duena@example.com", "Dueña"]);
  });

  it("fails loudly when the user does not belong to the org", async () => {
    const { notifier } = buildNotifier();

    await expect(
      notifier.send(
        { kind: "user", userId: "user-1", organizationId: "other-org" },
        new AlertNotification(["mail"]),
      ),
    ).rejects.toThrow(/user "user-1" not found/);
  });

  it("skips the inbox when no admin repository is wired", async () => {
    const { notifier, adminRepo } = buildNotifier({ withAdminRepo: false });

    const result = await notifier.send(
      userNotifiable(),
      new AlertNotification(["database"]),
    );

    expect(result.results[0]).toMatchObject({
      status: "skipped",
      reason: "not-registered",
    });
    expect(adminRepo.created).toHaveLength(0);
  });
});
