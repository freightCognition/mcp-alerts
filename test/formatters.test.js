// Assertion-based unit tests for utils/formatters.js
// Run with: npm test   (node --test "test/**/*.test.js")

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { formatSlackMessage, formatPhoneNumber } = require('../utils/formatters');

// Collect every mrkdwn/plain_text string in a formatted message into one searchable array.
// Walks block-level `text`, `fields[].text`, and `elements[].text`.
function collectText(message) {
  const texts = [];
  for (const block of message.blocks) {
    if (block.text?.text) texts.push(block.text.text);
    for (const field of block.fields || []) {
      if (field.text) texts.push(field.text);
    }
    for (const element of block.elements || []) {
      // Context elements carry a string `text`; action buttons carry a `{ text }` object.
      if (typeof element.text === 'string') texts.push(element.text);
      else if (element.text?.text) texts.push(element.text.text);
    }
  }
  return texts;
}

function hasText(message, substring) {
  return collectText(message).some(t => t.includes(substring));
}

function actionsButtonUrl(message) {
  const actions = message.blocks.find(b => b.type === 'actions');
  return actions?.elements?.[0]?.url;
}

// A complete packet.completed payload matching the documented MCP webhook schema
// (see mycarrierpackets-webhooks docs, carrier.packet.completed example).
function fullPacketEventData() {
  return {
    agreement: {
      signatureDate: '2025-04-29T22:16:20.6352903',
      signaturePerson: 'MCP Test Carrier',
      signaturePersonTitle: 'President',
      signaturePersonEmail: 'test9999997@test.com',
      signaturePersonPhoneNumber: '9999999999',
      ipAddress: {
        address: '127.0.0.1',
        city: 'New York City',
        region: 'New York',
        country: 'United States of America'
      },
      geolocation: {
        latitude: 34.0544,
        longitude: -118.244,
        error: null,
        method: 'IPAddress'
      }
    },
    carrier: {
      dotNumber: 9999997,
      docketNumber: 'MC9999997',
      legalName: 'MCP TEST CARRIER 9999997',
      dbaName: null
    },
    customer: { customerID: 6, companyName: 'MCP Test Customer' }
  };
}

// A complete incident_report payload matching the documented MCP webhook schema
// (shared shape across created/updated/retracted).
function fullIncidentEventData() {
  return {
    incidentReport: {
      incidentDate: '04/22/2025',
      originCity: 'Salt Lake City',
      originStateProvinceName: 'UT',
      originCountryName: 'United States',
      destinationCity: 'Lincoln',
      destinationStateProvinceName: 'NE',
      destinationCountryName: 'United States',
      reportedByCompany: 'MCP Test Company',
      carrierEmails: 'test9999997@test.com',
      createdBy: 'MCP Test User',
      createdDate: '2025-04-23T06:27:14.8587937',
      modifiedBy: 'MCP Test User',
      modifiedDate: '2025-04-23T06:27:14.8587937',
      incidentTypes: [
        'Theft or Unjustified Loss of Freight',
        'Wrong Equipment'
      ],
      comments: [
        {
          commenterType: 'ReportingParty',
          commentBy: 'MCP Test User',
          commentDate: '2025-04-23T06:27:15.0159957',
          comment: 'Damaged cargo'
        }
      ]
    },
    carrier: {
      dotNumber: 9999997,
      docketNumber: 'MC9999997',
      legalName: 'MCP TEST CARRIER 9999997',
      dbaName: null
    },
    customer: { customerID: 6, companyName: 'MCP Test Customer' }
  };
}

