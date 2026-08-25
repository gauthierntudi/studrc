#!/usr/bin/env node
/**
 * Empêche nest/next de relancer en boucle après un crash
 * (des centaines de process node → Jetsam / crash WindowServer).
 */
import { spawn } from "node:child_process";

const DELAY_MS = 8_000;
const MAX_CRASHES = 3;
const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error("usage: node scripts/dev-with-backoff.mjs <cmd> [...args]");
  process.exit(1);
}

let crashes = 0;
let child = null;
let shuttingDown = false;

function run() {
  child = spawn(command, args, {
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_OPTIONS: [
        process.env.NODE_OPTIONS,
        "--max-old-space-size=1536",
      ]
        .filter(Boolean)
        .join(" "),
    },
  });

  child.on("exit", (code, signal) => {
    child = null;
    if (shuttingDown) {
      process.exit(code ?? (signal ? 1 : 0));
    }
    if (code === 0) {
      process.exit(0);
    }
    crashes += 1;
    if (crashes >= MAX_CRASHES) {
      console.error(
        `\n[dev-with-backoff] arrêté après ${MAX_CRASHES} crashs (code ${code}). Relance manuelle uniquement — évite de saturer la RAM.`,
      );
      process.exit(code || 1);
    }
    console.error(
      `\n[dev-with-backoff] crash ${crashes}/${MAX_CRASHES}. Pause ${DELAY_MS / 1000}s avant relance…`,
    );
    setTimeout(run, DELAY_MS);
  });
}

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  if (child) {
    child.kill("SIGTERM");
    return;
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

run();
