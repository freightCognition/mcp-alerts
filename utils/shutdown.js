// Graceful shutdown helper shared by app.js's SIGTERM/SIGINT handlers.
//
// Drains the HTTP server and stops the Slack app concurrently, capping the
// whole operation at timeoutMs so a hung websocket teardown or a keep-alive
// connection that never closes can't block process exit indefinitely.

function closeHttpServer(httpServer) {
  if (!httpServer) return Promise.resolve();
  return new Promise((resolve) => httpServer.close(() => resolve()));
}

async function gracefulShutdown({ httpServer, slackApp, timeoutMs, log = console.log, logError = console.error }) {
  let timeoutId;
  const timeout = new Promise((resolve) => {
    timeoutId = setTimeout(() => {
      logError(`Shutdown did not complete within ${timeoutMs}ms, forcing exit`);
      resolve();
    }, timeoutMs);
  });

  try {
    await Promise.race([
      Promise.all([closeHttpServer(httpServer), slackApp.stop()]),
      timeout
    ]);
  } catch (error) {
    logError('Error while stopping Slack app:', error);
  } finally {
    clearTimeout(timeoutId);
  }
}

module.exports = { gracefulShutdown };
