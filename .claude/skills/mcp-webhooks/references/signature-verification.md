# MCP Webhook Signature Verification

## Delivery headers

Every webhook POST carries:

- **`MCP-Event`** — the event name that triggered delivery (mirrors `eventType` in the body).
- **`MCP-Signature`** — HMAC of the request body, used to authenticate the delivery.

## ⚠️ Hex vs. base64 — the doc contradicts itself

MCP's documentation describes the signature two incompatible ways:

1. Header description: *"the **HMAC hex digest** of the request body … SHA-256 … webhook secret as the HMAC key."*
2. "Verifying Signatures" prose: *"a **base64-encoded** `MCP-Signature` … HMAC with SHA-256 … a **base64-decoded** version of the secret."*

The C# example MCP provides outputs **lowercase hex** (`BitConverter.ToString(hash).Replace("-","").ToLowerInvariant()`) using the secret as a **UTF-8 string key** — matching interpretation (1), not (2).

**This repo follows the hex/UTF-8-key interpretation** (`utils/verifier.js`): it computes
`crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')`. If you ever see
signature mismatches, the base64 prose is the likely red herring — confirm against real deliveries
before switching encodings. (The "issued by Calendly" line in MCP's docs is also a copy-paste
artifact; MCP, not Calendly, signs these.)

## Algorithm (as implemented here)

1. Capture the **raw, unmodified** request body as a string — including all bytes and line
   endings. Any reserialization changes the signature. In Express this is done with a
   `body-parser` / `express.json({ verify })` callback that stores `req.rawBody` before parsing
   (`getExpressVerifyCallback` in `utils/verifier.js`).
2. Compute `HMAC-SHA256(rawBody, secret)` and hex-encode it (lowercase).
3. Compare against the `MCP-Signature` header using a **constant-time** comparison
   (`crypto.timingSafeEqual`) to avoid timing attacks. This repo tolerates an optional
   `sha256=` prefix on either side before comparing.

The signing secret is read from **`MCP_WEBHOOK_SIGNING_SECRET`** (verification middleware).
Note the separate **`MCP_WEBHOOK_SECRET`** used only by `test/webhook.js` to sign test payloads —
keep the two in sync when testing end-to-end.

## Failure handling

- Missing `MCP-Signature` header → `400`.
- Missing secret env var or unavailable `req.rawBody` → `500`.
- Signature mismatch → `401`.
- Valid → `next()`.

## Notification retries

If MCP does not receive a `2xx` quickly, it retries up to **5 attempts per cycle** on this
schedule. After 5, delivery stops until manually resent from the Webhook Requests page (which
starts a fresh 5-attempt cycle).

| Attempt | Time since last attempt | Time since event |
| --- | --- | --- |
| 1 | — | — |
| 2 | 0 min | 0 min |
| 3 | 5 min | 5 min |
| 4 | 10 min | 15 min |
| 5 | 15 min | 30 min |

Because retries replay the **same** body, downstream handlers should be **idempotent** —
acknowledge with a fast `2xx`, then process asynchronously so a slow handler never causes
duplicate deliveries.
