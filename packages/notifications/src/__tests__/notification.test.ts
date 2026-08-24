import { describe, expect, it } from "vitest";
import {
  isChannelMessage,
  normalizeContract,
} from "../messages/base-channel-message";
import type { NotificationRenderers } from "../notification";
import { NewUserNotification, PartialNotification, notifiable } from "../test-fixtures";

describe("Notification", () => {
  it("via() returns the declared channels", async () => {
    const channels = await new NewUserNotification().via(notifiable());
    expect(channels).toEqual(["mail", "sms", "push", "database", "realtime"]);
  });

  it("omitting a toX() leaves the method undefined", () => {
    const n = new PartialNotification() as NotificationRenderers;
    expect(typeof n.toMail).toBe("function");
    expect(n.toSms).toBeUndefined();
  });

  it("a class-style toSms() is recognized + normalized to a contract", async () => {
    const n = new NewUserNotification("Lucia");
    const ret = n.toSms();
    expect(isChannelMessage(ret)).toBe(true);
    const contract = await normalizeContract(ret);
    expect(contract).toEqual({ body: "¡Bienvenido a Acme, Lucia!" });
  });

  it("normalizeContract passes plain objects through unchanged", async () => {
    const contract = await normalizeContract({ body: "plain" });
    expect(contract).toEqual({ body: "plain" });
  });
});
