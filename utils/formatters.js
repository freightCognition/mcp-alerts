/**
 * Format MCP webhook events into rich Slack messages
 */

/** Shorthand for a Slack mrkdwn text object. */
const md = (text) => ({ type: "mrkdwn", text });

/** Join first and last name, dropping any missing part (no stray spaces). */
const fullName = (first, last) => [first, last].filter(Boolean).join(' ');

/**
 * True when a geolocation carries finite numeric coordinates.
 * Uses finite checks, not truthiness: latitude/longitude of 0 (equator / prime
 * meridian) are valid coordinates that a truthiness guard would wrongly drop.
 * @param {object} geo - A geolocation object with latitude/longitude.
 */
const hasCoordinates = (geo) =>
  !!geo && Number.isFinite(geo.latitude) && Number.isFinite(geo.longitude);

/** Google Maps query URL for a geolocation with finite coordinates. */
const mapsUrl = (geo) => `https://www.google.com/maps?q=${geo.latitude},${geo.longitude}`;

/**
 * Format a date/time value for display, guarding against unparseable input.
 * Slack would otherwise surface the literal string "Invalid Date".
 * @param {string|number|Date} value - A value accepted by the Date constructor.
 * @param {string} [fallback='N/A'] - Returned when value is missing or invalid.
 * @returns {string} The locale-formatted date, or the fallback.
 */
