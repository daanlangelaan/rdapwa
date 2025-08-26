// Namespaced storage helpers per user
import { getCurrentUser } from "./users";

const base = "rda";

export const keys = {
  workday: (u) => `${base}.${u}.workday.v4`,
  trips: (u) => `${base}.${u}.trips.today`,
  activeTrip: (u) => `${base}.${u}.trip.active`,
  receipts: (u) => `${base}.${u}.receipts.v1`,
  daylog: (u) => `${base}.${u}.daylog.v1`,
  settings: (u) => `${base}.${u}.settings.v1`,
  projectCurrent: (u) => `${base}.${u}.project.current`,
};

export const loadJSON = (key, fb) => {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fb)); }
  catch { return fb; }
};
export const saveJSON = (key, val) => localStorage.setItem(key, JSON.stringify(val));

export function withUserKey(fn) {
  const u = getCurrentUser().id;
  return (...args) => fn(u, ...args);
}

// Convenience wrappers bound to current user
export const getKey = (suffixFn) => suffixFn(getCurrentUser().id);
