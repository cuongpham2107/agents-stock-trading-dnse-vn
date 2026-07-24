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

import { spawn, type ChildProcess } from "child_process";
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

// ==================== PROCESS MANAGEMENT ====================

const processes: ChildProcess[] = [];

function cleanup() {
  log("SYSTEM", "Shutting down all services...", colors.yellow);
  for (const proc of processes) {
    if (proc.pid && !proc.killed) {
      proc.kill("SIGTERM");
    }
  }
  setTimeout(() => {
    for (const proc of processes) {
      if (proc.pid && !proc.killed) {
        proc.kill("SIGKILL");
      }
    }
    process.exit(0);
  }, 2000);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

// ==================== SERVICE STARTERS ====================

function startMCP(): ChildProcess {
  log("MCP", "Starting MCP Server...", colors.blue);

  if (!existsSync(resolve(MCP_DIR, "package.json"))) {
    error("MCP", "package.json not found. Run 'bun install' first.");
    process.exit(1);
  }

  const proc = spawn("bun", ["run", "start"], {
    cwd: MCP_DIR,
    stdio: "pipe",
    env: { ...process.env },
  });

  proc.stdout?.on("data", (data) => {
    log("MCP", data.toString().trim(), colors.blue);
  });

  proc.stderr?.on("data", (data) => {
    log("MCP", data.toString().trim(), colors.blue);
  });

  proc.on("error", (err) => {
    error("MCP", `Failed to start: ${err.message}`);
  });

  proc.on("exit", (code) => {
    log("MCP", `Process exited with code ${code}`, colors.yellow);
  });

  processes.push(proc);
  return proc;
}

function startAgent(): ChildProcess {
  log("AGENT", "Starting Agent...", colors.green);

  if (!existsSync(resolve(AGENT_DIR, "package.json"))) {
    error("AGENT", "package.json not found. Run 'bun install' first.");
    process.exit(1);
  }

  const proc = spawn("bun", ["run", "start"], {
    cwd: AGENT_DIR,
    stdio: "pipe",
    env: { ...process.env },
  });

  proc.stdout?.on("data", (data) => {
    log("AGENT", data.toString().trim(), colors.green);
  });

  proc.stderr?.on("data", (data) => {
    log("AGENT", data.toString().trim(), colors.green);
  });

  proc.on("error", (err) => {
    error("AGENT", `Failed to start: ${err.message}`);
  });

  proc.on("exit", (code) => {
    log("AGENT", `Process exited with code ${code}`, colors.yellow);
  });

  processes.push(proc);
  return proc;
}

function startFirecrawl(): ChildProcess {
  log("FIRECRAWL", "Starting Firecrawl via Docker Compose...", colors.magenta);

  if (!existsSync(DOCKER_COMPOSE)) {
    error("FIRECRAWL", "docker-compose.yaml not found.");
    process.exit(1);
  }

  const proc = spawn("docker", ["compose", "up", "-d"], {
    cwd: PROJECT_ROOT,
    stdio: "pipe",
  });

  proc.stdout?.on("data", (data) => {
    log("FIRECRAWL", data.toString().trim(), colors.magenta);
  });

  proc.stderr?.on("data", (data) => {
    log("FIRECRAWL", data.toString().trim(), colors.magenta);
  });

  proc.on("error", (err) => {
    error("FIRECRAWL", `Failed to start: ${err.message}`);
  });

  proc.on("exit", (code) => {
    if (code === 0) {
      log("FIRECRAWL", "Docker Compose started successfully!", colors.green);
    } else {
      error("FIRECRAWL", `Docker Compose exited with code ${code}`);
    }
  });

  processes.push(proc);
  return proc;
}

function startDockerAll(): ChildProcess {
  log("DOCKER", "Starting all services via Docker Compose...", colors.magenta);

  if (!existsSync(DOCKER_COMPOSE)) {
    error("DOCKER", "docker-compose.yaml not found.");
    process.exit(1);
  }

  const proc = spawn("docker", ["compose", "up", "-d", "--build"], {
    cwd: PROJECT_ROOT,
    stdio: "pipe",
  });

  proc.stdout?.on("data", (data) => {
    log("DOCKER", data.toString().trim(), colors.magenta);
  });

  proc.stderr?.on("data", (data) => {
    log("DOCKER", data.toString().trim(), colors.magenta);
  });

  proc.on("error", (err) => {
    error("DOCKER", `Failed to start: ${err.message}`);
  });

  proc.on("exit", (code) => {
    if (code === 0) {
      log("DOCKER", "All services started!", colors.green);
    } else {
      error("DOCKER", `Docker Compose exited with code ${code}`);
    }
  });

  processes.push(proc);
  return proc;
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
      startMCP();
      break;

    case "--agent":
      startAgent();
      break;

    case "--firecrawl":
      startFirecrawl();
      break;

    case "--docker":
      startDockerAll();
      break;

    default:
      // Start MCP + Agent
      log("SYSTEM", "Starting all services...", colors.cyan);
      startMCP();

      // Wait 3s for MCP to initialize
      setTimeout(() => {
        startAgent();
      }, 3000);
      break;
  }

  // Keep process alive
  await new Promise(() => {});
}

main();
