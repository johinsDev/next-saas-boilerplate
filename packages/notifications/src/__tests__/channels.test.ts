import { describe, expect, it } from "vitest";
import { DatabaseChannel } from "../channels/database";
import { MailChannel } from "../channels/mail";
import { PushChannel } from "../channels/push";
import { RealtimeChannel } from "../channels/realtime";
import { SmsChannel } from "../channels/sms";
import { WhatsAppChannel } from "../channels/whatsapp";
import { Notification } from "../notification";
import type { ChannelName, ResolvedNotifiable } from "../types";
import {
  NewUserNotification,
  ORG,
  PartialNotification,
  recordingGateway,
  StubDatabaseRepository,
  fakeRealtime,
} from "../test-fixtures";

const who: ResolvedNotifiable = {
  kind: "customer",
  customerId: "cust-1",
  organizationId: ORG,
  phone: "+5491155555555",
  email: "lucia@example.com",
  name: "Lucia",
};

describe("MailChannel", () => {
  it("maps the contract onto the email builder", async () => {
    const { gateway, calls } = recordingGateway();
    const result = await new MailChannel(gateway).send(
      new NewUserNotification("Lucia"),
      who,
    );
    expect(result.status).toBe("sent");
    expect(calls).toContainEqual(["to", "lucia@example.com", "Lucia"]);
    expect(calls).toContainEqual(["subject", "Welcome"]);
  });

  it("skips when toMail is absent", async () => {
    const { gateway } = recordingGateway();
    const partial = new PartialNotification();
    // PartialNotification implements mail; build one without it instead:
    class NoMail extends Notification {
      readonly category = "transactional" as const;
      via(): ChannelName[] {
        return ["mail"];
      }
    }
    const result = await new MailChannel(gateway).send(new NoMail(), who);
    expect(result).toMatchObject({ status: "skipped", reason: "no-method" });
    void partial;
  });

  it("skips when no email is available", async () => {
    const { gateway } = recordingGateway();
    const result = await new MailChannel(gateway).send(
      new NewUserNotification(),
      { ...who, email: null },
    );
    expect(result).toMatchObject({ status: "skipped", reason: "no-contact" });
  });
});

describe("SmsChannel", () => {
  it("normalizes a class-style contract and addresses the phone", async () => {
    const { gateway, calls } = recordingGateway();
    const result = await new SmsChannel(gateway).send(
      new NewUserNotification("Lucia"),
      who,
    );
    expect(result.status).toBe("sent");
    expect(calls).toContainEqual(["to", "+5491155555555"]);
    expect(calls).toContainEqual(["content", "¡Bienvenido a Acme, Lucia!"]);
  });

  it("honors a contract `to` override", async () => {
    const { gateway, calls } = recordingGateway();
    class Override extends Notification {
      readonly category = "transactional" as const;
      via(): ChannelName[] {
        return ["sms"];
      }
      toSms() {
        return { body: "hi", to: "+5491100000000" };
      }
    }
    await new SmsChannel(gateway).send(new Override(), who);
    expect(calls).toContainEqual(["to", "+5491100000000"]);
  });
});

describe("PushChannel", () => {
  it("addresses the customer by id and forwards title/body/data", async () => {
    const { gateway, calls } = recordingGateway();
    await new PushChannel(gateway).send(new NewUserNotification("Lucia"), who);
    expect(calls).toContainEqual(["toUser", "cust-1"]);
    expect(calls).toContainEqual(["title", "Welcome"]);
    expect(calls).toContainEqual(["data", { kind: "welcome" }]);
  });
});

describe("WhatsAppChannel", () => {
  it("sends a freeform body", async () => {
    const { gateway, calls } = recordingGateway();
    class Wa extends Notification {
      readonly category = "transactional" as const;
      via(): ChannelName[] {
        return ["whatsapp"];
      }
      toWhatsApp() {
        return { body: "hola" };
      }
    }
    const result = await new WhatsAppChannel(gateway).send(new Wa(), who);
    expect(result.status).toBe("sent");
    expect(calls).toContainEqual(["to", "+5491155555555"]);
    expect(calls).toContainEqual(["content", "hola"]);
  });

  it("sends a template when provided", async () => {
    const { gateway, calls } = recordingGateway();
    class Wa extends Notification {
      readonly category = "transactional" as const;
      via(): ChannelName[] {
        return ["whatsapp"];
      }
      toWhatsApp() {
        return { template: { sid: "HX123", variables: { "1": "Lucia" } } };
      }
    }
    await new WhatsAppChannel(gateway).send(new Wa(), who);
    expect(calls).toContainEqual(["template", "HX123", { "1": "Lucia" }]);
  });
});

describe("RealtimeChannel", () => {
  it("defaults the room to customer:<id>", async () => {
    const { gateway, published } = fakeRealtime();
    const result = await new RealtimeChannel(gateway).send(
      new NewUserNotification(),
      who,
    );
    expect(result.status).toBe("sent");
    expect(published[0]).toEqual({
      room: "customer:cust-1",
      event: { event: "notification", data: { type: "welcome" } },
    });
  });
});

describe("DatabaseChannel", () => {
  it("persists with the notification's category injected", async () => {
    const repo = new StubDatabaseRepository();
    const result = await new DatabaseChannel(repo).send(
      new NewUserNotification(),
      who,
    );
    expect(result.status).toBe("sent");
    expect(repo.created[0]).toMatchObject({
      customerId: "cust-1",
      organizationId: ORG,
      type: "welcome",
      category: "transactional",
    });
    expect(result.response).toEqual({ id: "notif-1" });
  });
});
