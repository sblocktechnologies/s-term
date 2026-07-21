const test = require('node:test');
const assert = require('node:assert/strict');

const sessions = [
  { id: 'one', agentStatus: 'working' },
  { id: 'two', agentStatus: 'attention' },
  { id: 'three', agentStatus: 'working' },
  { id: 'sidebar-only', agentStatus: 'error' },
];

test('summarizes only terminals assigned to grid panes', async () => {
  const { gridWorkspaceSummary } = await import('../src/workspaceSummary.js');
  assert.deepEqual(
    gridWorkspaceSummary(['one', 'two', null, 'three'], sessions),
    {
      paneCount: 3,
      counts: { working: 2, attention: 1, complete: 0, error: 0 },
    },
  );
});

test('cycles through grid panes with a selected agent status', async () => {
  const { nextGridSessionWithStatus } = await import('../src/workspaceSummary.js');
  const slots = ['one', 'two', null, 'three'];
  assert.equal(nextGridSessionWithStatus(slots, sessions, 'working', ''), 'one');
  assert.equal(nextGridSessionWithStatus(slots, sessions, 'working', 'one'), 'three');
  assert.equal(nextGridSessionWithStatus(slots, sessions, 'working', 'three'), 'one');
  assert.equal(nextGridSessionWithStatus(slots, sessions, 'error', ''), null);
});
