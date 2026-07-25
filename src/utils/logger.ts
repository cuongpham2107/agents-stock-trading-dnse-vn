// ==================== LOGGER ====================

const COLORS = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
};

const ICONS = {
  start: "▶",
  done: "✔",
  error: "✘",
  info: "ℹ",
  warn: "⚠",
  step: "→",
  bullet: "•",
  arrow: "▸",
};

type LogLevel = "info" | "success" | "error" | "warn" | "debug";

function timestamp(): string {
  return new Date().toLocaleTimeString("vi-VN", { hour12: false });
}

function formatMessage(level: LogLevel, prefix: string, message: string): string {
  const time = `${COLORS.gray}${timestamp()}${COLORS.reset}`;
  const icon = COLORS[level === "success" ? "green" : level === "error" ? "red" : level === "warn" ? "yellow" : "cyan"];

  return `${time} ${icon}${ICONS[level === "success" ? "done" : level === "error" ? "error" : level === "warn" ? "warn" : "info"]}${COLORS.reset} [${COLORS.bold}${prefix}${COLORS.reset}] ${message}`;
}

// ==================== MAIN LOGGER ====================

export const logger = {
  info(prefix: string, message: string) {
    console.log(formatMessage("info", prefix, message));
  },

  success(prefix: string, message: string) {
    console.log(formatMessage("success", prefix, message));
  },

  error(prefix: string, message: string) {
    console.error(formatMessage("error", prefix, message));
  },

  warn(prefix: string, message: string) {
    console.warn(formatMessage("warn", prefix, message));
  },

  debug(prefix: string, message: string) {
    if (process.env.DEBUG) {
      console.log(formatMessage("debug", prefix, message));
    }
  },
};

// ==================== GRAPH LOGGER ====================

export const graphLogger = {
  nodeStart(name: string, details?: string) {
    const detail = details ? ` ${COLORS.dim}(${details})${COLORS.reset}` : "";
    console.log(`${COLORS.cyan}${ICONS.start}${COLORS.reset} ${COLORS.bold}${name}${COLORS.reset}${detail}`);
  },

  nodeDone(name: string, duration?: number) {
    const time = duration ? ` ${COLORS.gray}${duration}ms${COLORS.reset}` : "";
    console.log(`${COLORS.green}${ICONS.done}${COLORS.reset} ${name}${time}`);
  },

  nodeError(name: string, error: string) {
    console.log(`${COLORS.red}${ICONS.error}${COLORS.reset} ${name}: ${COLORS.red}${error}${COLORS.reset}`);
  },

  step(message: string) {
    console.log(`  ${COLORS.dim}${ICONS.arrow} ${message}${COLORS.reset}`);
  },

  progress(current: number, total: number, message: string) {
    const bar = "█".repeat(Math.floor((current / total) * 20));
    const empty = "░".repeat(20 - Math.floor((current / total) * 20));
    console.log(`  ${COLORS.cyan}[${bar}${empty}]${COLORS.reset} ${current}/${total} - ${message}`);
  },

  section(title: string) {
    console.log(`\n${COLORS.bold}${COLORS.cyan}${"═".repeat(50)}${COLORS.reset}`);
    console.log(`${COLORS.bold}${COLORS.cyan}  ${title}${COLORS.reset}`);
    console.log(`${COLORS.bold}${COLORS.cyan}${"═".repeat(50)}${COLORS.reset}\n`);
  },
};

// ==================== ANALYSIS LOGGER ====================

export function logAnalysisStart(ticker: string) {
  console.log(`
${COLORS.bold}${COLORS.cyan}╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║  ${COLORS.white}📊 PHÂN TÍCH: ${COLORS.green}${ticker.toUpperCase()}${COLORS.cyan}                                       ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝${COLORS.reset}
`);
}

export function logAnalysisStep(step: number, total: number, name: string) {
  graphLogger.progress(step, total, name);
}

export function logAnalysisResult(ticker: string, result: string) {
  console.log(`
${COLORS.bold}${COLORS.green}╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║  ${COLORS.white}📋 KẾT QUẢ: ${COLORS.green}${ticker.toUpperCase()}${COLORS.green}                                       ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝${COLORS.reset}

${result}
`);
}

export function logAnalysisError(ticker: string, error: string) {
  console.log(`
${COLORS.bold}${COLORS.red}╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║  ${COLORS.white}❌ LỖI: ${COLORS.red}${ticker.toUpperCase()}${COLORS.red}                                          ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝${COLORS.reset}

${COLORS.red}${error}${COLORS.reset}
`);
}

// ==================== TABLE LOGGER ====================

export function logTable(headers: string[], rows: string[][]) {
  const colWidths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] || "").length))
  );

  const headerLine = headers.map((h, i) => h.padEnd(colWidths[i] || 0)).join(" │ ");
  const separator = colWidths.map((w) => "─".repeat(w || 0)).join("─┼─");

  console.log(`${COLORS.bold}${headerLine}${COLORS.reset}`);
  console.log(separator);

  for (const row of rows) {
    console.log(row.map((c, i) => (c || "").padEnd(colWidths[i] || 0)).join(" │ "));
  }
}

// ==================== RESULT LOGGER ====================

export function logNodeResult(nodeName: string, result: string, maxLen: number = 150) {
  const truncated = result.length > maxLen ? result.substring(0, maxLen) + "..." : result;
  console.log(`  ${COLORS.gray}└─ Result: ${truncated}${COLORS.reset}`);
}

export function logNodeSummary(nodeName: string, data: Record<string, unknown>) {
  const keys = Object.keys(data).filter(k => data[k] && data[k] !== "");
  if (keys.length > 0) {
    console.log(`  ${COLORS.gray}└─ Fields: ${keys.join(", ")}${COLORS.reset}`);
  }
}
