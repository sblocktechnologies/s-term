const test = require('node:test');
const assert = require('node:assert/strict');

test('parses status and telemetry messages as distinct events', async () => {
  const { parseAgentSignal } = await import('../src/agentProtocol.js');
  assert.deepEqual(
    parseAgentSignal('sterm;v=1;state=working;agent=pi;message=Working'),
    { version: 1, event: 'status', state: 'working', agent: 'pi', message: 'Working' },
  );

  assert.deepEqual(
    parseAgentSignal('sterm;v=1;event=telemetry;agent=pi;cwd=~%2FDesktop%2Fsterm;branch=main;dirty=1;provider=anthropic;model=claude-opus;thinking=high;input=12000;output=3456;cacheRead=8000;cacheWrite=500;cost=0.125;sub=1;contextTokens=82000;contextWindow=200000;contextPercent=41'),
    {
      version: 1,
      event: 'telemetry',
      agent: 'pi',
      cwd: '~/Desktop/sterm',
      gitBranch: 'main',
      gitDirty: true,
      provider: 'anthropic',
      model: 'claude-opus',
      thinking: 'high',
      subscription: true,
      inputTokens: 12000,
      outputTokens: 3456,
      cacheReadTokens: 8000,
      cacheWriteTokens: 500,
      cost: 0.125,
      contextTokens: 82000,
      contextWindow: 200000,
      contextPercent: 41,
    },
  );
});

test('rejects malformed or unsafe telemetry fields', async () => {
  const { parseAgentSignal } = await import('../src/agentProtocol.js');
  assert.equal(parseAgentSignal('sterm;v=1;event=telemetry;agent=pi;dirty=yes'), null);
  assert.equal(parseAgentSignal('sterm;v=1;event=telemetry;agent=pi;input=-1'), null);
  assert.equal(parseAgentSignal('sterm;v=1;event=telemetry;agent=pi;contextPercent=101'), null);
  assert.equal(parseAgentSignal(`sterm;v=1;event=telemetry;agent=pi;cwd=${'x'.repeat(5000)}`), null);
});