// A complete vin_verification.completed payload matching the documented MCP webhook schema.
function fullVinEventData() {
  return {
    vinVerificationDetail: {
      imageUploadedByFirstName: 'First',
      imageUploadedByLastName: 'Last',
      imageUploadedDateTime: '2025-05-01T15:57:05.2815289Z',
      imageUploadedGeolocation: { latitude: 34.0544, longitude: -118.244, error: null, method: 'IPAddress' },
      vin: '3AKJGLD55ESFW7639',
      vinVerificationStatus: 'VINBelongsToAnotherCarrier',
      otherDOTNumber: 3083762,
      vinVerificationRequestID: 102,
      requesteePhoneNumber: '9999999999',
      vinImageUrl: 'https://mycarrierpackets.com/download/vin-image-102'
    },
    carrier: {
      dotNumber: 9999997,
      docketNumber: 'MC9999997',
      legalName: 'MCP TEST CARRIER 9999997',
      dbaName: null
    },
    customer: { customerID: 6, companyName: 'MCP Test Customer' }
  };
}

// A user_verification.completed payload matching the documented MCP webhook schema.
function fullUserEventData() {
  return {
    userVerificationDetail: {
      firstName: 'First',
      lastName: 'Last',
      phoneNumber: '(888) 888-8888',
      role: 'Driver',
      otherRole: null,
      verificationStatus: 'Verified',
      verificationDatetime: '2025-05-01T18:21:30.8445657Z'
    },
    carrier: {
      dotNumber: 9999997,
      docketNumber: 'MC9999997',
      legalName: 'MCP TEST CARRIER 9999997',
      dbaName: null
    },
    customer: { customerID: 6, companyName: 'MCP Test Customer' }
  };
}

function carrierUrl(dot, mc) {
  return `https://mycarrierpackets.com/CarrierInformation/DOTNumber/${dot}/DocketNumber/${mc}`;
}

// --- formatPhoneNumber --------------------------------------------------------

test('formatPhoneNumber formats a 10-digit string', () => {
  assert.equal(formatPhoneNumber('9999999999'), '(999) 999-9999');
});

test('formatPhoneNumber strips and reformats an already-formatted number', () => {
  assert.equal(formatPhoneNumber('(312) 555-0142'), '(312) 555-0142');
  assert.equal(formatPhoneNumber('312-555-0142'), '(312) 555-0142');
});

test('formatPhoneNumber returns the original string for non-10-digit input', () => {
  // 11-digit (leading country code) and 7-digit fall through unmodified.
  assert.equal(formatPhoneNumber('19999999999'), '19999999999');
  assert.equal(formatPhoneNumber('5550142'), '5550142');
});

test('formatPhoneNumber returns null for empty/falsy input', () => {
  assert.equal(formatPhoneNumber(''), null);
  assert.equal(formatPhoneNumber(null), null);
  assert.equal(formatPhoneNumber(undefined), null);
});

test('formatPhoneNumber handles numeric input', () => {
  assert.equal(formatPhoneNumber(9999999999), '(999) 999-9999');
});

// --- formatPacketCompletedMessage: with agreement ----------------------------

test('packet.completed renders agreement signer, location, and maps link', () => {
  const msg = formatSlackMessage('carrier.packet.completed', '2025-04-29T22:16:41.510Z', fullPacketEventData());

  assert.ok(hasText(msg, '*Signed By:* MCP Test Carrier'), 'signer name present');
  assert.ok(hasText(msg, '*Title:* President'), 'signer title present');
  assert.ok(hasText(msg, '*Email:* test9999997@test.com'), 'signer email present');
  assert.ok(hasText(msg, '*Phone:* (999) 999-9999'), 'phone is formatted');
  assert.ok(hasText(msg, '*Location:* New York City, New York, United States of America'), 'location assembled');
  assert.ok(hasText(msg, '*IP Address:* 127.0.0.1'), 'ip address present');
  assert.ok(hasText(msg, 'View on Google Maps'), 'maps link present');
  assert.ok(actionsButtonUrl(msg).endsWith('/CarrierInformation/DOTNumber/9999997/DocketNumber/MC9999997'), 'action URL correct');
});

test('packet.completed shows the agreement signature date and no fictional packet detail', () => {
  const msg = formatSlackMessage('carrier.packet.completed', '2025-04-29T22:16:41.510Z', fullPacketEventData());
  // signatureDate is a documented field; "Signed On" surfaces it.
  assert.ok(hasText(msg, '*Signed On:*'), 'signature date surfaced');
  assert.ok(hasText(msg, new Date('2025-04-29T22:16:20.6352903').toLocaleString()), 'signature date value rendered');
  // These fields do not exist in the documented payload and must not be emitted.
  assert.ok(!hasText(msg, 'Packet Type'), 'no fictional Packet Type field');
  assert.ok(!hasText(msg, 'Completion Date'), 'no fictional Completion Date field');
});

