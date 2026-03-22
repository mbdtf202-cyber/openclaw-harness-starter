# OpenClaw Harness Framework

Framework-authoring repository for building reusable OpenClaw harnesses.

This repository still serves as the source for `openclaw harness init`, but it
is no longer just a minimal starter. It now carries the layered harness
surfaces, CI lanes, and release process that the starter is generated from.

## What this repo is for

Use this repo when you need to author or extend harnesses for:

- fast scenario and CLI output tests
- Gateway HTTP / WS / ACP smoke coverage
- protocol contract fixtures
- containerized dependency harnesses
- fault injection and retry/idempotency probes
- secret-gated live channel roundtrips
- Parallels VM smoke wrappers

The generated starter remains self-contained. The framework repo is where the
authoring-level helpers, workflows, and release contract live.

## Layered harness model

### Fast local layers

- `pnpm test`
  - message scenario harnesses
  - CLI output harnesses
  - helper unit tests
- `pnpm test:contracts`
  - Pact-style fixture verification for Gateway WS and ACP message shapes

### Real-process and dependency layers

- `pnpm test:e2e`
  - real Gateway process boot
  - real Gateway WS `chat.send`
  - real ACP bridge session
- `pnpm test:deps`
  - WireMock record/replay and stateful behavior
  - MockServer expectations
- `pnpm test:fault`
  - Toxiproxy latency, reset, unavailable-path recovery
  - retry and visible-delivery coalescing examples

### Secret-gated live layers

- `pnpm test:live:discord`
- `pnpm test:live:telegram`
- `pnpm test:live:slack`
- `pnpm test:live:mattermost`
- `pnpm test:live`

All live lanes follow the same runner contract:

1. send outbound nonce through OpenClaw
2. observe the outbound message externally
3. inject an inbound reply externally
4. confirm readback from the OpenClaw-facing side via transcripts
5. clean up temporary messages

The Telegram lane uses `send-ack` as its outbound observation mode because the
Bot API does not provide the same general-purpose history reads as the other
channels.

### VM layers

- `pnpm test:vm:macos`
- `pnpm test:vm:windows`
- `pnpm test:vm:linux`
- `pnpm test:vm`

These are wrappers around the main OpenClaw repo's Parallels smoke scripts. VM
lanes are intentionally scoped to install/upgrade/onboard/gateway/first-turn
coverage. Only the macOS lane is expected to carry the representative Discord
roundtrip.

## Repository layout

```text
.
├── .github/workflows/
│   ├── ci.yml
│   ├── live.yml
│   ├── release.yml
│   └── vm.yml
├── CHANGELOG.md
├── CONTRIBUTING.md
├── README.md
├── package.json
├── pnpm-lock.yaml
├── starter.manifest.json
├── src/
│   ├── *.test.ts / *.e2e.test.ts / *.contract.test.ts / *.deps.test.ts / *.fault.test.ts
│   └── harness/
│       ├── contracts/
│       ├── deps/
│       ├── faults/
│       ├── live/
│       ├── vm/
│       └── openclaw-*.ts
├── tsconfig.json
├── vitest.config.ts
└── vitest.e2e.config.ts
```

## Starter and release contract

- repo version: `0.2.0`
- scaffold `starterVersion`: `2026.3.23.0`
- release surface: GitHub release only

`starter.manifest.json` is still the scaffold truth source. If the framework
adds or removes starter-managed files, update the manifest in the same change.

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

To run Gateway-backed suites, the target OpenClaw checkout must already be
built. Either place this repo beneath an `openclaw` checkout or set:

```bash
OPENCLAW_REPO_DIR=/absolute/path/to/openclaw
```

If the checkout has no `dist/` output yet:

```bash
cd /absolute/path/to/openclaw
pnpm build
```

## Live lane configuration

Live lanes require one of:

- `OPENCLAW_LIVE_CONFIG_JSON`
- `OPENCLAW_LIVE_CONFIG_FILE`

That config must include the channel credentials and allowlist/settings needed
for the targeted lane. Provider-side API secrets stay in separate env vars.

Required provider env vars:

- Discord
  - `OPENCLAW_LIVE_DISCORD_TOKEN`
  - `OPENCLAW_LIVE_DISCORD_CHANNEL_ID`
- Telegram
  - `OPENCLAW_LIVE_TELEGRAM_BOT_TOKEN`
  - `OPENCLAW_LIVE_TELEGRAM_CHAT_ID`
- Slack
  - `OPENCLAW_LIVE_SLACK_BOT_TOKEN`
  - `OPENCLAW_LIVE_SLACK_CHANNEL_ID`
- Mattermost
  - `OPENCLAW_LIVE_MATTERMOST_BASE_URL`
  - `OPENCLAW_LIVE_MATTERMOST_TOKEN`
  - `OPENCLAW_LIVE_MATTERMOST_CHANNEL_ID`

Artifacts default to:

```text
$TMPDIR/openclaw-harness-artifacts/live/<channel>/<timestamp>/
```

Override with:

```bash
OPENCLAW_HARNESS_ARTIFACT_DIR=/absolute/path
```

## CI lanes

### PR required

- `typecheck`
- `test`
- `test:e2e`
- `test:contracts`
- `test:deps`
- `test:fault`

### Secret-gated

- `live.yml`
  - matrix: Discord / Telegram / Slack / Mattermost

### Self-hosted

- `vm.yml`
  - matrix: macOS / Windows / Linux
  - expected runner: self-hosted macOS with Parallels access

## Release flow

The intended release path is:

1. green required CI on the release commit
2. most recent live matrix green
3. most recent VM matrix green
4. `CHANGELOG.md` updated
5. tag `v0.2.0`
6. GitHub release created by `release.yml`

This repo does not publish to npm.
