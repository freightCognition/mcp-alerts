/**
 * @module utils/verifier
 * @description Provides utilities for MCP webhook signature verification.
 *
 * This module includes:
 * - An Express middleware (`mcpVerifyMiddleware`) for verifying incoming webhook signatures.
 * - A helper function (`getExpressVerifyCallback`) to ensure the raw request body is preserved for verification.
 * - Core functions for generating (`generateSignature`) and verifying (`verifySignature`) HMAC-SHA256 signatures.
 *
 * @example <caption>Basic Usage in an Express App</caption>
 * const express = require('express');
 * const bodyParser = require('body-parser'); // Or use express.json() directly
 * const { mcpVerifyMiddleware, getExpressVerifyCallback } = require('./utils/verifier');
 *
 * // Load environment variables (ensure MCP_WEBHOOK_SIGNING_SECRET is set)
 * require('dotenv').config();
 *
 * const app = express();
 * const PORT = process.env.PORT || 3000;
 *
 * // Middleware to handle MCP webhooks
 * // IMPORTANT: express.json() with the verify callback must be applied *before* mcpVerifyMiddleware
 * // and *only* to the webhook route, or routes that need raw body preservation.
 * app.post('/mcp-webhook',
 *   bodyParser.json({ verify: getExpressVerifyCallback() }), // Preserves req.rawBody
 *   mcpVerifyMiddleware, // Verifies the signature
 *   (req, res) => {
 *     // If execution reaches here, the signature is valid.
 *     // req.body will contain the parsed JSON payload.
 *     // req.rawBody contains the original raw string payload.
 *     console.log('Webhook received and verified:', req.body);
 *     res.status(200).send('Webhook processed successfully.');
 *   }
 * );
 *
 * app.listen(PORT, () => {
 *   console.log(`Server listening on port ${PORT}`);
 * });
 */
const crypto = require('crypto');

/**
 * Utility for verifying and generating MCP webhook signatures
 */
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
  // Calculate expected signature (with sha256= prefix)
  const expectedSignature = generateSignature(payload, secret);
  // Remove 'sha256=' prefix for buffer comparison
  const expected = expectedSignature.replace(/^sha256=/, '');
  const received = signature.replace(/^sha256=/, '');
  const expectedBuffer = Buffer.from(expected, 'hex');
  const receivedBuffer = Buffer.from(received, 'hex');
  if (expectedBuffer.length !== receivedBuffer.length) {
    console.error(`Signature length mismatch: received ${receivedBuffer.length}, calculated ${expectedBuffer.length}`);
    return false;
  }
  // Use constant-time comparison
  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

/** 
 * Generates an HMAC-SHA256 signature for a given payload.
 * This function is primarily intended for testing the signature verification process.
 *
 * @param {string} payload - The raw string payload to sign.
 * @param {string} secret - The secret key used for generating the signature.
 * @returns {string} The HMAC-SHA256 signature, prefixed with 'sha256='.
 */
function generateSignature(payload, secret) {
  if (typeof payload !== 'string') {
    throw new Error('Payload must be a string.');
  }
  if (typeof secret !== 'string' || secret.length === 0) {
    throw new Error('Secret must be a non-empty string.');
  }

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload, 'utf8');
  const signature = hmac.digest('hex');
  return `sha256=${signature}`;
}

/**
 * Returns a 'verify' function for use with express.json() or express.urlencoded().
 * This function captures the raw request body and stores it as a string on req.rawBody.
 * This is necessary for signature verification processes that need the original, unmodified payload.
 *
 * @example
 * const express = require('express');
 * const { getExpressVerifyCallback } = require('./utils/verifier');
 * const app = express();
 * app.use('/webhook', express.json({ verify: getExpressVerifyCallback() }));
 *
 * @returns {function} A verify callback for Express body parsing middleware.
 *                     It has the signature: (req, res, buf, encoding) => void
 */
function getExpressVerifyCallback() {
  return (req, res, buf, encoding) => {
    if (buf && buf.length) {
      req.rawBody = buf.toString(encoding || 'utf8');
    }
  };
}

/**
 * Express middleware for verifying MCP webhook signatures.
 * It expects the raw request body to be available on req.rawBody.
 * The signing secret should be set in the MCP_WEBHOOK_SIGNING_SECRET environment variable.
 * The signature is expected in the 'MCP-Signature' header.
 *
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @param {function} next - Express next middleware function.
 */
function mcpVerifyMiddleware(req, res, next) {
  const secret = process.env.MCP_WEBHOOK_SIGNING_SECRET;
  if (!secret) {
    console.error('[MCP Verify Middleware] Error: MCP_WEBHOOK_SIGNING_SECRET is not set. Denying request.');
    return res.status(500).send('Webhook signing secret not configured.');
  }

  const signatureHeader = req.get('MCP-Signature'); 
  if (!signatureHeader) {
    console.warn(`[MCP Verify Middleware] Warning: Missing MCP-Signature header from IP: ${req.ip}. Denying request.`);
    return res.status(400).send('Missing signature header.');
  }

  if (!req.rawBody) {
    console.error('[MCP Verify Middleware] Error: req.rawBody is not available. Ensure express.json({ verify: ... }) is used correctly for this route. Denying request.');
    return res.status(500).send('Raw request body not available for verification.');
  }

  // Debug: Log the raw body for troubleshooting signature mismatches
  console.log('[DEBUG] req.rawBody:', req.rawBody);
  const isValid = verifySignature(req.rawBody, signatureHeader, secret);

  if (isValid) {
    console.log(`[MCP Verify Middleware] Signature verified successfully for request from IP: ${req.ip}`);
    next();
  } else {
    console.warn(`[MCP Verify Middleware] Invalid signature for request from IP: ${req.ip}. Received signature: ${signatureHeader}. Denying request.`);
    res.status(401).send('Invalid signature.');
  }
}

// Helper for local signature generation (for testing)
function generateTestSignature(rawBodyString) {
  const secret = process.env.MCP_WEBHOOK_SIGNING_SECRET;
  if (!secret) throw new Error('MCP_WEBHOOK_SIGNING_SECRET not set');
  return generateSignature(rawBodyString, secret);
}

module.exports = {
  generateSignature,
  verifySignature,
  getExpressVerifyCallback,
  mcpVerifyMiddleware,
  generateTestSignature, // Exported for local testing
};
