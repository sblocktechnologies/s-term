const test = require('node:test');
const assert = require('node:assert/strict');

function ids(sessions) {
  return sessions.map((session) => session.id);
}

test('normalizes pinned sessions to the top while preserving group order', async () => {
  const { normalizePinnedSessions } = await import('../src/sidebarSessions.js');
  const sessions = [
    { id: 'a', pinned: false },
    { id: 'b', pinned: true },
    { id: 'c', pinned: false },
    { id: 'd', pinned: true },
  ];
  assert.deepEqual(ids(normalizePinnedSessions(sessions)), ['b', 'd', 'a', 'c']);
});

test('pinning and unpinning move sessions to the group boundary', async () => {
  const { toggleSessionPin } = await import('../src/sidebarSessions.js');
  const sessions = [
    { id: 'a', pinned: true },
    { id: 'b', pinned: false },
    { id: 'c', pinned: false },
  ];

  const pinned = toggleSessionPin(sessions, 'c');
  assert.deepEqual(ids(pinned), ['a', 'c', 'b']);
  assert.equal(pinned[1].pinned, true);

  const unpinned = toggleSessionPin(pinned, 'a');
  assert.deepEqual(ids(unpinned), ['c', 'a', 'b']);
  assert.equal(unpinned[1].pinned, false);
});

test('reorders sidebar sessions within their pinned group', async () => {
  const { reorderSidebarSessions } = await import('../src/sidebarSessions.js');
  const sessions = [
    { id: 'a', pinned: true },
    { id: 'b', pinned: true },
    { id: 'c', pinned: false },
    { id: 'd', pinned: false },
  ];

  assert.deepEqual(ids(reorderSidebarSessions(sessions, 'd', 'c', 'before')), ['a', 'b', 'd', 'c']);
  assert.deepEqual(ids(reorderSidebarSessions(sessions, 'a', 'b', 'after')), ['b', 'a', 'c', 'd']);
  assert.equal(reorderSidebarSessions(sessions, 'c', 'a', 'before'), sessions);
});
