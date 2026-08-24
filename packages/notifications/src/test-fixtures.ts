import type {
  AdminDatabaseNotificationInput,
  DatabaseNotificationInput,
} from "./channels/database";
import { BaseChannelMessage } from "./messages/base-channel-message";
import type { SmsContract } from "./messages/contracts";
import { Notification, type NotificationRenderers } from "./notification";
import type { NotifiableRepository } from "./notifiable";
import type { PreferencesRepository } from "./preferences";
import type {
  ChannelName,
  CustomerNotifiable,
  Notifiable,
  ResolvedCustomerNotifiable,
  ResolvedUserNotifiable,
  UserNotifiable,
} from "./types";

export const ORG = "org-1";

export function notifiable(
  overrides: Partial<CustomerNotifiable> = {},
): CustomerNotifiable {
  return {
    customerId: "cust-1",
    organizationId: ORG,
    phone: "+5491155555555",
    email: "lucia@example.com",
    name: "Lucia",
    ...overrides,
  };
}

/** A staff recipient (admin alerts). Phone defaults to null on purpose. */
export function userNotifiable(
  overrides: Partial<UserNotifiable> = {},
): UserNotifiable {
  return {
    kind: "user",
    userId: "user-1",
    organizationId: ORG,
    storeId: null,
    phone: null,
    email: "duena@example.com",
    name: "Dueña",
    ...overrides,
  };
}

export class StubNotifiableRepository implements NotifiableRepository {
  constructor(
    private readonly rows: Record<string, ResolvedCustomerNotifiable>,
    private readonly users: Record<string, ResolvedUserNotifiable> = {},
  ) {}
  async resolve(
    customerId: string,
    organizationId: string,
  ): Promise<ResolvedCustomerNotifiable | null> {
    const row = this.rows[customerId];
    if (!row || row.organizationId !== organizationId) return null;
    return row;
  }
  async resolveUser(
    userId: string,
    organizationId: string,
  ): Promise<ResolvedUserNotifiable | null> {
    const row = this.users[userId];
    if (!row || row.organizationId !== organizationId) return null;
    return row;
  }
}

export class StubPreferencesRepository implements PreferencesRepository {
  constructor(private readonly optedOut: Set<ChannelName> = new Set()) {}
  async optedOutChannels(): Promise<Set<ChannelName>> {
    return new Set(this.optedOut);
  }
}

/** Records the captured builder method calls as [method, ...args] tuples. */
export function recordingGateway() {
  const calls: Array<[string, ...unknown[]]> = [];
  return {
    calls,
    gateway: {
      // biome-ignore lint/suspicious/noExplicitAny: test builder is intentionally untyped
      async send(callback: (m: any) => void | Promise<void>) {
        const builder = new Proxy(
          {},
          {
            get(_t, prop) {
              return (...args: unknown[]) => {
                calls.push([String(prop), ...args]);
                return builder;
              };
            },
          },
        );
        await callback(builder);
        return { status: "sent", provider: "fake" };
      },
    },
  };
}

export function fakeRealtime() {
  const published: Array<{ room: string; event: unknown }> = [];
  return {
    published,
    gateway: {
      async publish(
        room: `customer:${string}` | `org:${string}`,
        event: { event: string; data: Record<string, unknown> },
      ): Promise<void> {
        published.push({ room, event });
      },
    },
  };
}

export class StubDatabaseRepository {
  readonly created: DatabaseNotificationInput[] = [];
  #seq = 0;
  async create(input: DatabaseNotificationInput): Promise<{ id: string }> {
    this.created.push(input);
    this.#seq += 1;
    return { id: `notif-${this.#seq}` };
  }
}

export class StubAdminDatabaseRepository {
  readonly created: AdminDatabaseNotificationInput[] = [];
  #seq = 0;
  async create(input: AdminDatabaseNotificationInput): Promise<{ id: string }> {
    this.created.push(input);
    this.#seq += 1;
    return { id: `admin-notif-${this.#seq}` };
  }
}

// --- Sample notifications ------------------------------------------------

class NewUserSms extends BaseChannelMessage<SmsContract> {
  constructor(private readonly name: string) {
    super();
  }
  toContract(): SmsContract {
    return { body: `¡Bienvenido a Acme, ${this.name}!` };
  }
}

export class NewUserNotification
  extends Notification
  implements NotificationRenderers
{
  readonly category = "transactional" as const;
  constructor(private readonly name = "Lucia") {
    super();
  }
  via(_notifiable: Notifiable): ChannelName[] {
    return ["mail", "sms", "push", "database", "realtime"];
  }
  toMail() {
    return { subject: "Welcome", html: `<p>Hi ${this.name}</p>` };
  }
  // Class-style return (requirement 13).
  toSms() {
    return new NewUserSms(this.name);
  }
  toPush() {
    return { title: "Welcome", body: `Hi ${this.name}`, data: { kind: "welcome" } };
  }
  toDatabase() {
    return { type: "welcome", title: "Welcome", body: "Glad you're here" };
  }
  toRealtime() {
    return { event: "notification", data: { type: "welcome" } };
  }
}

export class PromoNotification
  extends Notification
  implements NotificationRenderers
{
  readonly category = "marketing" as const;
  via(): ChannelName[] {
    return ["mail", "sms", "push"];
  }
  toMail() {
    return { subject: "2x1 hoy", html: "<p>2x1</p>" };
  }
  toSms() {
    return { body: "2x1 en bubble tea hoy 🧋" };
  }
  toPush() {
    return { title: "2x1", body: "Solo hoy" };
  }
}

/** Declares a channel it does not implement (to exercise no-method). */
export class PartialNotification
  extends Notification
  implements NotificationRenderers
{
  readonly category = "transactional" as const;
  via(): ChannelName[] {
    return ["mail", "sms"];
  }
  toMail() {
    return { subject: "Hi", html: "<p>Hi</p>" };
  }
  // no toSms
}
