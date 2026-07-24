# AGENTS.md

## Runtime & Toolchain

- **Runtime:** Bun (not Node.js)
- **Language:** TypeScript with `verbatimModuleSyntax: true`
- **Import convention:** Use `.ts` extensions for local imports (Bun resolves them). External packages keep their natural import paths.
- **Type check:** `bun run tsc --noEmit`
- **No build step:** Bun runs `.ts` directly

## Quick Commands

```bash
bun install              # Install dependencies
bun run start            # Run main agent (CLI chatbot)
bun run start.ts         # Run all services (MCP + Agent)
bun run start.ts --mcp   # Run MCP server only
bun run start.ts --agent # Run agent only
bun run tsc --noEmit     # Type check
```

## Architecture

```
src/
├── index.ts              # Entry point - CLI chatbot
├── tools/
│   ├── dnse/server.ts    # Shared DNSE API client (HMAC auth)
│   ├── market-data/      # 10 DNSE market data tools
│   ├── trading/          # Placeholder - not implemented yet
│   ├── account/          # Placeholder - not implemented yet
│   └── web/              # Tavily + Firecrawl tools
├── agents/               # Analysts, Researchers, Managers
├── graph/trading-graph.ts # LangGraph state machine
├── llm/                  # Multi-provider LLM (6 providers)
├── memory/               # Decision logs + checkpoint
└── prompts.ts            # System prompts
```

## Key Patterns

**Tool groups:** market-data, trading (placeholder), account (placeholder), web
**LLM tiers:** `quick` (analysts, researchers) vs `deep` (research manager, portfolio manager)
**Providers:** NVIDIA NIM, OpenAI, Anthropic, Google, Ollama, DeepSeek
**Graph flow:** Analysts → Bull/Bear Debate → Research Manager → Trader → Risk Debate → Portfolio Manager

## Environment

Required in `.env`:
- `DNSE_API_KEY`, `DNSE_API_SECRET` - DNSE OpenAPI credentials
- `LLM_API_KEY` or `NVIDIA_API_KEY` - LLM provider key
- `TAVILY_API_KEY` (optional) - For web search
- `FIRECRAWL_API_URL` (optional) - Default `http://localhost:3002`

## Gotchas

- `src/mcp/` and `src/mcp-client.ts` are excluded from type checking (reserved for standalone MCP project)
- `firecrawl/` directory is a git submodule, excluded from `.gitignore`
- `mcp-standalone/` is a separate MCP project, not part of main build
- SQLite checkpoints saved to `checkpoints.db` (gitignored)
- Memory logs saved to `.memory/` directory
