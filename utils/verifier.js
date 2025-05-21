/**
 * Utility for verifying and generating MCP webhook signatures
 */
const crypto = require('crypto');

/**
 * Verify the MCP webhook signature
 * @param {string} payload - JSON string body of the webhook
 * @param {string} signature - The MCP-Signature header value
 * @param {string} secret - The webhook signing secret
 * @returns {boolean} - Whether the signature is valid
 */
function verifySignature(payload, signature, secret) {
  if (!payload || !signature || !secret) {
    return false;
  }

  // Calculate the expected signature
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = `sha256=${hmac.digest('hex')}`;

  // Use a constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Generate a signature for a webhook payload
 * @param {object} payload - The webhook payload object
 * @param {string} secret - The webhook signing secret
 * @returns {string} - The SHA-256 signature
 */
function generateSignature(payload, secret) {
  const stringPayload = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(stringPayload);
  return `sha256=${hmac.digest('hex')}`;
}

module.exports = {
  verifySignature,
  generateSignature
};
