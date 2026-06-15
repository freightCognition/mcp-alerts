# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MCP-Alerts is a webhook integration service that bridges MyCarrierPackets (MCP) webhooks with Slack. It receives webhook events from the MCP platform, verifies their HMAC-SHA256 signatures, formats them into rich Slack Block Kit messages, and delivers them via Slack Socket Mode (with a webhook fallback).

## Commands

```bash
pnpm install          # Install dependencies
pnpm start            # Production: node app.js
pnpm dev              # Development: nodemon with hot reload
pnpm test:webhook     # Send test webhooks to local server (requires server running)
node test/test-packet-completed.js             # Test packet.completed formatter only
node test/test-packet-completed.js --simulate  # Test formatter without sending
```

## Architecture

**Entry point:** `app.js` — Starts two servers:
1. **Slack Bolt app** (Socket Mode) — maintains a WebSocket connection to Slack for message delivery
2. **Express server** (HTTP) — receives incoming MCP webhooks on the configurable `MCP_WEBHOOK_URL_PATH`

**Request flow:**

```text
MCP webhook POST → Express → body-parser (captures rawBody) → mcpVerifyMiddleware (HMAC-SHA256)
  → formatSlackMessage (event-type dispatch) → Slack Socket Mode (primary) / Webhook (fallback)
```

**Key modules:**

- `utils/verifier.js` — Webhook signature verification. Uses `getExpressVerifyCallback()` to capture raw body during parsing, then `mcpVerifyMiddleware` validates the `MCP-Signature` header against `MCP_WEBHOOK_SIGNING_SECRET`. Also exports `generateSignature` and `generateTestSignature` for testing.

- `utils/formatters.js` — Converts webhook payloads into Slack Block Kit messages. Each event type has a dedicated formatter function (e.g., `formatPacketCompletedMessage`, `formatIncidentReportCreatedMessage`). All formatters return `{ blocks, attachments, fallbackText }`.

- `utils/slackClient.js` — Simple HTTPS-based Slack webhook client used as fallback when Socket Mode is disconnected.

## Environment Variables

Two signing secret env vars exist with different names — note the distinction:
- `MCP_WEBHOOK_SECRET` — used in `test/webhook.js` for generating test signatures
- `MCP_WEBHOOK_SIGNING_SECRET` — used in `utils/verifier.js` middleware for verification

The webhook endpoint path is configured via `MCP_WEBHOOK_URL_PATH` (default: `/webhooks/mcp`).

## Supported Webhook Event Types

- `carrier.packet.completed`
- `carrier.incident_report.created` / `.updated` / `.retracted`
- `carrier.vin_verification.completed`
- `carrier.user_verification.completed`

All webhook payloads follow the structure: `{ eventType, eventDateTime, eventData: { carrier, customer, ...detail } }`.

## Deployment

Docker-based with optional Cloudflare Tunnel for on-premise exposure. The `docker-compose.yml` runs both the app container and a `cloudflared` sidecar on a shared bridge network.
