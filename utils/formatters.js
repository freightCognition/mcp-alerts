/**
 * Format MCP webhook events into rich Slack messages
 */

/**
 * Main formatter function that dispatches to specific formatters based on event type
 * @param {string} eventType - The MCP webhook event type
 * @param {string} eventDateTime - ISO 8601 timestamp of the event
 * @param {object} eventData - The event data payload
 * @returns {object} - Formatted Slack message with blocks, attachments and fallback text
 */
function formatSlackMessage(eventType, eventDateTime, eventData) {
  const date = new Date(eventDateTime);
  const formattedDate = date.toLocaleString();
  
  // Basic carrier info section that's common to all events
  const carrierSection = {
    type: "section",
    fields: [
      {
        type: "mrkdwn",
        text: `*Carrier:* ${eventData.carrier.legalName} ${eventData.carrier.dbaName ? `(${eventData.carrier.dbaName})` : ''}`
      },
      {
        type: "mrkdwn",
        text: `*DOT Number:* ${eventData.carrier.dotNumber}`
      },
      {
        type: "mrkdwn",
        text: `*MC Number:* ${eventData.carrier.docketNumber || 'N/A'}`
      }
    ]
  };

  // Customer section
  const customerSection = {
    type: "section",
    fields: [
      {
        type: "mrkdwn",
        text: `*Customer:* ${eventData.customer.companyName}`
      },
      {
        type: "mrkdwn",
        text: `*Customer ID:* ${eventData.customer.customerID}`
      }
    ]
  };

  // Timestamp and event context
  const contextSection = {
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `Event occurred at *${formattedDate}*`
      }
    ]
  };

  // Call the appropriate formatter based on eventType
  switch (eventType) {
    case 'carrier.packet.completed':
      return formatPacketCompletedMessage(eventType, formattedDate, eventData, carrierSection, customerSection, contextSection);
    case 'carrier.incident_report.created':
      return formatIncidentReportCreatedMessage(eventType, formattedDate, eventData, carrierSection, customerSection, contextSection);
    case 'carrier.incident_report.updated':
      return formatIncidentReportUpdatedMessage(eventType, formattedDate, eventData, carrierSection, customerSection, contextSection);
    case 'carrier.incident_report.retracted':
      return formatIncidentReportRetractedMessage(eventType, formattedDate, eventData, carrierSection, customerSection, contextSection);
    case 'carrier.vin_verification.completed':
      return formatVinVerificationCompletedMessage(eventType, formattedDate, eventData, carrierSection, customerSection, contextSection);
    case 'carrier.user_verification.completed':
      return formatUserVerificationCompletedMessage(eventType, formattedDate, eventData, carrierSection, customerSection, contextSection);
    default:
      return formatDefaultMessage(eventType, formattedDate, eventData, carrierSection, customerSection, contextSection);
  }
}

/**
 * Format message for carrier.packet.completed event
 */
function formatPacketCompletedMessage(eventType, formattedDate, eventData, carrierSection, customerSection, contextSection) {
  const packetCompletedHeader = {
    type: "header",
    text: {
      type: "plain_text",
      text: "🎉 Carrier Packet Completed",
      emoji: true
    }
  };

  const packetDetails = {
    type: "section",
    fields: [
      {
        type: "mrkdwn",
        text: `*Packet Type:* ${eventData.packetDetail?.packetType || 'Standard'}`
      },
      {
        type: "mrkdwn",
        text: `*Completion Date:* ${new Date(eventData.packetDetail?.completionDatetime || formattedDate).toLocaleString()}`
      }
    ]
  };

  // Action buttons
  const actions = {
    type: "actions",
    elements: [
      {
        type: "button",
        text: {
          type: "plain_text",
          text: "View in MCP",
          emoji: true
        },
        url: `https://mycarrierpackets.com/carriers/${eventData.carrier.dotNumber}`,
        style: "primary"
      }
    ]
  };

  return {
    blocks: [
      packetCompletedHeader,
      {
        type: "divider"
      },
      carrierSection,
      packetDetails,
      customerSection,
      contextSection,
      actions
    ],
    attachments: [
      {
        color: "#36C5F0",
        blocks: []
      }
    ],
    fallbackText: `🎉 Carrier Packet Completed - ${eventData.carrier.legalName} (DOT: ${eventData.carrier.dotNumber})`
  };
}

