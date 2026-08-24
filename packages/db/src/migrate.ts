import { createClient } from "@libsql/client/web";
import { drizzle } from "drizzle-orm/libsql/web";
import { migrate } from "drizzle-orm/libsql/migrator";

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error("DATABASE_URL is not set");
}

const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
const db = drizzle(client);

await migrate(db, { migrationsFolder: "./migrations" });

console.info("Migrations applied successfully");
