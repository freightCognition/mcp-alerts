# MCP-Alerts by freight.Cognition

Version 0.1.1

This application integrates MyCarrierPackets (MCP) webhooks with Slack using Socket Mode. It listens for MCP webhook events and forwards formatted messages to a specified Slack channel.

## Author

This application was built by Anthony Fecarotta (https://github.com/fakebizprez) of `freight.Cognition`.

## Features

*   Receives MCP webhooks.
*   Verifies webhook signatures for security.
*   Uses Slack Socket Mode for real-time messaging.
*   Formats messages for various MCP event types.
*   Includes a health check endpoint (`/health`).
*   Configured for Docker deployment.

## Prerequisites

Before you begin, ensure you have the following installed:

*   [Node.js](https://nodejs.org/) (version 14.0.0 or higher, as specified in `package.json`)
*   [pnpm](https://pnpm.io/installation)

## Installation and Configuration

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/mcp-alerts.git # Replace with the actual repo URL if different
    cd mcp-alerts
    ```

2.  **Install dependencies:**
    ```bash
    pnpm install
    ```

3.  **Create and Configure the Slack App:**

    Before you can configure the environment variables, you need to create a Slack app and obtain the necessary tokens. Follow these steps:

    a.  **Go to Your Slack Apps:**
        Navigate to [https://api.slack.com/apps](https://api.slack.com/apps) and click "Create New App".

    b.  **Create an App:**
        Choose "From scratch".
        Enter an "App Name" (e.g., "MCP Alerts") and select the Slack workspace where you want to install the app.
        Click "Create App".

    c.  **Enable Socket Mode:**
        In the left sidebar, under "Settings", click on "Socket Mode".
        Toggle the switch to "Enable Socket Mode".
        You'll be prompted to generate an App-Level Token. Enter a name for the token (e.g., "mcp-socket-token") and click "Generate".
        **Copy this token (it will start with `xapp-`) and save it. This will be your `SLACK_APP_TOKEN`.**

    d.  **Add Bot Scopes:**
        In the left sidebar, under "Features", click on "OAuth & Permissions".
        Scroll down to the "Scopes" section.
        Under "Bot Token Scopes", click "Add an OAuth Scope" and add the following scope:
        *   `chat:write`: Allows the app to send messages to channels it's a part of.

    e.  **Install App to Workspace:**
        At the top of the "OAuth & Permissions" page, click "Install to Workspace".
        Follow the prompts to authorize the app.
        Once installed, you will see a "Bot User OAuth Token".
        **Copy this token (it will start with `xoxb-`) and save it. This will be your `SLACK_BOT_TOKEN`.**

    f.  **Add Bot to Channel(s):**
        Open your Slack client.
        Go to the channel where you want the MCP alerts to be posted.
        Type `/invite @your-app-name` (replace `your-app-name` with the name you gave your Slack app) and send the message, or use the channel settings to add the app/bot user.

4.  **Configure environment variables:**
    Create a `.env` file in the root of the project by copying the example file:
    ```bash
    cp .env.example .env
    ```
    Then, open the `.env` file and update it with your specific credentials and settings:

    *   `SLACK_BOT_TOKEN`: Your Slack Bot Token (starts with `xoxb-`). This token is used by the app to interact with the Slack API.
    *   `SLACK_APP_TOKEN`: Your Slack App-Level Token (starts with `xapp-`). This token is used for Socket Mode connections.
    *   `SLACK_CHANNEL`: The ID or name of the Slack channel where messages will be posted (e.g., `C1234567890` or `mcp-alerts`).
    *   `MCP_WEBHOOK_SECRET`: Your MCP Webhook Signing Secret. This is used to verify the authenticity of incoming webhooks from MyCarrierPackets.
    *   `MCP_WEBHOOK_URL_PATH`: The path on your server where the application will listen for MCP webhooks (default is `/webhooks/mcp`).
    *   `PORT`: The port on which the Express server will run (default is `3001`).
    *   `PUBLIC_APP_URL`: (Optional) The public URL of your application, especially useful if you're using Cloudflare Tunnel for on-premise deployment. If set, the application will log this URL at startup.

## Running the Application

*   **To start the application in production mode:**
    ```bash
    pnpm start
    ```

*   **To start the application in development mode (with hot reloading using nodemon):**
    ```bash
    pnpm dev
    ```
    The application will be accessible at `http://localhost:PORT` (e.g., `http://localhost:3001` if using the default port).

## Testing

This application includes a utility to test the webhook signature verification and message formatting.

1.  Ensure your application is running (`pnpm start` or `pnpm dev`).
2.  You can send a test payload to your local webhook endpoint. The `test/webhook.js` script can be used for this. Modify `test-payload.json` with the desired event type and data.
3.  Run the test script:
    ```bash
    pnpm test:webhook
    ```
    This script will send the payload defined in `test-payload.json` to the `/webhooks/mcp` endpoint of your locally running application.

## Docker Deployment

This application includes a `Dockerfile` and `docker-compose.yml` for containerized deployment. Refer to those files for more details on building and running the application with Docker.

### On-Premise Deployment with Cloudflare Tunnel

If you plan to run this application on an on-premise server and need to expose it to the public internet (e.g., to receive webhooks from MyCarrierPackets), using Cloudflare Tunnel is a recommended approach for security and simplicity.

1.  **Set up Cloudflare Tunnel:** Follow Cloudflare's documentation to install `cloudflared` on your on-premise server and create a tunnel. Configure the tunnel to point to your application's local address (e.g., `http://localhost:3001` if your application is listening on port 3001).

2.  **Public URL:** Cloudflare Tunnel will provide you with a public URL (e.g., `https://your-tunnel-subdomain.trycloudflare.com` or a custom domain like `https://mcp-alerts.linehaul.cloud`).

3.  **Configure MCP Webhook Provider:** Update your MyCarrierPackets webhook configuration to send webhooks to your public Cloudflare Tunnel URL, appending the `MCP_WEBHOOK_URL_PATH`. For example: `https://mcp-alerts.linehaul.cloud/webhooks/mcp`.

4.  **Environment Variable for Public URL (Optional but Recommended):**
    You can set the `PUBLIC_APP_URL` in your `.env` file to your Cloudflare Tunnel's base URL (e.g., `PUBLIC_APP_URL=https://mcp-alerts.linehaul.cloud`). If set, the application will log this public URL at startup for clarity.

## Webhook Event Types Handled

*   `carrier.packet.completed`
*   `carrier.incident_report.created`
*   `carrier.incident_report.updated`
*   `carrier.incident_report.retracted`
*   `carrier.vin_verification.completed`
*   `carrier.user_verification.completed`
