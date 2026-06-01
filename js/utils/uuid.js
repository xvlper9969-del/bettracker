/**
 * uuid.js — Generates RFC4122-compliant UUIDs without external deps.
 * Uses crypto.randomUUID() when available (modern browsers + Android WebView),
 * falls back to Math.random-based implementation.
 */

export function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback: RFC4122 v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
