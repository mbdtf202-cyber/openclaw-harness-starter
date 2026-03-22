# Contributing

This repository is meant to be a practical harness workspace, so contributions
should bias toward clarity and reproducibility.

## Local workflow

```bash
pnpm install --ignore-workspace
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm test:contracts
pnpm test:deps
pnpm test:fault
```

## Contribution guidelines

- Keep examples runnable
- Prefer public OpenClaw APIs over private internals
- Add or update tests when changing harness behavior
- Keep generated output deterministic
- Update `starter.manifest.json` whenever the scaffold file set changes
- Keep README, CI, and manifest aligned when promoting new harness capabilities
- Keep live and VM changes behind explicit scripts/workflows; do not make them implicit in PR-required lanes

## Typical contribution types

- new message scenario examples
- new CLI output capture examples
- plugin or channel contract helpers
- dependency/fault harness helpers
- live roundtrip drivers
- VM wrapper improvements
- CI improvements for harness repos

## Pull requests

Good PRs usually include:

- a short problem statement
- the harness layer being changed
- before/after behavior
- test evidence