/**
 * Format message for carrier.incident_report.created event
 */
function formatIncidentReportCreatedMessage(eventType, formattedDate, eventData, carrierSection, customerSection, contextSection) {
  const incidentReportHeader = {
    type: "header",
    text: {
      type: "plain_text",
      text: "⚠️ New Incident Report Created",
      emoji: true
    }
  };

  const incidentDetails = {
    type: "section",
    fields: [
      {
        type: "mrkdwn",
        text: `*Incident Type:* ${eventData.incidentReportDetail?.incidentType || 'N/A'}`
      },
      {
        type: "mrkdwn",
        text: `*Incident Date:* ${eventData.incidentReportDetail?.incidentDatetime ? new Date(eventData.incidentReportDetail.incidentDatetime).toLocaleString() : 'N/A'}`
      },
      {
        type: "mrkdwn",
        text: `*Status:* ${eventData.incidentReportDetail?.status || 'New'}`
      },
      {
        type: "mrkdwn",
        text: `*Reporter:* ${eventData.incidentReportDetail?.reportedBy || 'Anonymous'}`
      }
    ]
  };

  const actions = {
    type: "actions",
    elements: [
      {
        type: "button",
        text: {
          type: "plain_text",
          text: "View Incident",
          emoji: true
        },
        url: `https://mycarrierpackets.com/incident-reports/${eventData.incidentReportDetail?.incidentReportID || ''}`,
        style: "primary"
      }
    ]
  };

  return {
    blocks: [
      incidentReportHeader,
      {
        type: "divider"
      },
      carrierSection,
      incidentDetails,
      customerSection,
      contextSection,
      actions
    ],
    attachments: [
      {
        color: "#E01E5A",
        blocks: []
      }
    ],
    fallbackText: `⚠️ New Incident Report Created - ${eventData.carrier.legalName} (DOT: ${eventData.carrier.dotNumber})`
  };
}

/**
 * Format message for carrier.incident_report.updated event
 */
function formatIncidentReportUpdatedMessage(eventType, formattedDate, eventData, carrierSection, customerSection, contextSection) {
  const incidentReportHeader = {
    type: "header",
    text: {
      type: "plain_text",
      text: "🔄 Incident Report Updated",
      emoji: true
    }
  };

  const incidentDetails = {
    type: "section",
    fields: [
      {
        type: "mrkdwn",
        text: `*Incident Type:* ${eventData.incidentReportDetail?.incidentType || 'N/A'}`
      },
      {
        type: "mrkdwn",
        text: `*Incident Date:* ${eventData.incidentReportDetail?.incidentDatetime ? new Date(eventData.incidentReportDetail.incidentDatetime).toLocaleString() : 'N/A'}`
      },
      {
        type: "mrkdwn",
        text: `*Status:* ${eventData.incidentReportDetail?.status || 'Updated'}`
      },
      {
        type: "mrkdwn",
        text: `*Reporter:* ${eventData.incidentReportDetail?.reportedBy || 'Anonymous'}`
      }
    ]
  };

  const actions = {
    type: "actions",
    elements: [
      {
        type: "button",
        text: {
          type: "plain_text",
          text: "View Incident",
          emoji: true
        },
        url: `https://mycarrierpackets.com/incident-reports/${eventData.incidentReportDetail?.incidentReportID || ''}`,
        style: "primary"
      }
    ]
  };

  return {
    blocks: [
      incidentReportHeader,
      {
        type: "divider"
      },
      carrierSection,
      incidentDetails,
      customerSection,
      contextSection,
      actions
    ],
    attachments: [
      {
        color: "#ECB22E",
        blocks: []
      }
    ],
    fallbackText: `🔄 Incident Report Updated - ${eventData.carrier.legalName} (DOT: ${eventData.carrier.dotNumber})`
  };
}