function formatDate(value, fallback = 'N/A') {
  if (!value) {
    return fallback;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleString();
}

/**
 * Formats a 10-digit phone number into (999) 999-9999.
 * @param {string|number} phone - The phone number to format.
 * @returns {string|null} The number formatted as (999) 999-9999; the original
 *   string value if it is not exactly 10 digits; or null if input is empty/falsy.
 */
function formatPhoneNumber(phone) {
  if (!phone) {
    return null;
  }
  const originalPhone = String(phone);
  const phoneNumber = originalPhone.replace(/[^\d]/g, '');
  if (phoneNumber.length === 10) {
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6)}`;
  }
  return originalPhone; // Return original string value if not a 10-digit number
}

/**
 * Build the MCP CarrierInformation URL for a carrier.
 * URL-encodes the identifiers and omits the DocketNumber segment when the
 * carrier has no docket (MC) number, so the link never contains a literal
 * "null" or "undefined".
 * @param {object} carrier - Carrier object with dotNumber and optional docketNumber
 * @returns {string} - MCP carrier information URL
 */
function buildCarrierUrl(carrier) {
  let url = 'https://mycarrierpackets.com/CarrierInformation';
  if (carrier?.dotNumber) {
    url += `/DOTNumber/${encodeURIComponent(carrier.dotNumber)}`;
  }
  if (carrier?.docketNumber) {
    url += `/DocketNumber/${encodeURIComponent(carrier.docketNumber)}`;
  }
  return url;
}

/**
 * Build the single-button "View in MCP" actions block linking to the carrier.
 * @param {object} carrier - eventData.carrier
 * @param {string} [label="View in MCP"] - Button label.
 * @returns {object} - A Slack "actions" block with one primary button.
 */
function buildViewInMcpAction(carrier, label = "View in MCP") {
  return {
    type: "actions",
    elements: [
      {
        type: "button",
        text: { type: "plain_text", text: label, emoji: true },
        url: buildCarrierUrl(carrier),
        style: "primary"
      }
    ]
  };
}

/**
 * Heading text and accent color for each incident_report sub-event. They share
 * an identical payload shape and differ only in these two literals.
 */
const INCIDENT_CONFIG = {
  'carrier.incident_report.created': { header: '⚠️ New Incident Report Created', color: '#E01E5A' },
  'carrier.incident_report.updated': { header: '🔄 Incident Report Updated', color: '#ECB22E' },
  'carrier.incident_report.retracted': { header: '❌ Incident Report Retracted', color: '#7B7B7B' }
};

/**
 * Main formatter function that dispatches to specific formatters based on event type
 * @param {string} eventType - The MCP webhook event type
 * @param {string} eventDateTime - ISO 8601 timestamp of the event
 * @param {object} eventData - The event data payload
 * @returns {object} - Formatted Slack message with blocks, attachments and fallback text
 */
function formatSlackMessage(eventType, eventDateTime, eventData) {
  // Guard the container itself: a webhook body missing `eventData` arrives here
  // as null/undefined. Without this, every `eventData.carrier?.` below throws,
  // and since app.js has already 200'd the request, the event is silently lost.
  eventData = eventData || {};

  const formattedDate = formatDate(eventDateTime);

  // Basic carrier info section that's common to all events
  const carrierSection = {
    type: "section",
    fields: [
      md(`*Carrier:* ${eventData.carrier?.legalName || 'N/A'} ${eventData.carrier?.dbaName ? `(${eventData.carrier.dbaName})` : ''}`),
      md(`*DOT Number:* ${eventData.carrier?.dotNumber || 'N/A'}`),
      md(`*MC Number:* ${eventData.carrier?.docketNumber || 'N/A'}`)
    ]
  };

  // Customer section
  const customerSection = {
    type: "section",
    fields: [
      md(`*Customer:* ${eventData.customer?.companyName || 'N/A'}`),
      md(`*Customer ID:* ${eventData.customer?.customerID ?? 'N/A'}`)
    ]
  };

  // Timestamp and event context
  const contextSection = {
    type: "context",
    elements: [md(`Event occurred at *${formattedDate}*`)]
  };

  // Call the appropriate formatter based on eventType
  switch (eventType) {
    case 'carrier.packet.completed':
      return formatPacketCompletedMessage(eventData, carrierSection, customerSection, contextSection);
    case 'carrier.incident_report.created':
    case 'carrier.incident_report.updated':
    case 'carrier.incident_report.retracted': {
      const { header, color } = INCIDENT_CONFIG[eventType];
      return formatIncidentReportMessage(header, color, eventData, carrierSection, customerSection, contextSection);
    }
    case 'carrier.vin_verification.completed':
      return formatVinVerificationCompletedMessage(eventData, carrierSection, customerSection, contextSection);
    case 'carrier.user_verification.completed':
      return formatUserVerificationCompletedMessage(formattedDate, eventData, carrierSection, customerSection, contextSection);
    default:
      return formatDefaultMessage(eventType, eventData, carrierSection, customerSection, contextSection);
  }
}

/**
 * Format message for carrier.packet.completed event
 */
function formatPacketCompletedMessage(eventData, carrierSection, customerSection, contextSection) {
  const packetCompletedHeader = {
    type: "header",
    text: { type: "plain_text", text: "🎉 Carrier Packet Completed", emoji: true }
  };

  const blocks = [
    packetCompletedHeader,
    { type: "divider" },
    carrierSection
  ];

  // Agreement signer and signature-location details.
  // Guard against payloads that omit the optional agreement block.
  if (eventData.agreement) {
    const signerSection = {
      type: "section",
      fields: [
        md(`*Signed By:* ${eventData.agreement.signaturePerson || 'N/A'}`),
        md(`*Title:* ${eventData.agreement.signaturePersonTitle || 'N/A'}`),
        md(`*Email:* ${eventData.agreement.signaturePersonEmail || 'N/A'}`),
        md(`*Phone:* ${formatPhoneNumber(eventData.agreement.signaturePersonPhoneNumber) || 'N/A'}`)
      ]
    };
    if (eventData.agreement.signatureDate) {
      signerSection.fields.push(md(`*Signed On:* ${formatDate(eventData.agreement.signatureDate)}`));
    }
    blocks.push(signerSection);

    const locationParts = [
      eventData.agreement.ipAddress?.city,
      eventData.agreement.ipAddress?.region,
      eventData.agreement.ipAddress?.country
    ].filter(Boolean).join(', ');

    blocks.push({
      type: "section",
      fields: [
        md(`*Location:* ${locationParts || 'N/A'}`),
        md(`*IP Address:* ${eventData.agreement.ipAddress?.address || 'N/A'}`)
      ]
    });
  }

  blocks.push(customerSection, contextSection);

  // Geolocation context (if available)
  if (eventData.agreement?.geolocation) {
    const geo = eventData.agreement.geolocation;
    const elements = [];
    if (hasCoordinates(geo)) {
      elements.push(md(`📍 Coordinates: ${geo.latitude}, ${geo.longitude} (via ${geo.method || 'N/A'})`));
      elements.push(md(`<${mapsUrl(geo)}|View on Google Maps>`));
    } else {
      // No usable coordinates — surface the reported reason instead of rendering "undefined, undefined".
      elements.push(md(`📍 Coordinates unavailable${geo.error ? `: ${geo.error}` : ''}`));
    }
    blocks.push({ type: "context", elements });
  }

  blocks.push(buildViewInMcpAction(eventData.carrier));

  return {
    blocks,
    attachments: [{ color: "#36C5F0", blocks: [] }],
    fallbackText: `🎉 Carrier Packet Completed - ${eventData.carrier?.legalName || 'N/A'} (DOT: ${eventData.carrier?.dotNumber || 'N/A'})`
  };
}

/**
 * Assemble the Slack blocks describing an incident report from the documented
 * `eventData.incidentReport` object. Shared by the created/updated/retracted
 * formatters, whose payloads are identical in shape.
 * @param {object} incidentReport - The eventData.incidentReport object.
 * @returns {object[]} Section/context blocks describing the incident.
 */
function buildIncidentReportBlocks(incidentReport = {}) {
  const origin = [incidentReport.originCity, incidentReport.originStateProvinceName].filter(Boolean).join(', ');
  const destination = [incidentReport.destinationCity, incidentReport.destinationStateProvinceName].filter(Boolean).join(', ');
  const route = origin && destination ? `${origin} → ${destination}` : (origin || destination || 'N/A');
  const incidentTypes = Array.isArray(incidentReport.incidentTypes) && incidentReport.incidentTypes.length
    ? incidentReport.incidentTypes.join(', ')
    : 'N/A';

  const detailFields = [
    md(`*Incident Type(s):* ${incidentTypes}`),
    md(`*Incident Date:* ${incidentReport.incidentDate || 'N/A'}`),
    md(`*Reported By:* ${incidentReport.reportedByCompany || 'N/A'}`),
    md(`*Route:* ${route}`)
  ];
  if (incidentReport.carrierEmails) {
    detailFields.push(md(`*Carrier Email(s):* ${incidentReport.carrierEmails}`));
  }

  const blocks = [{ type: "section", fields: detailFields }];

  // Comments (each: commenterType, commentBy, commentDate, comment).
  const comments = Array.isArray(incidentReport.comments) ? incidentReport.comments : [];
  if (comments.length) {
    const lines = comments.map((c) => {
      const who = [c.commenterType, c.commentBy].filter(Boolean).join(' · ');
      const when = c.commentDate ? ` (${formatDate(c.commentDate)})` : '';
      return `> *${who || 'Comment'}*${when}: ${c.comment || ''}`;
    });
    blocks.push({ type: "section", text: md(`*Comments:*\n${lines.join('\n')}`) });
  }

  // Audit trail: who created and, if different, who last modified the report.
  const auditLines = [];
  if (incidentReport.createdBy || incidentReport.createdDate) {
    const when = formatDate(incidentReport.createdDate);
    auditLines.push(`Created by ${incidentReport.createdBy || 'N/A'} on ${when}`);
  }
  if (incidentReport.modifiedDate && incidentReport.modifiedDate !== incidentReport.createdDate) {
    const when = formatDate(incidentReport.modifiedDate);
    auditLines.push(`Last modified by ${incidentReport.modifiedBy || 'N/A'} on ${when}`);
  }
  if (auditLines.length) {
    blocks.push({ type: "context", elements: auditLines.map((text) => md(text)) });
  }

  return blocks;
}

/**
 * Shared renderer for the three incident_report events. They carry an identical
 * payload shape and differ only in heading, accent color, and fallback text.
 */
function formatIncidentReportMessage(headerText, color, eventData, carrierSection, customerSection, contextSection) {
  return {
    blocks: [
      { type: "header", text: { type: "plain_text", text: headerText, emoji: true } },
      { type: "divider" },
      carrierSection,
      ...buildIncidentReportBlocks(eventData.incidentReport),
      customerSection,
      contextSection,
      buildViewInMcpAction(eventData.carrier, "View Carrier in MCP")
    ],
    attachments: [{ color, blocks: [] }],
    fallbackText: `${headerText} - ${eventData.carrier?.legalName || 'N/A'} (DOT: ${eventData.carrier?.dotNumber || 'N/A'})`
  };
}

/**
 * Format message for carrier.vin_verification.completed event
 */
function formatVinVerificationCompletedMessage(eventData, carrierSection, customerSection, contextSection) {
  const vinVerificationHeader = {
    type: "header",
    text: { type: "plain_text", text: "🚚 VIN Verification Completed", emoji: true }
  };

  const vin = eventData.vinVerificationDetail || {};

  const vinDetails = {
    type: "section",
    fields: [
      md(`*VIN:* ${vin.vin || 'N/A'}`),
      md(`*Status:* ${vin.vinVerificationStatus || 'Completed'}`)
    ]
  };

  // otherDOTNumber is only meaningful when the VIN maps to a different carrier.
  if (vin.vinVerificationStatus === 'VINBelongsToAnotherCarrier') {
    vinDetails.fields.push(md(`*Other DOT:* ${vin.otherDOTNumber || 'N/A'}`));
  }

  // Uploader attribution (documented fields).
  const uploadedBy = fullName(vin.imageUploadedByFirstName, vin.imageUploadedByLastName);
  if (uploadedBy) {
    vinDetails.fields.push(md(`*Uploaded By:* ${uploadedBy}`));
  }
  if (vin.imageUploadedDateTime) {
    vinDetails.fields.push(md(`*Uploaded At:* ${formatDate(vin.imageUploadedDateTime)}`));
  }

  const blocks = [
    vinVerificationHeader,
    { type: "divider" },
    carrierSection,
    vinDetails
  ];

  // Location of the uploaded image, when coordinates are usable.
  const geo = vin.imageUploadedGeolocation;
  if (hasCoordinates(geo)) {
    blocks.push({
      type: "section",
      fields: [
        md(`*Image Location:* <${mapsUrl(geo)}|${geo.latitude}, ${geo.longitude}>`),
        md(`*Location Method:* ${geo.method || 'N/A'}`)
      ]
    });
  }

  const actions = buildViewInMcpAction(eventData.carrier);
  // Direct link to the submitted VIN image, when provided. Slack rejects the
  // entire message if a button url is not a valid http(s) URL, so validate it.
  if (/^https?:\/\//.test(vin.vinImageUrl || '')) {
    actions.elements.push({
      type: "button",
      text: { type: "plain_text", text: "View VIN Image", emoji: true },
      url: vin.vinImageUrl
    });
  }

  blocks.push(customerSection, contextSection, actions);

  return {
    blocks,
    attachments: [{ color: "#2EB67D", blocks: [] }],
    fallbackText: `🚚 VIN Verification Completed - ${eventData.carrier?.legalName || 'N/A'} (DOT: ${eventData.carrier?.dotNumber || 'N/A'})`
  };
}

/**
 * Format message for carrier.user_verification.completed event
 */
function formatUserVerificationCompletedMessage(formattedDate, eventData, carrierSection, customerSection, contextSection) {
  const userVerificationHeader = {
    type: "header",
    text: { type: "plain_text", text: "👤 User Verification Completed", emoji: true }
  };

  const user = eventData.userVerificationDetail || {};

  const userDetails = {
    type: "section",
    fields: [
      md(`*Name:* ${fullName(user.firstName, user.lastName) || 'N/A'}`),
      md(`*Role:* ${user.role || 'N/A'} ${user.otherRole ? `(${user.otherRole})` : ''}`),
      md(`*Status:* ${user.verificationStatus || 'Completed'}`),
      md(`*Phone:* ${formatPhoneNumber(user.phoneNumber) || 'N/A'}`)
    ]
  };

  // Verification-specific timestamp (falls back to the event time when absent).
  const verificationTimestamp = user.verificationDatetime
    ? formatDate(user.verificationDatetime)
    : formattedDate;

  const verificationTimestampSection = {
    type: "context",
    elements: [md(`Verification completed at *${verificationTimestamp}*`)]
  };

  // Status-based color coding
  let color = "#2EB67D"; // Default green for verified
  if (user.verificationStatus === 'Denied') {
    color = "#E01E5A"; // Red for denied
  } else if (user.verificationStatus === 'FollowUp' || user.verificationStatus === 'Pending') {
    color = "#ECB22E"; // Yellow for follow-up/pending
  }

  return {
    blocks: [
      userVerificationHeader,
      { type: "divider" },
      carrierSection,
      userDetails,
      customerSection,
      verificationTimestampSection,
      contextSection,
      buildViewInMcpAction(eventData.carrier)
    ],
    attachments: [{ color, blocks: [] }],
    fallbackText: `👤 User Verification Completed - ${eventData.carrier?.legalName || 'N/A'} (DOT: ${eventData.carrier?.dotNumber || 'N/A'})`
  };
}

/**
 * Default formatter for unknown event types
 */
function formatDefaultMessage(eventType, eventData, carrierSection, customerSection, contextSection) {
  const genericHeader = {
    type: "header",
    text: { type: "plain_text", text: `📢 MCP Event: ${eventType}`, emoji: true }
  };

  return {
    blocks: [
      genericHeader,
      { type: "divider" },
      carrierSection,
      customerSection,
      contextSection,
      buildViewInMcpAction(eventData.carrier)
    ],
    attachments: [{ color: "#9B59B6", blocks: [] }],
    fallbackText: `📢 MCP Event: ${eventType} - ${eventData.carrier?.legalName || 'N/A'} (DOT: ${eventData.carrier?.dotNumber || 'N/A'})`
  };
}

module.exports = {
  formatSlackMessage,
  formatPhoneNumber
};
