---
name: mcp-webhooks
description: |
  Reference for MyCarrierPackets (MCP) webhook integration — event payload schemas,
  HMAC-SHA256 signature verification, and Slack formatter patterns. Use when working
  with MCP / MyCarrierPackets webhooks: adding or fixing event formatters, verifying
  webhook signatures, debugging signature mismatches, building test payloads, or
  handling carrier.packet.completed, incident_report, vin_verification, or
  user_verification events. ("MCP" here means MyCarrierPackets, NOT Model Context Protocol.)
---

# MyCarrierPackets (MCP) Webhooks

MCP delivers HTTPS POST webhooks when carrier events occur (packet completion, incident
reports, VIN/user verification). This repo (`mcp-alerts`) verifies each delivery's HMAC
signature and reformats it into Slack Block Kit messages.

## Payload envelope

Every webhook body has the same top-level shape:

```json
{ "eventType": "carrier.packet.completed", "eventDateTime": "2025-04-29T22:16:41.5102923Z", "eventData": { ... } }
```

| Field | Type | Notes |
| --- | --- | --- |
| `eventType` | String | Dotted event name; drives formatter dispatch. |
| `eventDateTime` | DateTime | ISO 8601, **UTC**. |
| `eventData` | Object | Event-specific. Always contains `carrier` and `customer` sub-objects. |

`eventData.carrier` = `{ dotNumber, docketNumber, legalName, dbaName }` (dbaName may be null).
`eventData.customer` = `{ customerID, companyName }`. These two are present on **every** event.

## Event types

| Event Type | When it fires |
| --- | --- |
| `carrier.packet.completed` | Carrier finishes an onboarding packet with a broker/shipper. |
| `carrier.incident_report.created` | Incident report on a carrier is created. |
| `carrier.incident_report.updated` | Incident report is updated. |
| `carrier.incident_report.retracted` | Incident report is retracted. |
| `carrier.vin_verification.completed` | Carrier submits a truck VIN image for verification. |
| `carrier.user_verification.completed` | A carrier user verification is completed. |

Full payloads, field tables, and enum values: see **[references/event-payloads.md](references/event-payloads.md)**.

## Endpoint requirements

The notification URL must: use **HTTPS**; accept **JSON via POST**; and return a **2xx as fast
as possible** (acknowledge first, process async). Slow/failed acks trigger retries — up to
5 attempts per cycle on a fixed backoff schedule. Headers, the signature algorithm, and the
retry table: see **[references/signature-verification.md](references/signature-verification.md)**.

## Adding or editing a formatter (this repo)

Formatters live in `utils/formatters.js`. `formatSlackMessage(eventType, eventDateTime, eventData)`
builds shared `carrierSection` / `customerSection` / `contextSection` blocks, then `switch`es on
`eventType` to a per-event function. Each formatter returns `{ blocks, attachments, fallbackText }`.

To add an event type:
1. Add a `case` in the `switch` in `formatSlackMessage`.
2. Write `formatXxxMessage(eventType, formattedDate, eventData, carrierSection, customerSection, contextSection)`.
3. Read fields from `eventData` using the **exact** documented schema (references/event-payloads.md) — guard every access with `?.` and provide `'N/A'` fallbacks; optional sub-objects (e.g. `agreement`, geolocation) are frequently absent.
4. Use finite checks for coordinates (`Number.isFinite`), not truthiness — latitude/longitude `0` is valid.
5. Add a test in `test/` and run it before committing.

## ⚠️ Known schema mismatch — verify before trusting existing formatters

Several formatters in `utils/formatters.js` read fields that **do not exist** in the documented
payloads. They were written against assumed schemas. When touching these, fix them against
references/event-payloads.md:

| Formatter reads | Documented payload actually has |
| --- | --- |
| `eventData.packetDetail.packetType`, `.completionDatetime`, `.packetId` | No `packetDetail`. Packet data is under `eventData.agreement` (signaturePerson, signatureDate, ipAddress, geolocation). |
| `eventData.incidentReportDetail.incidentType` (string), `.status`, `.reportedBy`, `.incidentReportID` | `eventData.incidentReport` with `incidentTypes` (**array**), `comments` (**array**), `reportedByCompany`, `incidentDate`, origin/destination fields. No `incidentReportID`. |

The `agreement` handling in `formatPacketCompletedMessage` is correct (added recently) and is the
reference pattern; the incident-report formatters are not yet reconciled.
