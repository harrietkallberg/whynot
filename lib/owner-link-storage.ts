/**
 * Where a browser keeps its Owner Link token, so a returning visitor is
 * offered their Dashboard instead of a blank page. It lives in its own module
 * because client components need it and must not pull in the database.
 *
 * localStorage is the only copy: the token is never put in a cookie, a query
 * string, a log or an error report (ADR-0002).
 */
export const OWNER_TOKEN_STORAGE_KEY = "whynot.ownerToken";

const listeners = new Set<() => void>();

/**
 * useSyncExternalStore compares snapshots by identity, so the value is cached
 * rather than re-read from storage on every render.
 */
let cached: string | null = null;
let cacheFilled = false;

function readStorage(): string | null {
  try {
    return window.localStorage.getItem(OWNER_TOKEN_STORAGE_KEY);
  } catch {
    // Storage can be switched off entirely. The create flow still works; the
    // Owner just has to keep the link themselves.
    return null;
  }
}

function announce(): void {
  for (const listener of listeners) listener();
}

export function subscribeToOwnerToken(listener: () => void): () => void {
  listeners.add(listener);

  // Another tab may store a token too.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== OWNER_TOKEN_STORAGE_KEY) return;
    cacheFilled = false;
    announce();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** The Owner Link token this browser holds, or null. Client only. */
export function getOwnerToken(): string | null {
  if (!cacheFilled) {
    cached = readStorage();
    cacheFilled = true;
  }
  return cached;
}

/** The server never holds a token, so it always renders as if there is none. */
export function getServerOwnerToken(): null {
  return null;
}

/** Remembers a freshly minted Owner Link token in this browser. */
export function rememberOwnerToken(token: string): void {
  try {
    window.localStorage.setItem(OWNER_TOKEN_STORAGE_KEY, token);
  } catch {
    // As above: without storage the links still work, they are just not kept.
  }
  cached = token;
  cacheFilled = true;
  announce();
}