test('packet.completed assembles a partial location without stray commas', () => {
  const data = fullPacketEventData();
  data.agreement.ipAddress = { country: 'United States of America' }; // city/region absent
  const msg = formatSlackMessage('carrier.packet.completed', '2025-04-29T22:16:41.510Z', data);
  assert.ok(hasText(msg, '*Location:* United States of America'), 'no leading commas for partial address');
});

// --- backward compatibility: agreement absent --------------------------------

test('packet.completed omits agreement sections when agreement is missing', () => {
  const data = fullPacketEventData();
  delete data.agreement;
  const msg = formatSlackMessage('carrier.packet.completed', '2025-04-29T22:16:41.510Z', data);

  assert.ok(!hasText(msg, 'Signed By'), 'no signer section');
  assert.ok(!hasText(msg, 'Coordinates'), 'no geolocation section');
  assert.ok(hasText(msg, '*Carrier:* MCP TEST CARRIER 9999997'), 'carrier section still present');
  assert.ok(actionsButtonUrl(msg)?.includes('/CarrierInformation/DOTNumber/9999997'), 'action button still present');
});

// --- geolocation edge cases (regression for the falsy-coordinate bug) --------

test('packet.completed renders maps link for a valid 0 coordinate', () => {
  const data = fullPacketEventData();
  data.agreement.geolocation = { latitude: 0, longitude: 0, method: 'GPS', error: null };
  const msg = formatSlackMessage('carrier.packet.completed', '2025-04-29T22:16:41.510Z', data);

  assert.ok(hasText(msg, '📍 Coordinates: 0, 0'), 'coordinates of 0 render');
  assert.ok(hasText(msg, 'maps?q=0,0'), 'maps link present for 0,0 (equator/prime meridian)');
});

test('packet.completed surfaces error and skips maps link when coordinates are unavailable', () => {
  const data = fullPacketEventData();
  data.agreement.geolocation = { latitude: null, longitude: null, method: 'IPAddress', error: 'Location lookup failed' };
  const msg = formatSlackMessage('carrier.packet.completed', '2025-04-29T22:16:41.510Z', data);

  assert.ok(hasText(msg, 'Coordinates unavailable: Location lookup failed'), 'error surfaced');
  assert.ok(!hasText(msg, 'undefined'), 'no undefined leaks into output');
  assert.ok(!hasText(msg, 'View on Google Maps'), 'no maps link without coordinates');
});

// --- incident_report.created / updated / retracted ---------------------------

test('incident_report.created renders documented incidentReport fields', () => {
  const msg = formatSlackMessage('carrier.incident_report.created', '2025-04-23T06:27:36.390Z', fullIncidentEventData());

  assert.ok(hasText(msg, 'New Incident Report'), 'created header present');
  // incidentTypes is an array in the payload; it must be joined, not shown as N/A.
  assert.ok(hasText(msg, 'Theft or Unjustified Loss of Freight'), 'incident type from array');
  assert.ok(hasText(msg, 'Wrong Equipment'), 'second incident type from array');
  assert.ok(hasText(msg, '04/22/2025'), 'incident date rendered as provided');
  assert.ok(hasText(msg, 'MCP Test Company'), 'reportedByCompany surfaced');
  assert.ok(hasText(msg, 'Salt Lake City'), 'origin surfaced');
  assert.ok(hasText(msg, 'Lincoln'), 'destination surfaced');
  assert.ok(hasText(msg, 'Damaged cargo'), 'comment surfaced');
  // No fictional fields, and the button links to the carrier (no incident URL exists in the payload).
  assert.ok(!hasText(msg, 'N/A'), 'no N/A placeholders when data is present');
  assert.equal(actionsButtonUrl(msg), carrierUrl(9999997, 'MC9999997'), 'button links to carrier');
});

