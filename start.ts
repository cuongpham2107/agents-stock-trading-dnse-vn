#!/usr/bin/env bun
/**
 * DNSE TradingAgents - Startup Script
 *
 * Usage:
 *   bun run start.ts              # Start all services
 *   bun run start.ts --mcp        # Start only MCP Server
 *   bun run start.ts --agent      # Start only Agent
 *   bun run start.ts --firecrawl  # Start only Firecrawl (Docker)
 *   bun run start.ts --docker     # Start all via Docker Compose
 */

import { $ } from "bun";
import { existsSync } from "fs";
import { resolve } from "path";

// ==================== CONFIG ====================

const PROJECT_ROOT = import.meta.dir;
const MCP_DIR = resolve(PROJECT_ROOT, "mcp");
const AGENT_DIR = resolve(PROJECT_ROOT, "agent");
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

async function startMCP() {
  log("MCP", "Starting MCP Server...", colors.blue);

  if (!existsSync(resolve(MCP_DIR, "package.json"))) {
    error("MCP", "package.json not found. Run 'bun install' first.");
    process.exit(1);
  }

  const proc = Bun.spawn(["bun", "run", "start"], {
    cwd: MCP_DIR,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env },
  });

  // Read stdout
  const reader = proc.stdout.getReader();
  const decoder = new TextDecoder();

  (async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      log("MCP", decoder.decode(value).trim(), colors.blue);
    }
  })();

  // Read stderr
  const stderrReader = proc.stderr.getReader();
  (async () => {
    while (true) {
      const { done, value } = await stderrReader.read();
      if (done) break;
      log("MCP", decoder.decode(value).trim(), colors.blue);
    }
  })();

  log("MCP", `Started with PID: ${proc.pid}`, colors.green);
  return proc;
}

async function startAgent() {
  log("AGENT", "Starting Agent...", colors.green);

  if (!existsSync(resolve(AGENT_DIR, "package.json"))) {
    error("AGENT", "package.json not found. Run 'bun install' first.");
    process.exit(1);
  }

  const proc = Bun.spawn(["bun", "run", "start"], {
    cwd: AGENT_DIR,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env },
  });

  // Read stdout
  const reader = proc.stdout.getReader();
  const decoder = new TextDecoder();

  (async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      log("AGENT", decoder.decode(value).trim(), colors.green);
    }
  })();

  // Read stderr
  const stderrReader = proc.stderr.getReader();
  (async () => {
    while (true) {
      const { done, value } = await stderrReader.read();
      if (done) break;
      log("AGENT", decoder.decode(value).trim(), colors.green);
    }
  })();

  log("AGENT", `Started with PID: ${proc.pid}`, colors.green);
  return proc;
}

async function startFirecrawl() {
  log("FIRECRAWL", "Starting Firecrawl via Docker Compose...", colors.magenta);

  if (!existsSync(DOCKER_COMPOSE)) {
    error("FIRECRAWL", "docker-compose.yaml not found.");
    process.exit(1);
  }

  try {
    await $`docker compose up -d`.cwd(PROJECT_ROOT);
    log("FIRECRAWL", "Docker Compose started successfully!", colors.green);
  } catch (e) {
    error("FIRECRAWL", `Failed to start: ${e}`);
  }
}

async function startDockerAll() {
  log("DOCKER", "Starting all services via Docker Compose...", colors.magenta);

  if (!existsSync(DOCKER_COMPOSE)) {
    error("DOCKER", "docker-compose.yaml not found.");
    process.exit(1);
  }

  try {
    await $`docker compose up -d --build`.cwd(PROJECT_ROOT);
    log("DOCKER", "All services started!", colors.green);
  } catch (e) {
    error("DOCKER", `Failed to start: ${e}`);
  }
}

// ==================== MAIN ====================

function printBanner() {
  console.log(`
${colors.cyan}╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║          DNSE TradingAgents - Startup Script                  ║
║                                                              ║
║  Multi-agent stock trading system for Vietnamese market      ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝${colors.reset}
`);
}

function printUsage() {
  console.log(`
${colors.yellow}Usage:${colors.reset}
  bun run start.ts              Start all services (MCP + Agent)
  bun run start.ts --mcp        Start only MCP Server
  bun run start.ts --agent      Start only Agent
  bun run start.ts --firecrawl  Start only Firecrawl (Docker)
  bun run start.ts --docker     Start all via Docker Compose
  bun run start.ts --help       Show this help
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
    case "--mcp":
      await startMCP();
      break;

    case "--agent":
      await startAgent();
      break;

    case "--firecrawl":
      await startFirecrawl();
      break;

    case "--docker":
      await startDockerAll();
      break;

    default:
      // Start MCP + Agent
      log("SYSTEM", "Starting all services...", colors.cyan);
      const mcpProc = await startMCP();

      // Wait 3s for MCP to initialize
      log("SYSTEM", "Waiting 3s for MCP to initialize...", colors.yellow);
      await new Promise((r) => setTimeout(r, 3000));

      const agentProc = await startAgent();

      // Handle shutdown
      process.on("SIGINT", () => {
        log("SYSTEM", "Shutting down...", colors.yellow);
        mcpProc.kill();
        agentProc.kill();
        process.exit(0);
      });

      process.on("SIGTERM", () => {
        log("SYSTEM", "Shutting down...", colors.yellow);
        mcpProc.kill();
        agentProc.kill();
        process.exit(0);
      });

      break;
  }

  // Keep process alive for non-docker commands
  if (flag !== "--firecrawl" && flag !== "--docker") {
    await new Promise(() => {});
  }
}

main();
