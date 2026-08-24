import { describe, expect, it } from "vitest";
import { fakeRecord, resetFakeRecordCounter } from "../factories";
import { FakeLogger } from "../fake-logger";

describe("FakeLogger", () => {
  it("captures every record passed to write()", () => {
    resetFakeRecordCounter();
    const fake = new FakeLogger();
    fake.write(fakeRecord({ level: "info", msg: "a" }));
    fake.write(fakeRecord({ level: "error", msg: "b" }));
    expect(fake.records).toHaveLength(2);
  });

  it("recordsForLevel() filters by level", () => {
    const fake = new FakeLogger();
    fake.write(fakeRecord({ level: "info", msg: "i" }));
    fake.write(fakeRecord({ level: "error", msg: "e" }));
    expect(fake.recordsForLevel("error")).toHaveLength(1);
  });

  it("assertLogged matches by level + literal msg", () => {
    const fake = new FakeLogger();
    fake.write(fakeRecord({ level: "warn", msg: "watch out" }));
    expect(() => fake.assertLogged({ level: "warn", msg: "watch out" })).not.toThrow();
  });

  it("assertLogged supports regex msg matchers", () => {
    const fake = new FakeLogger();
    fake.write(fakeRecord({ level: "info", msg: "user 123 created" }));
    expect(() => fake.assertLogged({ msg: /user \d+ created/ })).not.toThrow();
  });

  it("assertLogged matches by bindings subset", () => {
    const fake = new FakeLogger();
    fake.write(
      fakeRecord({
        level: "info",
        msg: "hit",
        bindings: { userId: "u1", route: "/api" },
      }),
    );
    expect(() => fake.assertLogged({ bindings: { userId: "u1" } })).not.toThrow();
  });

  it("assertLogged matches by error class", () => {
    class CustomError extends Error {}
    const fake = new FakeLogger();
    fake.write(fakeRecord({ level: "error", err: new CustomError("boom") }));
    expect(() => fake.assertLogged({ err: CustomError })).not.toThrow();
  });

  it("assertLogged throws when nothing matches", () => {
    const fake = new FakeLogger();
    fake.write(fakeRecord({ level: "info", msg: "hi" }));
    expect(() => fake.assertLogged({ level: "error" })).toThrow(/Expected a log record/);
  });

  it("assertNotLogged throws when something does match", () => {
    const fake = new FakeLogger();
    fake.write(fakeRecord({ level: "info", msg: "hi" }));
    expect(() => fake.assertNotLogged({ level: "info" })).toThrow(/Did not expect/);
  });

  it("assertLoggedCount supports numeric and criteria forms", () => {
    const fake = new FakeLogger();
    fake.write(fakeRecord({ level: "info", msg: "a" }));
    fake.write(fakeRecord({ level: "info", msg: "b" }));
    fake.write(fakeRecord({ level: "error", msg: "c" }));

    expect(() => fake.assertLoggedCount(3)).not.toThrow();
    expect(() => fake.assertLoggedCount({ level: "info" }, 2)).not.toThrow();
    expect(() => fake.assertLoggedCount({ level: "error" }, 5)).toThrow();
  });

  it("assertNothingLogged passes only when empty", () => {
    const fake = new FakeLogger();
    expect(() => fake.assertNothingLogged()).not.toThrow();
    fake.write(fakeRecord({ level: "info", msg: "noise" }));
    expect(() => fake.assertNothingLogged()).toThrow();
  });

  it("clear() empties captured records", () => {
    const fake = new FakeLogger();
    fake.write(fakeRecord({ level: "info" }));
    fake.clear();
    expect(fake.records).toHaveLength(0);
  });
});
