function sameLaunch(left, right) {
  return left?.piSessionId === right?.piSessionId && left?.piSessionPath === right?.piSessionPath;
}

function conflictsWithLaunch(session, identity) {
  return session.launch?.piSessionId === identity.piSessionId ||
    session.launch?.piSessionPath === identity.piSessionPath;
}

export function validatedPiIdentity(validated) {
  return {
    type: 'pi-session',
    piSessionId: validated.id,
    piSessionPath: validated.path,
    cwd: validated.cwd,
    modifiedAt: validated.modifiedAt,
  };
}

export function stageValidatedPiSession(sessions, targetId, validated) {
  const target = sessions.find((session) => session.id === targetId);
  if (!target) return sessions;

  const identity = validatedPiIdentity(validated);
  const conflict = sessions.some((session) => session.id !== targetId && conflictsWithLaunch(session, identity));
  if (conflict) {
    if (sameLaunch(target.pendingPiLaunch, identity)) return sessions;
    return sessions.map((session) => session.id === targetId
      ? { ...session, pendingPiLaunch: identity }
      : session);
  }

  if (sameLaunch(target.launch, identity) && !target.pendingPiLaunch) return sessions;
  return sessions.map((session) => session.id === targetId
    ? {
        ...session,
        launch: {
          type: 'pi-session',
          piSessionId: identity.piSessionId,
          piSessionPath: identity.piSessionPath,
        },
        pendingPiLaunch: undefined,
        cwd: identity.cwd,
        lastMessageAt: session.lastMessageAt || identity.modifiedAt,
      }
    : session);
}

export function promotePendingPiSessions(sessions) {
  const claimedIds = new Set(sessions.flatMap((session) => session.launch?.piSessionId ? [session.launch.piSessionId] : []));
  const claimedPaths = new Set(sessions.flatMap((session) => session.launch?.piSessionPath ? [session.launch.piSessionPath] : []));
  let changed = false;

  const promoted = sessions.map((session) => {
    const pending = session.pendingPiLaunch;
    if (!pending) return session;
    if (sameLaunch(session.launch, pending)) {
      changed = true;
      return { ...session, pendingPiLaunch: undefined };
    }
    if (claimedIds.has(pending.piSessionId) || claimedPaths.has(pending.piSessionPath)) return session;

    claimedIds.add(pending.piSessionId);
    claimedPaths.add(pending.piSessionPath);
    changed = true;
    return {
      ...session,
      launch: {
        type: 'pi-session',
        piSessionId: pending.piSessionId,
        piSessionPath: pending.piSessionPath,
      },
      pendingPiLaunch: undefined,
      cwd: pending.cwd,
      lastMessageAt: session.lastMessageAt || pending.modifiedAt,
    };
  });

  return changed ? promoted : sessions;
}

export function piSessionNeedsRestartWarning(session) {
  return session.agentName?.toLowerCase() === 'pi' && !session.launch;
}