/**
 * Format message for carrier.incident_report.retracted event
 */
function formatIncidentReportRetractedMessage(eventType, formattedDate, eventData, carrierSection, customerSection, contextSection) {
  const incidentReportHeader = {
    type: "header",
    text: {
      type: "plain_text",
      text: "❌ Incident Report Retracted",
      emoji: true
    }
  };

  const incidentDetails = {
    type: "section",
    fields: [
      {
        type: "mrkdwn",
        text: `*Incident Type:* ${eventData.incidentReportDetail?.incidentType || 'N/A'}`
      },
      {
        type: "mrkdwn",
        text: `*Incident Date:* ${eventData.incidentReportDetail?.incidentDatetime ? new Date(eventData.incidentReportDetail.incidentDatetime).toLocaleString() : 'N/A'}`
      },
      {
        type: "mrkdwn",
        text: `*Retraction Reason:* ${eventData.incidentReportDetail?.retractionReason || 'Not specified'}`
      },
      {
        type: "mrkdwn",
        text: `*Retracted By:* ${eventData.incidentReportDetail?.retractedBy || 'System'}`
      }
    ]
  };

  const actions = {
    type: "actions",
    elements: [
      {
        type: "button",
        text: {
          type: "plain_text",
          text: "View Details",
          emoji: true
        },
        url: `https://mycarrierpackets.com/incident-reports/${eventData.incidentReportDetail?.incidentReportID || ''}`,
        style: "primary"
      }
    ]
  };

  return {
    blocks: [
      incidentReportHeader,
      {
        type: "divider"
      },
      carrierSection,
      incidentDetails,
      customerSection,
      contextSection,
      actions
    ],
    attachments: [
      {
        color: "#7B7B7B",
        blocks: []
      }
    ],
    fallbackText: `❌ Incident Report Retracted - ${eventData.carrier.legalName} (DOT: ${eventData.carrier.dotNumber})`
  };
}

/**
 * Format message for carrier.vin_verification.completed event
 */
function formatVinVerificationCompletedMessage(eventType, formattedDate, eventData, carrierSection, customerSection, contextSection) {
  const vinVerificationHeader = {
    type: "header",
    text: {
      type: "plain_text",
      text: "🚚 VIN Verification Completed",
      emoji: true
    }
  };

  const vinDetails = {
    type: "section",
    fields: [
      {
        type: "mrkdwn",
        text: `*VIN:* ${eventData.vinVerificationDetail?.vin || 'N/A'}`
      },
      {
        type: "mrkdwn",
        text: `*Status:* ${eventData.vinVerificationDetail?.vinVerificationStatus || 'Completed'}`
      }
    ]
  };

  // Add additional VIN verification details if available
  if (eventData.vinVerificationDetail?.vinVerificationStatus === 'VINBelongsToAnotherCarrier') {
    vinDetails.fields.push({
      type: "mrkdwn",
      text: `*Other DOT:* ${eventData.vinVerificationDetail?.otherDOTNumber || 'N/A'}`
    });
  }

  // Location information if available
  let locationSection = null;
  if (eventData.vinVerificationDetail?.imageUploadedGeolocation) {
    const geo = eventData.vinVerificationDetail.imageUploadedGeolocation;
    locationSection = {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Image Location:* ${geo.latitude}, ${geo.longitude}`
        },
        {
          type: "mrkdwn",
          text: `*Location Method:* ${geo.method || 'N/A'}`
        }
      ]
    };
  }

  const actions = {
    type: "actions",
    elements: [
      {
        type: "button",
        text: {
          type: "plain_text",
          text: "View in MCP",
          emoji: true
        },
        url: `https://mycarrierpackets.com/carriers/${eventData.carrier.dotNumber}/vehicles`,
        style: "primary"
      }
    ]
  };

  const blocks = [
    vinVerificationHeader,
    {
      type: "divider"
    },
    carrierSection,
    vinDetails
  ];

  if (locationSection) {
    blocks.push(locationSection);
  }

  blocks.push(customerSection, contextSection, actions);

  return {
    blocks: blocks,
    attachments: [
      {
        color: "#2EB67D",
        blocks: []
      }
    ],
    fallbackText: `🚚 VIN Verification Completed - ${eventData.carrier.legalName} (DOT: ${eventData.carrier.dotNumber})`
  };
}

