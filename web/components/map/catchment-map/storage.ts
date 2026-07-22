/** Read a JSON array from localStorage, tolerating missing/corrupt values. */
export function loadStored(key: string): Record<string, unknown>[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Persist a JSON-serialisable value, swallowing quota/serialisation errors. */
export function saveStored(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore — storage full or unavailable */
  }
}
