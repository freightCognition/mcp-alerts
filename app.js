require('dotenv').config();
const express = require('express');
const { App } = require('@slack/bolt');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const { formatSlackMessage } = require('./utils/formatters');
const { sendWebhookMessage } = require('./utils/slackClient');
const { mcpVerifyMiddleware, getExpressVerifyCallback } = require('./utils/verifier');

// Initialize Express app
const expressApp = express();

// Initialize Slack app with Socket Mode
const slackApp = new App({
  token: process.env.SLACK_BOT_TOKEN,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
  // Add custom error handler
  customRoutes: [
    {
      path: '/health',
      method: ['GET'],
      handler: (req, res) => {
        res.writeHead(200);
        res.end(`MCP Alerts running - Socket Mode: ${socketModeConnected}`);
      }
    }
  ]
});

// Track Socket Mode connection status
let socketModeConnected = false;

// Handle Socket Mode lifecycle events
slackApp.error((error) => {
  console.error('Socket Mode error:', error);
  socketModeConnected = false;
});

slackApp.client.on('connecting', () => {
  console.log('Socket Mode connecting...');
  socketModeConnected = false;
});

slackApp.client.on('authenticated', () => {
  console.log('Socket Mode authenticated');
  socketModeConnected = true;
});

slackApp.client.on('disconnecting', () => {
  console.log('Socket Mode disconnecting...');
  socketModeConnected = false;
});

slackApp.client.on('reconnecting', () => {
  console.log('Socket Mode reconnecting...');
  socketModeConnected = false;
});

// Middleware
expressApp.use(morgan('dev'));
expressApp.use(process.env.MCP_WEBHOOK_URL_PATH, bodyParser.json({
  verify: getExpressVerifyCallback()
}));

// Health check endpoint
expressApp.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    socketMode: socketModeConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// MCP webhook endpoint
expressApp.post(process.env.MCP_WEBHOOK_URL_PATH, mcpVerifyMiddleware, async (req, res) => {
  try {
    const { eventType, eventDateTime, eventData } = req.body;
    
    console.log(`Received MCP webhook: ${eventType}`);
    
    // Send acknowledgment response immediately
    res.status(200).send('Webhook received');
    
    // Process the webhook and send to Slack
    const message = formatSlackMessage(eventType, eventDateTime, eventData);
    
    try {
      // Try to post message to Slack using Socket Mode
      if (socketModeConnected) {
        await slackApp.client.chat.postMessage({
          channel: process.env.SLACK_CHANNEL,
          text: message.fallbackText,
          blocks: message.blocks,
          attachments: message.attachments
        });
        console.log(`Message posted to Slack via Socket Mode for event: ${eventType}`);
      } else {
        // Fallback to direct webhook if Socket Mode is disconnected
        console.log('Socket Mode disconnected, using webhook fallback...');
        const result = await sendWebhookMessage(process.env.SLACK_WEBHOOK_URL, {
          channel: process.env.SLACK_CHANNEL,
          text: message.fallbackText,
          blocks: message.blocks,
          attachments: message.attachments
        });
        console.log(`Message posted to Slack via webhook for event: ${eventType}`);
      }
    } catch (slackError) {
      console.error('Error posting to Slack:', slackError);
      
      // If Socket Mode fails, try webhook as backup
      if (slackError.message !== 'webhook fallback already used') {
        try {
          console.log('Trying webhook as backup...');
          const result = await sendWebhookMessage(process.env.SLACK_WEBHOOK_URL, {
            channel: process.env.SLACK_CHANNEL,
            text: message.fallbackText,
            blocks: message.blocks,
            attachments: message.attachments
          });
          console.log(`Backup webhook delivery succeeded for event: ${eventType}`);
        } catch (webhookError) {
          console.error('Both Slack delivery methods failed:', webhookError);
        }
      }
    }
  } catch (error) {
    console.error('Error processing webhook:', error);
    // We've already sent a 200 response to MCP, so we're just logging the error here
  }
});

// List of supported MCP webhook event types
const SUPPORTED_EVENTS = [
  'carrier.packet.completed',
  'carrier.incident_report.created',
  'carrier.incident_report.updated',
  'carrier.incident_report.retracted',
  'carrier.vin_verification.completed',
  'carrier.user_verification.completed'
];

// Start both apps
(async () => {
  try {
    // Start the Slack app first
    await slackApp.start();
    socketModeConnected = true;
    console.log('⚡️ Bolt app is running in Socket Mode!');
    console.log(`Supported event types:\n${SUPPORTED_EVENTS.map(e => `- ${e}`).join('\n')}`);
    
    // Start the Express server
    const port = process.env.PORT || 3001;
    const webhookPath = process.env.MCP_WEBHOOK_URL_PATH || '/webhooks/mcp';
    const publicAppUrl = process.env.PUBLIC_APP_URL;

    expressApp.listen(port, () => {
      console.log(`Express server is running on port ${port}`);
      const localWebhookUrl = `http://localhost:${port}${webhookPath}`;
      console.log(`Local Webhook URL: ${localWebhookUrl}`);
      if (publicAppUrl) {
        console.log(`Public Webhook URL (via Tunnel/Proxy): ${publicAppUrl.replace(/\/$/, '')}${webhookPath}`);
      }
      console.log(`Health check: http://localhost:${port}/health`);
    });
  } catch (error) {
    console.error('Failed to start application:', error);
    process.exit(1);
  }
})();
