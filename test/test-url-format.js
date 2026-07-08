/**
 * Regression tests for the "View in MCP" carrier URL format.
 *
 * Covers the bug where a missing docketNumber produced a broken link
 * containing the literal string "null"/"undefined"
 * (e.g. .../DocketNumber/null), and verifies the URL is correctly built
 * and encoded across the carrier-info formatters.
 */

const assert = require('assert');
const { formatSlackMessage } = require('../utils/formatters');

function getViewButtonUrl(message) {
  const actionsBlock = message.blocks.find(block => block.type === 'actions');
  assert.ok(actionsBlock, 'expected an actions block');
  return actionsBlock.elements[0].url;
}

function baseEventData(carrierOverrides = {}) {
  return {
    carrier: {
      legalName: 'RC ZONE INC',
      dbaName: null,
      dotNumber: '2491899',
      docketNumber: 'MC863051',
      ...carrierOverrides
    },
    customer: {
      companyName: 'LINEHAUL TRUCKING LLC',
      customerID: '2168'
    },
    packetDetail: { packetType: 'Standard', completionDatetime: new Date().toISOString() }
  };
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('includes DocketNumber segment when docketNumber present', () => {
  const msg = formatSlackMessage('carrier.packet.completed', new Date().toISOString(), baseEventData());
  const url = getViewButtonUrl(msg);
  assert.strictEqual(
    url,
    'https://mycarrierpackets.com/CarrierInformation/DOTNumber/2491899/DocketNumber/MC863051'
  );
});

['', null, undefined].forEach(value => {
  test(`omits DocketNumber segment and never renders literal value when docketNumber is ${JSON.stringify(value)}`, () => {
    const msg = formatSlackMessage(
      'carrier.packet.completed',
      new Date().toISOString(),
      baseEventData({ docketNumber: value })
    );
    const url = getViewButtonUrl(msg);
    assert.strictEqual(url, 'https://mycarrierpackets.com/CarrierInformation/DOTNumber/2491899');
    assert.ok(!url.includes('/DocketNumber/'), 'should not include an empty DocketNumber segment');
    assert.ok(!/null|undefined/.test(url), 'URL must not contain literal null/undefined');
  });
});

test('URL-encodes carrier identifiers', () => {
  const msg = formatSlackMessage(
    'carrier.packet.completed',
    new Date().toISOString(),
    baseEventData({ dotNumber: '24 91', docketNumber: 'MC/863' })
  );
  const url = getViewButtonUrl(msg);
  assert.ok(url.includes('DOTNumber/24%2091'), `expected encoded DOT in ${url}`);
  assert.ok(url.includes('DocketNumber/MC%2F863'), `expected encoded docket in ${url}`);
});

let failed = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`✅ ${name}`);
  } catch (error) {
    failed++;
    console.error(`❌ ${name}\n   ${error.message}`);
  }
}

console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed === 0 ? 0 : 1);
