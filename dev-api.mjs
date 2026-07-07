/**
 * Dev wrapper: run the API with tsx, restart on .env changes — so the
 * API can never lag behind a Vite env-triggered restart (the ports must
 * move together; see .env.example).
 */

import { spawn } from "node:child_process";
import { existsSync, watch } from "node:fs";

let child = null;
let restarting = false;

function start() {
  child = spawn("npx", ["tsx", "server.ts"], { stdio: "inherit" });
  child.on("exit", (code) => {
    if (restarting) return;
    process.exit(code ?? 0);
  });
}

function restart() {
  if (!child) return start();
  restarting = true;
  child.once("exit", () => {
    restarting = false;
    start();
  });
  child.kill();
}

start();

if (existsSync(".env")) {
  let debounce = null;
  watch(".env", () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      console.log("\x1b[35m[dev-api] .env changed — restarting API\x1b[0m");
      restart();
    }, 150);
  });
}

process.on("SIGINT", () => {
  child?.kill();
  process.exit(0);
});
