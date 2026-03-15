# Contributing

This repository is meant to be a practical harness workspace, so contributions
should bias toward clarity and reproducibility.

## Local workflow

```bash
pnpm install
pnpm test
```

## Contribution guidelines

- Keep examples runnable
- Prefer public OpenClaw APIs over private internals
- Add or update tests when changing harness behavior
- Keep generated output deterministic

## Typical contribution types

- new message scenario examples
- new CLI output capture examples
- plugin or channel contract helpers
- CI improvements for harness repos

## Pull requests

Good PRs usually include:

- a short problem statement
- the harness layer being changed
- before/after behavior
- test evidence
