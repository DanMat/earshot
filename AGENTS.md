# AGENTS.md

Guidance for AI coding agents working in **earshot-scaffold**.

## Stack

- Language: TypeScript (strict)
- Module format: ESM
- Package manager: pnpm
- Bundler: tsup
- Tests: vitest
- Lint/format: biome

## Commands

- Type-check: `pnpm typecheck`
- Lint: `pnpm lint`
- Test: `pnpm test`
- Build: `pnpm build`

## Conventions

- Source lives in `src/`. Keep the public API in `src/index.ts`.
- Add or update tests for any behavior change.
- Prefer explicit types on exported functions; keep `strict` passing.
- Do not commit `dist/` or `node_modules/`.