test('incident_report.updated uses the updated header and real data', () => {
  const msg = formatSlackMessage('carrier.incident_report.updated', '2025-04-23T06:27:36.390Z', fullIncidentEventData());
  assert.ok(hasText(msg, 'Updated'), 'updated header present');
  assert.ok(hasText(msg, 'Theft or Unjustified Loss of Freight'), 'incident type present');
  assert.equal(actionsButtonUrl(msg), carrierUrl(9999997, 'MC9999997'), 'button links to carrier');
});

test('incident_report.retracted renders without fabricated retraction fields', () => {
  const msg = formatSlackMessage('carrier.incident_report.retracted', '2025-04-23T06:27:36.390Z', fullIncidentEventData());
  assert.ok(hasText(msg, 'Retracted'), 'retracted header present');
  assert.ok(hasText(msg, 'Theft or Unjustified Loss of Freight'), 'incident type still present');
  // These fields are not in the documented payload and must not be emitted.
  assert.ok(!hasText(msg, 'Retraction Reason'), 'no fictional retraction reason');
  assert.ok(!hasText(msg, 'Retracted By'), 'no fictional retracted-by field');
});

test('incident_report handles missing optional collections gracefully', () => {
  const data = fullIncidentEventData();
  delete data.incidentReport.comments;
  data.incidentReport.incidentTypes = [];
  const msg = formatSlackMessage('carrier.incident_report.created', '2025-04-23T06:27:36.390Z', data);
  assert.ok(!hasText(msg, 'undefined'), 'no undefined leaks with empty collections');
});

// --- vin_verification.completed ----------------------------------------------

test('vin_verification.completed renders VIN, status, other DOT, and an image button', () => {
  const msg = formatSlackMessage('carrier.vin_verification.completed', '2025-05-01T15:57:12.635Z', fullVinEventData());

  assert.ok(hasText(msg, '3AKJGLD55ESFW7639'), 'VIN present');
  assert.ok(hasText(msg, 'VINBelongsToAnotherCarrier'), 'status present');
  assert.ok(hasText(msg, '3083762'), 'other DOT present for cross-carrier match');
  assert.ok(hasText(msg, 'First Last'), 'uploader name surfaced');
  // vinImageUrl should be reachable as a button.
  const buttonUrls = (msg.blocks.find(b => b.type === 'actions')?.elements || []).map(e => e.url);
  assert.ok(buttonUrls.includes('https://mycarrierpackets.com/download/vin-image-102'), 'VIN image link present');
});

test('vin_verification.completed does not leak undefined coordinates', () => {
  const data = fullVinEventData();
  data.vinVerificationDetail.imageUploadedGeolocation = { latitude: null, longitude: null, method: 'IPAddress' };
  const msg = formatSlackMessage('carrier.vin_verification.completed', '2025-05-01T15:57:12.635Z', data);
  assert.ok(!hasText(msg, 'undefined'), 'no undefined coordinates rendered');
});

// --- user_verification.completed ---------------------------------------------

test('user_verification.completed renders documented fields', () => {
  const msg = formatSlackMessage('carrier.user_verification.completed', '2025-05-01T18:21:31.278Z', fullUserEventData());
  assert.ok(hasText(msg, 'First Last'), 'name present');
  assert.ok(hasText(msg, 'Driver'), 'role present');
  assert.ok(hasText(msg, 'Verified'), 'status present');
  assert.ok(hasText(msg, '(888) 888-8888'), 'phone present');
  assert.equal(actionsButtonUrl(msg), carrierUrl(9999997, 'MC9999997'), 'button links to carrier');
});

// --- defensive carrier/customer access (fix 1) -------------------------------

test('formatSlackMessage does not throw when carrier and customer are entirely absent', () => {
  let msg;
  assert.doesNotThrow(() => {
    msg = formatSlackMessage('carrier.packet.completed', '2025-04-29T22:16:41.510Z', {});
  });
  assert.ok(Array.isArray(msg.blocks) && msg.blocks.length > 0, 'returns a valid message with blocks');
});

