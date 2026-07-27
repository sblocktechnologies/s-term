const test = require('node:test');
const assert = require('node:assert/strict');

const validated = {
  id: '019f9a2b-a748-7352-bd15-9b7f8565850c',
  path: '/Users/air/.pi/agent/sessions/project/session.jsonl',
  cwd: '/Users/air/project',
  modifiedAt: 1234,
};

test('promotes a validated Pi identity when it has no owner', async () => {
  const { stageValidatedPiSession } = await import('../src/piSessionPromotion.js');
  const sessions = [{ id: 'shell', agentName: 'pi', createdAt: 100 }];
  const next = stageValidatedPiSession(sessions, 'shell', validated);

  assert.deepEqual(next[0].launch, {
    type: 'pi-session',
    piSessionId: validated.id,
    piSessionPath: validated.path,
  });
  assert.equal(next[0].cwd, validated.cwd);
  assert.equal(next[0].lastMessageAt, validated.modifiedAt);
});

test('keeps a validated identity pending while another tab owns it', async () => {
  const { stageValidatedPiSession } = await import('../src/piSessionPromotion.js');
  const sessions = [
    {
      id: 'owner',
      launch: {
        type: 'pi-session',
        piSessionId: validated.id,
        piSessionPath: validated.path,
      },
    },
    { id: 'shell', agentName: 'pi' },
  ];
  const next = stageValidatedPiSession(sessions, 'shell', validated);

  assert.equal(next[1].launch, undefined);
  assert.deepEqual(next[1].pendingPiLaunch, {
    type: 'pi-session',
    piSessionId: validated.id,
    piSessionPath: validated.path,
    cwd: validated.cwd,
    modifiedAt: validated.modifiedAt,
  });
  assert.equal(stageValidatedPiSession(next, 'shell', validated), next);
});

test('promotes the waiting tab immediately after the owner closes', async () => {
  const { promotePendingPiSessions, stageValidatedPiSession } = await import('../src/piSessionPromotion.js');
  const owner = {
    id: 'owner',
    launch: {
      type: 'pi-session',
      piSessionId: validated.id,
      piSessionPath: validated.path,
    },
  };
  const waiting = stageValidatedPiSession([owner, { id: 'shell', agentName: 'pi' }], 'shell', validated)[1];
  const next = promotePendingPiSessions([waiting]);

  assert.deepEqual(next[0].launch, owner.launch);
  assert.equal(next[0].pendingPiLaunch, undefined);
  assert.equal(next[0].cwd, validated.cwd);
  assert.equal(next[0].lastMessageAt, validated.modifiedAt);
});

test('warns only for Pi running without a saved launch', async () => {
  const { piSessionNeedsRestartWarning } = await import('../src/piSessionPromotion.js');
  assert.equal(piSessionNeedsRestartWarning({ id: 'shell', agentName: 'pi' }), true);
  assert.equal(piSessionNeedsRestartWarning({ id: 'shell', agentName: 'claude' }), false);
  assert.equal(piSessionNeedsRestartWarning({
    id: 'pi',
    agentName: 'pi',
    launch: {
      type: 'pi-session',
      piSessionId: validated.id,
      piSessionPath: validated.path,
    },
  }), false);
});
