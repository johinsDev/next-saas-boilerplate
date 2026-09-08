// Waits until the local libSQL server (`sqld`) accepts TCP connections.
// Used by the compose `migrate` one-shot and by host-run
// `db:migrate:docker` so the migration doesn't race the container.
//
// Usage: bun run scripts/db/wait-for-libsql.ts [host] [port] [timeoutMs]

const host = process.argv[2] ?? "localhost";
const port = Number(process.argv[3] ?? 8080);
const timeoutMs = Number(process.argv[4] ?? 60_000);

const deadline = Date.now() + timeoutMs;

async function tryConnect(): Promise<boolean> {
  try {
    const socket = await Bun.connect({
      hostname: host,
      port,
      socket: { data() {}, error() {} },
    });
    socket.end();
    return true;
  } catch {
    return false;
  }
}

while (Date.now() < deadline) {
  if (await tryConnect()) {
    console.info(`✓ libSQL reachable at ${host}:${port}`);
    process.exit(0);
  }
  await Bun.sleep(1000);
}

console.error(`✗ libSQL not reachable at ${host}:${port} within ${timeoutMs}ms`);
process.exit(1);
