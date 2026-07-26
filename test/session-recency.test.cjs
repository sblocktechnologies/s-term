const test = require('node:test');
const assert = require('node:assert/strict');

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

test('formats compact sidebar recency across useful time ranges', async () => {
  const { compactElapsedSince } = await import('../src/sessionRecency.js');
  const now = 2_000_000_000_000;
  assert.equal(compactElapsedSince(now - 3 * SECOND, now), '3s');
  assert.equal(compactElapsedSince(now - 10 * MINUTE, now), '10m');
  assert.equal(compactElapsedSince(now - 4 * HOUR, now), '4h');
  assert.equal(compactElapsedSince(now - 2 * DAY, now), '2d');
  assert.equal(compactElapsedSince(now - 140 * DAY, now), '20w');
  assert.equal(compactElapsedSince(now - 800 * DAY, now), '2y');
  assert.equal(compactElapsedSince(now + MINUTE, now), '0s');
});

test('uses the last message and falls back to terminal creation time', async () => {
  const { sessionRecency } = await import('../src/sessionRecency.js');
  const now = 2_000_000_000_000;
  assert.deepEqual(
    sessionRecency({ createdAt: now - HOUR, lastMessageAt: now - 10 * MINUTE }, now),
    { elapsed: '10m', title: 'Last message 10m ago' },
  );
  assert.deepEqual(
    sessionRecency({ createdAt: now - 3 * SECOND }, now),
    { elapsed: '3s', title: 'No messages yet · opened 3s ago' },
  );
});