test('formatSlackMessage renders N/A (never literal undefined/null) for missing carrier/customer fields', () => {
  const data = { carrier: {}, customer: {} };
  const msg = formatSlackMessage('carrier.packet.completed', '2025-04-29T22:16:41.510Z', data);
  assert.ok(!hasText(msg, 'undefined'), 'no literal undefined leaks into output');
  assert.ok(!hasText(msg, 'null'), 'no literal null leaks into output');
  assert.ok(hasText(msg, '*Carrier:* N/A'), 'carrier legalName falls back to N/A');
  assert.ok(hasText(msg, '*DOT Number:* N/A'), 'DOT number falls back to N/A');
  assert.ok(hasText(msg, '*Customer:* N/A'), 'customer companyName falls back to N/A');
  assert.ok(hasText(msg, '*Customer ID:* N/A'), 'customer ID falls back to N/A');
});

// --- VIN image button URL validation (fix 2) ---------------------------------

test('vin_verification.completed includes image button for a valid http(s) vinImageUrl', () => {
  const msg = formatSlackMessage('carrier.vin_verification.completed', '2025-05-01T15:57:12.635Z', fullVinEventData());
  const actions = msg.blocks.find(b => b.type === 'actions');
  assert.equal(actions.elements.length, 2, 'View in MCP + VIN image button');
});

test('vin_verification.completed omits image button when vinImageUrl is malformed', () => {
  const data = fullVinEventData();
  data.vinVerificationDetail.vinImageUrl = 'downloadUrl'; // not an http(s) URL; Slack would reject the whole message
  const msg = formatSlackMessage('carrier.vin_verification.completed', '2025-05-01T15:57:12.635Z', data);
  const actions = msg.blocks.find(b => b.type === 'actions');
  assert.equal(actions.elements.length, 1, 'only the View in MCP button, no image button');
  assert.ok(hasText(msg, '3AKJGLD55ESFW7639'), 'rest of the message still renders');
});

test('vin_verification.completed omits image button when vinImageUrl is missing', () => {
  const data = fullVinEventData();
  delete data.vinVerificationDetail.vinImageUrl;
  const msg = formatSlackMessage('carrier.vin_verification.completed', '2025-05-01T15:57:12.635Z', data);
  const actions = msg.blocks.find(b => b.type === 'actions');
  assert.equal(actions.elements.length, 1, 'no image button when url is missing');
});

// --- user_verification status -> attachment color coding ---------------------

test('user_verification.completed color-codes the attachment by verificationStatus', () => {
  const colorFor = (status) => {
    const data = fullUserEventData();
    data.userVerificationDetail.verificationStatus = status;
    return formatSlackMessage('carrier.user_verification.completed', '2025-05-01T18:21:31.278Z', data).attachments[0].color;
  };
  assert.equal(colorFor('Denied'), '#E01E5A', 'Denied -> red');
  assert.equal(colorFor('Pending'), '#ECB22E', 'Pending -> yellow');
  assert.equal(colorFor('FollowUp'), '#ECB22E', 'FollowUp -> yellow');
  assert.equal(colorFor('Verified'), '#2EB67D', 'Verified -> green');
});

// --- default formatter for unknown event types ------------------------------

test('formatSlackMessage routes unknown event types through the default formatter', () => {
  let msg;
  assert.doesNotThrow(() => {
    msg = formatSlackMessage('some.unknown.event', '2025-04-29T22:16:41.510Z', fullPacketEventData());
  });
  assert.ok(Array.isArray(msg.blocks) && msg.blocks.length > 0, 'returns a valid message with blocks');
  assert.ok(hasText(msg, 'some.unknown.event'), 'unknown event type surfaced in the header');
  assert.ok(actionsButtonUrl(msg)?.includes('/CarrierInformation/DOTNumber/9999997'), 'view button present');
});

// --- View-in-MCP carrier URL (ported from test/test-url-format.js) -----------

