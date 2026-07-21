export const GRID_ACTIVITY_STATES = Object.freeze([
  'working',
  'attention',
  'complete',
  'error',
]);

export function gridWorkspaceSummary(gridSlots, sessions) {
  const sessionsById = new Map(sessions.map((session) => [session.id, session]));
  const panes = gridSlots.flatMap((id) => {
    const session = id ? sessionsById.get(id) : undefined;
    return session ? [session] : [];
  });
  const counts = Object.fromEntries(GRID_ACTIVITY_STATES.map((state) => [state, 0]));
  for (const pane of panes) {
    if (Object.hasOwn(counts, pane.agentStatus)) counts[pane.agentStatus] += 1;
  }
  return { paneCount: panes.length, counts };
}

export function nextGridSessionWithStatus(gridSlots, sessions, status, activeId) {
  if (!GRID_ACTIVITY_STATES.includes(status)) return null;
  const sessionsById = new Map(sessions.map((session) => [session.id, session]));
  const matchingIds = gridSlots.filter((id) => {
    const session = id ? sessionsById.get(id) : undefined;
    return session?.agentStatus === status;
  });
  if (matchingIds.length === 0) return null;
  const activeIndex = matchingIds.indexOf(activeId);
  return matchingIds[(activeIndex + 1) % matchingIds.length];
}
