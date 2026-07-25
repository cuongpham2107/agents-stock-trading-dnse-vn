#!/usr/bin/env bun
/**
 * DNSE TradingAgents - Startup Script
 *
 * Usage:
 *   bun run start              # Chạy chatbot
 *   bun run start:all          # Chạy chatbot (alias)
 *   bun run start:firecrawl    # Chạy Firecrawl (Docker)
 *   bun run start:docker       # Chạy tất cả qua Docker
 */

import { $ } from "bun";
import { existsSync } from "fs";
import { resolve } from "path";

// ==================== CONFIG ====================

const PROJECT_ROOT = import.meta.dir;
const DOCKER_COMPOSE = resolve(PROJECT_ROOT, "docker-compose.yaml");

// Colors
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

function log(prefix: string, message: string, color: string = colors.cyan) {
  console.log(`${color}[${prefix}]${colors.reset} ${message}`);
}

function error(prefix: string, message: string) {
  console.error(`${colors.red}[${prefix}]${colors.reset} ${message}`);
}

// ==================== SERVICE STARTERS ====================

async function startAgent() {
  log("AGENT", "Đang khởi động Agent...", colors.green);

  const proc = Bun.spawn(["bun", "run", "src/index.ts"], {
    cwd: PROJECT_ROOT,
    stdout: "inherit",
    stderr: "inherit",
    env: { ...process.env },
  });

  log("AGENT", `PID: ${proc.pid}`, colors.green);
  return proc;
}

async function startFirecrawl() {
  log("FIRECRAWL", "Đang khởi động Firecrawl via Docker...", colors.magenta);

  if (!existsSync(DOCKER_COMPOSE)) {
    error("FIRECRAWL", "Không tìm thấy docker-compose.yaml.");
    process.exit(1);
  }

  try {
    await $`docker compose up -d`.cwd(PROJECT_ROOT);
    log("FIRECRAWL", "Đã khởi động Docker Compose!", colors.green);
  } catch (e) {
    error("FIRECRAWL", `Lỗi khi khởi động: ${e}`);
  }
}

async function startDockerAll() {
  log("DOCKER", "Đang khởi động tất cả services...", colors.magenta);

  if (!existsSync(DOCKER_COMPOSE)) {
    error("DOCKER", "Không tìm thấy docker-compose.yaml.");
    process.exit(1);
  }

  try {
    await $`docker compose up -d --build`.cwd(PROJECT_ROOT);
    log("DOCKER", "Đã khởi động tất cả services!", colors.green);
  } catch (e) {
    error("DOCKER", `Lỗi khi khởi động: ${e}`);
  }
}

// ==================== MAIN ====================

function printBanner() {
  console.log(`
${colors.cyan}╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║          DNSE TradingAgents - Startup Script                  ║
║                                                              ║
║  Hệ thống phân tích đầu tư đa agent cho thị trường VN       ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝${colors.reset}
`);
}

function printUsage() {
  console.log(`
${colors.yellow}Usage:${colors.reset}
  bun run start              Chạy chatbot
  bun run start:all          Chạy chatbot (alias)
  bun run start:firecrawl    Chạy Firecrawl (Docker)
  bun run start:docker       Chạy tất cả qua Docker
  bun run dev                Chạy với hot reload
`);
}

async function main() {
  printBanner();

  const args = process.argv.slice(2);
  const flag = args[0];

  if (flag === "--help" || flag === "-h") {
    printUsage();
    process.exit(0);
  }

  switch (flag) {
    case "--firecrawl":
      await startFirecrawl();
      break;

    case "--docker":
      await startDockerAll();
      break;

    default:
      // Chạy Agent
      const agentProc = await startAgent();

      // Xử lý shutdown
      process.on("SIGINT", () => {
        log("SYSTEM", "Đang tắt...", colors.yellow);
        agentProc.kill();
        process.exit(0);
      });

      process.on("SIGTERM", () => {
        log("SYSTEM", "Đang tắt...", colors.yellow);
        agentProc.kill();
        process.exit(0);
      });

      break;
  }
}

main();
