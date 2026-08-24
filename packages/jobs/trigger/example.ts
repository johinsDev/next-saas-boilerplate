import { logger, task } from "@trigger.dev/sdk/v3";

export const exampleTask = task({
  id: "example",
  maxDuration: 60,
  run: async (payload: { greeting?: string }) => {
    logger.info("hello from trigger.dev", { payload });
    return { ok: true, message: payload.greeting ?? "hi" };
  },
});
