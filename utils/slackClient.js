/**
 * Simple Slack webhook client as a fallback option
 */
const https = require('https');
const url = require('url');

/**
 * Send a message directly to Slack via webhook
 * @param {string} webhookUrl - The Slack webhook URL to post to
 * @param {object} message - Message object with blocks, attachments, text
 * @returns {Promise<object>} - Promise resolving to response
 */
function sendWebhookMessage(webhookUrl, message) {
  return new Promise((resolve, reject) => {
    const parsedUrl = url.parse(webhookUrl);
    const payload = JSON.stringify(message);
    
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };
    
    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ 
            success: true,
            statusCode: res.statusCode,
            response: responseData
          });
        } else {
          reject({
            success: false,
            statusCode: res.statusCode,
            response: responseData
          });
        }
      });
    });
    
    req.on('error', (error) => {
      reject({
        success: false,
        error: error.message
      });
    });
    
    req.write(payload);
    req.end();
  });
}

module.exports = {
  sendWebhookMessage
};
