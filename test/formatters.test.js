/**
 * Assertion-based unit tests for utils/formatters.js
 * Run with: npm test   (node --test test/)
 */

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

// A complete, realistic packet.completed payload (mirrors a real 2025-04-29 MCP webhook).
function fullPacketEventData() {
  return {
    agreement: {
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
    customer: { customerID: 6, companyName: 'MCP Test Customer' },
    packetDetail: { packetType: 'Standard', completionDatetime: '2025-04-29T22:16:41.5102923Z', packetId: '12345' }
  };
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
