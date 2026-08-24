export class LogError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "LogError";
    this.code = code;
  }
}

export class UnknownChannelError extends LogError {
  readonly channel: string;

  constructor(channel: string) {
    super(
      `Unknown log channel "${channel}". Make sure it is configured in the channels config`,
      "UNKNOWN_CHANNEL",
    );
    this.name = "UnknownChannelError";
    this.channel = channel;
  }
}

export class TransportError extends LogError {
  readonly transport: string;

  constructor(transport: string, message: string) {
    super(`[${transport}] ${message}`, "TRANSPORT_ERROR");
    this.name = "TransportError";
    this.transport = transport;
  }
}
