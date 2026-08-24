import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "turso",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
  casing: "snake_case",
  strict: true,
  verbose: true,
});