/**
 * Format message for carrier.user_verification.completed event
 */
function formatUserVerificationCompletedMessage(eventType, formattedDate, eventData, carrierSection, customerSection, contextSection) {
  const userVerificationHeader = {
    type: "header",
    text: {
      type: "plain_text",
      text: "👤 User Verification Completed",
      emoji: true
    }
  };

  const userDetails = {
    type: "section",
    fields: [
      {
        type: "mrkdwn",
        text: `*Name:* ${eventData.userVerificationDetail?.firstName || ''} ${eventData.userVerificationDetail?.lastName || ''}`
      },
      {
        type: "mrkdwn",
        text: `*Role:* ${eventData.userVerificationDetail?.role || 'N/A'} ${eventData.userVerificationDetail?.otherRole ? `(${eventData.userVerificationDetail.otherRole})` : ''}`
      },
      {
        type: "mrkdwn",
        text: `*Status:* ${eventData.userVerificationDetail?.verificationStatus || 'Completed'}`
      },
      {
        type: "mrkdwn",
        text: `*Phone:* ${eventData.userVerificationDetail?.phoneNumber || 'N/A'}`
      }
    ]
  };

  // Add verification timestamp if available
  const verificationTimestamp = eventData.userVerificationDetail?.verificationDatetime
    ? new Date(eventData.userVerificationDetail.verificationDatetime).toLocaleString()
    : formattedDate;

  const verificationTimestampSection = {
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `Verification completed at *${verificationTimestamp}*`
      }
    ]
  };

  const actions = {
    type: "actions",
    elements: [
      {
        type: "button",
        text: {
          type: "plain_text",
          text: "View in MCP",
          emoji: true
        },
        url: `https://mycarrierpackets.com/carriers/${eventData.carrier.dotNumber}/users`,
        style: "primary"
      }
    ]
  };

  // Status-based color coding
  let color = "#2EB67D"; // Default green for verified
  if (eventData.userVerificationDetail?.verificationStatus === 'Denied') {
    color = "#E01E5A"; // Red for denied
  } else if (eventData.userVerificationDetail?.verificationStatus === 'FollowUp' || 
             eventData.userVerificationDetail?.verificationStatus === 'Pending') {
    color = "#ECB22E"; // Yellow for follow-up/pending
  }

  return {
    blocks: [
      userVerificationHeader,
      {
        type: "divider"
      },
      carrierSection,
      userDetails,
      customerSection,
      verificationTimestampSection,
      contextSection,
      actions
    ],
    attachments: [
      {
        color: color,
        blocks: []
      }
    ],
    fallbackText: `👤 User Verification Completed - ${eventData.carrier.legalName} (DOT: ${eventData.carrier.dotNumber})`
  };
}

/**
 * Default formatter for unknown event types
 */
function formatDefaultMessage(eventType, formattedDate, eventData, carrierSection, customerSection, contextSection) {
  const genericHeader = {
    type: "header",
    text: {
      type: "plain_text",
      text: `📢 MCP Event: ${eventType}`,
      emoji: true
    }
  };

  const actions = {
    type: "actions",
    elements: [
      {
        type: "button",
        text: {
          type: "plain_text",
          text: "View in MCP",
          emoji: true
        },
        url: `https://mycarrierpackets.com/carriers/${eventData.carrier.dotNumber}`,
        style: "primary"
      }
    ]
  };

  return {
    blocks: [
      genericHeader,
      {
        type: "divider"
      },
      carrierSection,
      customerSection,
      contextSection,
      actions
    ],
    attachments: [
      {
        color: "#9B59B6",
        blocks: []
      }
    ],
    fallbackText: `📢 MCP Event: ${eventType} - ${eventData.carrier.legalName} (DOT: ${eventData.carrier.dotNumber})`
  };
}

module.exports = {
  formatSlackMessage
};