function urlCarrierEventData(carrierOverrides = {}) {
  return {
    carrier: {
      legalName: 'RC ZONE INC',
      dbaName: null,
      dotNumber: '2491899',
      docketNumber: 'MC863051',
      ...carrierOverrides
    },
    customer: { companyName: 'LINEHAUL TRUCKING LLC', customerID: '2168' }
  };
}

test('carrier URL includes the DocketNumber segment when docketNumber is present', () => {
  const msg = formatSlackMessage('carrier.packet.completed', new Date().toISOString(), urlCarrierEventData());
  assert.equal(
    actionsButtonUrl(msg),
    'https://mycarrierpackets.com/CarrierInformation/DOTNumber/2491899/DocketNumber/MC863051'
  );
});

for (const value of ['', null, undefined]) {
  test(`carrier URL omits the DocketNumber segment when docketNumber is ${JSON.stringify(value)}`, () => {
    const msg = formatSlackMessage('carrier.packet.completed', new Date().toISOString(), urlCarrierEventData({ docketNumber: value }));
    const url = actionsButtonUrl(msg);
    assert.equal(url, 'https://mycarrierpackets.com/CarrierInformation/DOTNumber/2491899');
    assert.ok(!url.includes('/DocketNumber/'), 'no empty DocketNumber segment');
    assert.ok(!/null|undefined/.test(url), 'URL must not contain literal null/undefined');
  });
}

test('carrier URL URL-encodes the carrier identifiers', () => {
  const msg = formatSlackMessage('carrier.packet.completed', new Date().toISOString(), urlCarrierEventData({ dotNumber: '24 91', docketNumber: 'MC/863' }));
  const url = actionsButtonUrl(msg);
  assert.ok(url.includes('DOTNumber/24%2091'), `expected encoded DOT in ${url}`);
  assert.ok(url.includes('DocketNumber/MC%2F863'), `expected encoded docket in ${url}`);
});

// --- invalid date handling (fix 3) -------------------------------------------

test('formatSlackMessage never renders "Invalid Date" for a garbage event timestamp', () => {
  const msg = formatSlackMessage('carrier.packet.completed', 'not-a-real-date', fullPacketEventData());
  assert.ok(!hasText(msg, 'Invalid Date'), 'no "Invalid Date" substring in output');
});

test('incident_report never renders "Invalid Date" for garbage nested timestamps', () => {
  const data = fullIncidentEventData();
  data.incidentReport.createdDate = 'garbage';
  data.incidentReport.modifiedDate = 'also-garbage';
  data.incidentReport.comments[0].commentDate = 'nope';
  const msg = formatSlackMessage('carrier.incident_report.created', 'bad-timestamp', data);
  assert.ok(!hasText(msg, 'Invalid Date'), 'no "Invalid Date" substring in output');
});

// --- malformed-payload container hardening -----------------------------------
// The field-level guards handle a missing carrier/customer object, but the
// eventData container itself can be absent (e.g. a webhook body with no
// eventData key -> app.js destructures `undefined`). A throw here is a silent
// event drop, because app.js has already returned 200 to MCP.

[null, undefined].forEach(value => {
  test(`formatSlackMessage does not throw when eventData is ${value}`, () => {
    let msg;
    assert.doesNotThrow(() => {
      msg = formatSlackMessage('carrier.packet.completed', '2025-04-29T22:16:41Z', value);
    });
    assert.ok(Array.isArray(msg.blocks) && msg.blocks.length > 0, 'still produces a valid message');
    const url = actionsButtonUrl(msg);
    assert.ok(!/null|undefined/.test(url || ''), `URL must not contain literal null/undefined: ${url}`);
  });
});

test('carrier URL omits the DOTNumber segment (no empty trailing slash) when dotNumber is absent', () => {
  const msg = formatSlackMessage('carrier.packet.completed', '2025-04-29T22:16:41Z', { customer: {} });
  const url = actionsButtonUrl(msg);
  assert.equal(url, 'https://mycarrierpackets.com/CarrierInformation', `unexpected base URL: ${url}`);
  assert.ok(!/DOTNumber\/(?:$|[/&?])/.test(url), 'must not emit an empty DOTNumber segment');
});
