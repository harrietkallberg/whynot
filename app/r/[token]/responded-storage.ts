/**
 * The browser's own note that it has answered a Goal, so the form does not
 * come back after a reload even if the cookie was dropped.
 *
 * This is a convenience, not the rule: one Response per browser per Goal is
 * enforced by the `submission_guard` row, which no visitor can clear. Nothing
 * here is ever sent to the server, and the note holds no Response text.
 */
const KEY_PREFIX = "whynot.responded.";

const listeners = new Set<() => void>();

function announce(): void {
  for (const listener of listeners) listener();
}

/** Subscribes to this browser's notes, including ones made in another tab. */
export function subscribeToRespondedLocally(listener: () => void): () => void {
  listeners.add(listener);

  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && !event.key.startsWith(KEY_PREFIX)) return;
    announce();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Whether this browser has noted a Response to that Goal. Client only. */
export function hasRespondedLocally(responseToken: string): boolean {
  try {
    return window.localStorage.getItem(KEY_PREFIX + responseToken) !== null;
  } catch {
    // Storage can be switched off entirely. The guard row still holds.
    return false;
  }
}

/** The server holds no notes, so it always renders as if there were none. */
export function hasRespondedOnServer(): false {
  return false;
}

export function rememberRespondedLocally(responseToken: string): void {
  try {
    window.localStorage.setItem(KEY_PREFIX + responseToken, "1");
  } catch {
    // As above.
  }
  announce();
}
