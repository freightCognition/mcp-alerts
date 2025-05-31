/**
 * Test script for carrier.packet.completed webhook
 * This script helps verify the webhook payload structure and test the URL formatting
 */

require('dotenv').config();

// Check if axios is installed for webhook testing
let axios;
try {
  axios = require('axios');
} catch (error) {
  console.log('⚠️  Note: axios is not installed. This is only needed if you want to send actual webhooks.');
  console.log('   To install: npm install --save-dev axios');
  console.log('   The formatter test will still work without it.\n');
}

const { formatSlackMessage } = require('../utils/formatters');

// Configuration
const WEBHOOK_URL = `http://localhost:${process.env.PORT || 3001}${process.env.MCP_WEBHOOK_URL_PATH || '/webhooks/mcp'}`;
const SIMULATE_ONLY = process.argv.includes('--simulate'); // Add --simulate to only test formatting without sending

// Sample webhook payload for carrier.packet.completed
// Adjust this based on your actual webhook payload structure
const sampleWebhookPayload = {
  eventType: 'carrier.packet.completed',
  eventDateTime: new Date().toISOString(),
  eventData: {
    carrier: {
      legalName: 'RC ZONE INC',
      dbaName: null,
      dotNumber: '2491899',
      docketNumber: 'MC863051'
    },
    customer: {
      companyName: 'LINEHAUL TRUCKING LLC',
      customerID: '2168'
    },
    packetDetail: {
      packetType: 'Standard',
      completionDatetime: new Date().toISOString(),
      // These are the fields we're trying to identify:
      packetId: '12345',  // Adjust based on actual field name
      id: '12345',        // Alternative field name
      // Add other fields you see in real payloads
    }
  }
};

async function testWebhook() {
  console.log('🧪 Testing carrier.packet.completed webhook...\n');
  
  // Step 1: Test the formatter function directly
  console.log('1️⃣  Testing formatSlackMessage function:');
  console.log('=====================================');
  
  try {
    const formattedMessage = formatSlackMessage(
      sampleWebhookPayload.eventType,
      sampleWebhookPayload.eventDateTime,
      sampleWebhookPayload.eventData
    );
    
    console.log('✅ Formatter executed successfully\n');
    
    // Find and display the View in MCP button URL
    const actionsBlock = formattedMessage.blocks.find(block => block.type === 'actions');
    if (actionsBlock && actionsBlock.elements[0]) {
      const viewButton = actionsBlock.elements[0];
      console.log('📎 View in MCP Button URL:', viewButton.url);
      console.log('   Expected format: https://mycarrierpackets.com/carriers/[DOT]/packets/[PACKET_ID]');
      console.log(`   Actual result: ${viewButton.url}\n`);
      
      // Check if packet ID is missing
      if (viewButton.url.endsWith('/packets/')) {
        console.log('⚠️  WARNING: Packet ID appears to be missing from the URL!');
        console.log('   This suggests packetDetail.packetId and packetDetail.id are not present.');
        console.log('   You may need to adjust the field names in formatters.js\n');
      }
    }
    
    // Display the full formatted message structure
    console.log('📋 Full formatted message structure:');
    console.log(JSON.stringify(formattedMessage, null, 2));
    
  } catch (error) {
    console.error('❌ Error in formatter:', error.message);
    console.error(error.stack);
  }
  
  // Step 2: Optionally send to the actual webhook endpoint
  if (!SIMULATE_ONLY && axios) {
    console.log('\n2️⃣  Sending test webhook to local server:');
    console.log('=====================================');
    console.log(`Webhook URL: ${WEBHOOK_URL}`);
    
    try {
      const response = await axios.post(WEBHOOK_URL, sampleWebhookPayload, {
        headers: {
          'Content-Type': 'application/json',
          // Add MCP webhook headers if required for verification
          'X-MCP-Signature': 'test-signature' // Adjust based on your verification needs
        }
      });
      
      console.log('✅ Webhook sent successfully');
      console.log(`Response status: ${response.status}`);
      console.log(`Response data:`, response.data);
      console.log('\n📱 Check your Slack channel for the test message!');
      
    } catch (error) {
      console.error('❌ Error sending webhook:', error.message);
      if (error.response) {
        console.error(`Response status: ${error.response.status}`);
        console.error(`Response data:`, error.response.data);
      }
      console.log('\n💡 Make sure your server is running: npm start');
    }
  } else if (!axios) {
    console.log('\n💡 axios is not installed. Skipping actual webhook test.');
  } else {
    console.log('\n💡 Run without --simulate flag to send actual webhook');
  }
  
  // Step 3: Provide debugging suggestions
  console.log('\n3️⃣  Debugging Tips:');
  console.log('=====================================');
  console.log('1. Check actual webhook payloads from MCP to see the real structure');
  console.log('2. Look for fields like: packetId, packet_id, id, packetNumber, etc.');
  console.log('3. Verify the correct URL pattern by checking a working packet URL in MyCarrierPackets.com');
  console.log('4. Update the packetDetail fields in this test script to match real data');
  console.log('5. Add console.log(eventData) in formatPacketCompletedMessage to see the full payload\n');
}

// Alternative: Test with custom payload from command line
if (process.argv.includes('--payload')) {
  const payloadIndex = process.argv.indexOf('--payload') + 1;
  if (payloadIndex < process.argv.length) {
    try {
      const customPayload = JSON.parse(process.argv[payloadIndex]);
      console.log('🔧 Using custom payload from command line\n');
      sampleWebhookPayload.eventData = { ...sampleWebhookPayload.eventData, ...customPayload };
    } catch (error) {
      console.error('❌ Invalid JSON payload provided');
      process.exit(1);
    }
  }
}

// Run the test
testWebhook().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
