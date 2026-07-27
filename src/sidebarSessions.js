export function normalizePinnedSessions(sessions) {
  return [
    ...sessions.filter((session) => session.pinned),
    ...sessions.filter((session) => !session.pinned),
  ];
}

export function toggleSessionPin(sessions, sessionId) {
  const index = sessions.findIndex((session) => session.id === sessionId);
  if (index < 0) return sessions;

  const next = [...sessions];
  const [session] = next.splice(index, 1);
  const updated = { ...session, pinned: !session.pinned };
  const pinnedCount = next.filter((item) => item.pinned).length;
  next.splice(pinnedCount, 0, updated);
  return next;
}

export function sortSidebarSessionsByRecency(sessions) {
  const sorted = sessions
    .map((session, index) => ({ session, index }))
    .sort((left, right) => {
      const pinDifference = Number(Boolean(right.session.pinned)) - Number(Boolean(left.session.pinned));
      if (pinDifference !== 0) return pinDifference;
      const leftTimestamp = left.session.lastMessageAt || left.session.createdAt || 0;
      const rightTimestamp = right.session.lastMessageAt || right.session.createdAt || 0;
      return rightTimestamp - leftTimestamp || left.index - right.index;
    })
    .map(({ session }) => session);
  return sorted.every((session, index) => session === sessions[index]) ? sessions : sorted;
}

export function reorderSidebarSessions(sessions, sourceId, targetId, position = 'before') {
  if (sourceId === targetId) return sessions;
  const sourceIndex = sessions.findIndex((session) => session.id === sourceId);
  const target = sessions.find((session) => session.id === targetId);
  if (sourceIndex < 0 || !target) return sessions;

  const source = sessions[sourceIndex];
  if (Boolean(source.pinned) !== Boolean(target.pinned)) return sessions;

  const next = [...sessions];
  next.splice(sourceIndex, 1);
  const targetIndex = next.findIndex((session) => session.id === targetId);
  next.splice(targetIndex + (position === 'after' ? 1 : 0), 0, source);
  return next;
}
