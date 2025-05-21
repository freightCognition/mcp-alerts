/**
 * Test script to simulate MCP webhooks
 */
require('dotenv').config();
const http = require('http');
const { generateSignature } = require('../utils/verifier');

// Sample webhook payloads for each event type
const webhookSamples = {
  'carrier.packet.completed': {
    eventType: 'carrier.packet.completed',
    eventDateTime: new Date().toISOString(),
    eventData: {
      packetDetail: {
        packetType: 'Standard',
        completionDatetime: new Date().toISOString()
      },
      carrier: {
        dotNumber: 9999997,
        docketNumber: 'MC9999997',
        legalName: 'MCP TEST CARRIER 9999997',
        dbaName: null
      },
      customer: {
        customerID: 6,
        companyName: 'MCP Test Customer'
      }
    }
  },
  'carrier.incident_report.created': {
    eventType: 'carrier.incident_report.created',
    eventDateTime: new Date().toISOString(),
    eventData: {
      incidentReportDetail: {
        incidentReportID: '123456',
        incidentType: 'Safety Concern',
        incidentDatetime: new Date().toISOString(),
        status: 'New',
        reportedBy: 'Test Reporter'
      },
      carrier: {
        dotNumber: 9999997,
        docketNumber: 'MC9999997',
        legalName: 'MCP TEST CARRIER 9999997',
        dbaName: null
      },
      customer: {
        customerID: 6,
        companyName: 'MCP Test Customer'
      }
    }
  },
  'carrier.incident_report.updated': {
    eventType: 'carrier.incident_report.updated',
    eventDateTime: new Date().toISOString(),
    eventData: {
      incidentReportDetail: {
        incidentReportID: '123456',
        incidentType: 'Safety Concern',
        incidentDatetime: new Date().toISOString(),
        status: 'In Progress',
        reportedBy: 'Test Reporter'
      },
      carrier: {
        dotNumber: 9999997,
        docketNumber: 'MC9999997',
        legalName: 'MCP TEST CARRIER 9999997',
        dbaName: null
      },
      customer: {
        customerID: 6,
        companyName: 'MCP Test Customer'
      }
    }
  },
  'carrier.incident_report.retracted': {
    eventType: 'carrier.incident_report.retracted',
    eventDateTime: new Date().toISOString(),
    eventData: {
      incidentReportDetail: {
        incidentReportID: '123456',
        incidentType: 'Safety Concern',
        incidentDatetime: new Date().toISOString(),
        retractionReason: 'False Report',
        retractedBy: 'Administrator'
      },
      carrier: {
        dotNumber: 9999997,
        docketNumber: 'MC9999997',
        legalName: 'MCP TEST CARRIER 9999997',
        dbaName: null
      },
      customer: {
        customerID: 6,
        companyName: 'MCP Test Customer'
      }
    }
  },
  'carrier.vin_verification.completed': {
    eventType: 'carrier.vin_verification.completed',
    eventDateTime: new Date().toISOString(),
    eventData: {
      vinVerificationDetail: {
        vin: '3AKJGLD55ESFW7639',
        vinVerificationStatus: 'VINBelongsToAnotherCarrier',
        otherDOTNumber: 3083762,
        imageUploadedGeolocation: {
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
      customer: {
        customerID: 6,
        companyName: 'MCP Test Customer'
      }
    }
  },
  'carrier.user_verification.completed': {
    eventType: 'carrier.user_verification.completed',
    eventDateTime: new Date().toISOString(),
    eventData: {
      userVerificationDetail: {
        firstName: 'FirstName',
        lastName: 'LastName',
        phoneNumber: '(888) 888-8888',
        role: 'Driver',
        otherRole: null,
        verificationStatus: 'Verified',
        verificationDatetime: new Date().toISOString()
      },
      carrier: {
        dotNumber: 9999997,
        docketNumber: 'MC9999997',
        legalName: 'MCP TEST CARRIER 9999997',
        dbaName: null
      },
      customer: {
        customerID: 6,
        companyName: 'MCP Test Customer'
      }
    }
  }
};

// Function to send a test webhook
function sendTestWebhook(eventType) {
  return new Promise((resolve, reject) => {
    const payload = webhookSamples[eventType];
    const stringPayload = JSON.stringify(payload);
    
    // Get the signing secret from environment variables
    const secret = process.env.MCP_WEBHOOK_SECRET;
    
    // Validate that the webhook secret is set
    if (!secret) {
      console.error('Error: MCP_WEBHOOK_SECRET is not set in the environment variables.');
      console.error('Please set this variable in your .env file or environment before running tests.');
      process.exit(1);
    }
    
    // Generate the signature
    const signature = generateSignature(stringPayload, secret);
    
    // Set up the request options
    const options = {
      hostname: 'localhost',
      port: process.env.PORT || 3001,
      path: process.env.MCP_WEBHOOK_URL_PATH || '/webhooks/mcp',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(stringPayload),
        'MCP-Signature': signature,
        'MCP-Event': eventType
      }
    };
    
    // Create the request
    const req = http.request(options, (res) => {
      console.log(`[${eventType}] Status Code: ${res.statusCode}`);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (data) {
          console.log(`[${eventType}] Response: ${data}`);
        }
        resolve();
      });
    });
    
    // Handle errors
    req.on('error', (error) => {
      console.error(`[${eventType}] Error:`, error);
      reject(error);
    });
    
    // Send the request
    req.write(stringPayload);
    req.end();
  });
}

// Main function to send all test webhooks
async function runTests() {
  console.log('Starting webhook tests...');
  console.log(`Server: http://localhost:${process.env.PORT || 3001}${process.env.MCP_WEBHOOK_URL_PATH || '/webhooks/mcp'}`);
  
  // Send each test webhook with a slight delay between them
  for (const eventType of Object.keys(webhookSamples)) {
    console.log(`\nSending test webhook for: ${eventType}`);
    try {
      await sendTestWebhook(eventType);
      // Wait 2 seconds between requests
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`Failed to test ${eventType}:`, error.message);
    }
  }
  
  console.log('\nAll tests completed!');
}

// Run the tests
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { sendTestWebhook, webhookSamples };
