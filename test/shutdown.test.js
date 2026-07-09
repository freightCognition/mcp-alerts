// Assertion-based unit tests for utils/shutdown.js
// Run with: npm test   (node --test "test/**/*.test.js")

const { test, mock } = require('node:test');
const assert = require('node:assert/strict');

const { gracefulShutdown } = require('../utils/shutdown');

function fakeSlackApp(stopImpl) {
  return { stop: stopImpl || (() => Promise.resolve()) };
}

test('waits for the HTTP server to finish draining before resolving', async () => {
  let closeCallbackFired = false;
  const httpServer = {
    close: (cb) => {
      // Simulate a connection that is still draining when close() is called.
      setImmediate(() => {
        closeCallbackFired = true;
        cb();
      });
    }
  };

  await gracefulShutdown({
    httpServer,
    slackApp: fakeSlackApp(),
    timeoutMs: 1000
  });

  assert.equal(closeCallbackFired, true);
});

test('resolves once both the HTTP server and Slack app finish, without waiting for the timeout', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });

  const httpServer = { close: (cb) => cb() };
  let resolved = false;

  const shutdownPromise = gracefulShutdown({
    httpServer,
    slackApp: fakeSlackApp(),
    timeoutMs: 5000
  }).then(() => { resolved = true; });

  await shutdownPromise;
  assert.equal(resolved, true);
});

test('forces resolution after timeoutMs if slackApp.stop() hangs', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });

  const httpServer = { close: (cb) => cb() };
  const hangingSlackApp = fakeSlackApp(() => new Promise(() => {})); // never resolves

  const errors = [];
  const shutdownPromise = gracefulShutdown({
    httpServer,
    slackApp: hangingSlackApp,
    timeoutMs: 5000,
    logError: (msg) => errors.push(msg)
  });

  t.mock.timers.tick(5000);
  await shutdownPromise;

  assert.equal(errors.length, 1);
  assert.match(errors[0], /did not complete within 5000ms/);
});

test('does not log a spurious forced-exit message after a clean shutdown', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });

  const httpServer = { close: (cb) => cb() };
  const errors = [];

  await gracefulShutdown({
    httpServer,
    slackApp: fakeSlackApp(),
    timeoutMs: 5000,
    logError: (msg) => errors.push(msg)
  });

  // Advance time past the timeout window; a lingering, uncleared timer
  // would fire the "forced exit" log even though shutdown already completed.
  t.mock.timers.tick(5000);

  assert.equal(errors.length, 0);
});

test('logs and does not throw when slackApp.stop() rejects', async () => {
  const httpServer = { close: (cb) => cb() };
  const errors = [];

  await gracefulShutdown({
    httpServer,
    slackApp: fakeSlackApp(() => Promise.reject(new Error('boom'))),
    timeoutMs: 1000,
    logError: (msg, err) => errors.push([msg, err])
  });

  assert.equal(errors.length, 1);
  assert.equal(errors[0][1].message, 'boom');
});

test('resolves immediately when there is no HTTP server to close', async () => {
  await gracefulShutdown({
    httpServer: undefined,
    slackApp: fakeSlackApp(),
    timeoutMs: 1000
  });
  // No assertion needed beyond "did not throw / hang" — completion is the proof.
});
