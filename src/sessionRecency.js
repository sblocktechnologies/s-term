export function compactElapsedSince(timestamp, now = Date.now()) {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '--';
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 100) return `${days}d`;
  if (days < 365) return `${Math.floor(days / 7)}w`;
  return `${Math.floor(days / 365)}y`;
}

export function sessionRecency(session, now = Date.now()) {
  const hasMessage = Number.isFinite(session.lastMessageAt) && session.lastMessageAt > 0;
  const timestamp = hasMessage ? session.lastMessageAt : session.createdAt;
  const elapsed = compactElapsedSince(timestamp, now);
  return {
    elapsed,
    title: hasMessage ? `Last message ${elapsed} ago` : `No messages yet · opened ${elapsed} ago`,
  };
}
