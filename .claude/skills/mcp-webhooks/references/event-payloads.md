# MCP Webhook Event Payloads

Canonical schemas and example payloads for all six event types. The JSON blocks double as
copy-paste test fixtures. Every `eventData` also contains `carrier` and `customer` (shown once
below, omitted from later examples for brevity but always present).

## Table of contents
- [Common sub-objects](#common-sub-objects)
- [carrier.packet.completed](#carrierpacketcompleted)
- [carrier.incident_report.created / .updated / .retracted](#carrierincident_report)
- [carrier.vin_verification.completed](#carriervin_verificationcompleted)
- [carrier.user_verification.completed](#carrieruser_verificationcompleted)

## Common sub-objects

Present on every event inside `eventData`:

```json
"carrier": {
  "dotNumber": 9999997,
  "docketNumber": "MC9999997",
  "legalName": "MCP TEST CARRIER 9999997",
  "dbaName": null
},
"customer": {
  "customerID": 6,
  "companyName": "MCP Test Customer"
}
```

`ipAddress` object (used by several events): `{ address, city, region, country }`.
`geolocation` object: `{ latitude, longitude, error, method }` where `error` may be null and
`method` is an enum (see each event).

---

## carrier.packet.completed

Fires when a carrier completes an online onboarding packet.

**Enums:** `agreement.geolocation.method` ∈ { `DeviceOrBrowser`, `IPAddress` }.

```json
{
  "eventType": "carrier.packet.completed",
  "eventDateTime": "2025-04-29T22:16:41.5102923Z",
  "eventData": {
    "agreement": {
      "signatureDate": "2025-04-29T22:16:20.6352903",
      "signaturePerson": "MCP Test Carrier",
      "signaturePersonTitle": "President",
      "signaturePersonEmail": "test9999997@test.com",
      "signaturePersonPhoneNumber": "9999999999",
      "agreementImageBlobName": "company-agreement/6/b7453f55-3f3b-454d-8726-89f746082a06",
      "ipAddress": {
        "address": "127.0.0.1",
        "city": "New York City",
        "region": "New York",
        "country": "United States of America"
      },
      "geolocation": {
        "latitude": 34.0544,
        "longitude": -118.244,
        "error": null,
        "method": "IPAddress"
      }
    },
    "carrier": { "dotNumber": 9999997, "docketNumber": "MC9999997", "legalName": "MCP TEST CARRIER 9999997", "dbaName": null },
    "customer": { "customerID": 6, "companyName": "MCP Test Customer" }
  }
}
```

Note: the `agreement` object is absent on packets emitted before MCP added e-signature capture —
guard with `if (eventData.agreement)`. There is **no** `packetDetail` object in this payload.

---

## carrier.incident_report

The `.created`, `.updated`, and `.retracted` events share an **identical** payload shape; only
`eventType` differs.

**Enums:** `incidentReport.comments.commenterType` ∈ { `ReportingParty`, `RespondingParty` }.

```json
{
  "eventType": "carrier.incident_report.created",
  "eventDateTime": "2025-04-23T06:27:36.3903875Z",
  "eventData": {
    "incidentReport": {
      "incidentDate": "04/22/2025",
      "originCity": "Salt Lake City",
      "originStateProvinceName": "UT",
      "originCountryName": "United States",
      "destinationCity": "Lincoln",
      "destinationStateProvinceName": "NE",
      "destinationCountryName": "United States",
      "reportedByCompany": "MCP Test Company",
      "carrierEmails": "test9999997@test.com",
      "createdBy": "MCP Test User",
      "createdDate": "2025-04-23T06:27:14.8587937",
      "modifiedBy": "MCP Test User",
      "modifiedDate": "2025-04-23T06:27:14.8587937",
      "incidentTypes": [
        "Theft or Unjustified Loss of Freight",
        "Wrong Equipment",
        "Operated Under Alias",
        "No Show without Notification",
        "Pickup or Delivery Service Failure"
      ],
      "comments": [
        {
          "commenterType": "ReportingParty",
          "commentBy": "MCP Test User",
          "commentDate": "2025-04-23T06:27:15.0159957",
          "comment": "Damaged cargo"
        }
      ]
    },
    "carrier": { "dotNumber": 9999997, "docketNumber": "MC9999997", "legalName": "MCP TEST CARRIER 9999997", "dbaName": null },
    "customer": { "customerID": 6, "companyName": "MCP Test Customer" }
  }
}
```

Key points: `incidentTypes` and `comments` are **arrays**. There is no single `incidentType`
string, no `status`, no `reportedBy`, and no `incidentReportID` / `retractionReason` /
`retractedBy` field — distinguish created vs updated vs retracted by `eventType` alone.
`incidentDate` is `MM/DD/YYYY`; the other timestamps are ISO 8601.

---

## carrier.vin_verification.completed

Fires when a carrier submits a truck VIN image.

**Enums:**
- `vinVerificationDetail.imageUploadedGeolocation.method` ∈ { `DeviceOrBrowser`, `IPAddress` }.
- `vinVerificationDetail.vinVerificationStatus` ∈ { `VINRequestSent`, `VINBelongsToCarrier`, `VINBelongsToAnotherCarrier`, `VINCarrierUndetermined` }.

```json
{
  "eventType": "carrier.vin_verification.completed",
  "eventDateTime": "2025-05-01T15:57:12.6350582Z",
  "eventData": {
    "vinVerificationDetail": {
      "imageUploadedByFirstName": "FirstName",
      "imageUploadedByLastName": "LastName",
      "imageUploadedDateTime": "2025-05-01T15:57:05.2815289Z",
      "imageUploadedIPAddress": { "address": "127.0.0.1", "city": "Arlington", "region": "Virginia", "country": "United States of America" },
      "imageUploadedGeolocation": { "latitude": 34.0544, "longitude": -118.244, "error": null, "method": "IPAddress" },
      "vin": "3AKJGLD55ESFW7639",
      "vinVerificationStatus": "VINBelongsToAnotherCarrier",
      "otherDOTNumber": 3083762,
      "vinVerificationRequestID": 102,
      "requesteePhoneNumber": "9999999999",
      "vinImageUrl": "downloadUrl"
    },
    "carrier": { "dotNumber": 9999997, "docketNumber": "MC9999997", "legalName": "MCP TEST CARRIER 9999997", "dbaName": null },
    "customer": { "customerID": 6, "companyName": "MCP Test Customer" }
  }
}
```

`otherDOTNumber` is only meaningful when status is `VINBelongsToAnotherCarrier`. (MCP's published
example renders the last three fields with `=` instead of `:` and a missing comma — that is a
documentation typo; the real payload is valid JSON with `:` as shown above.)

---

## carrier.user_verification.completed

Fires when a carrier user verification completes.

**Enums:**
- `userVerificationDetail.role` ∈ { `Admin`, `Driver`, `Dispatcher`, `Accounting`, `Other` }.
- `userVerificationDetail.verificationStatus` ∈ { `Pending`, `Verified`, `Denied`, `FollowUp` }.

```json
{
  "eventType": "carrier.user_verification.completed",
  "eventDateTime": "2025-05-01T18:21:31.2784222Z",
  "eventData": {
    "userVerificationDetail": {
      "firstName": "FirstName",
      "lastName": "LastName",
      "phoneNumber": "(888) 888-8888",
      "role": "Driver",
      "otherRole": null,
      "verificationStatus": "Verified",
      "verificationDatetime": "2025-05-01T18:21:30.8445657Z"
    },
    "carrier": { "dotNumber": 9999997, "docketNumber": "MC9999997", "legalName": "MCP TEST CARRIER 9999997", "dbaName": null },
    "customer": { "customerID": 6, "companyName": "MCP Test Customer" }
  }
}
```

`otherRole` is populated only when `role` is `Other`. `phoneNumber` here arrives pre-formatted
as `(888) 888-8888` (unlike `packet.completed`'s raw 10-digit `signaturePersonPhoneNumber`).
