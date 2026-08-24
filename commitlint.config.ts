import type { UserConfig } from "@commitlint/types";

const config: UserConfig = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [
      2,
      "always",
      [
        "admin", "web", "mobile", "api", "services", "auth", "db", "ui",
        "analytics", "cache", "date", "email", "feature-flags", "jobs", "log",
        "notifications", "push", "rate-limit", "realtime", "shortlinks", "sms",
        "storage", "whatsapp", "tooling", "ci", "deps", "repo",
      ],
    ],
    "subject-case": [2, "never", ["pascal-case", "upper-case"]],
  },
};

export default config;
