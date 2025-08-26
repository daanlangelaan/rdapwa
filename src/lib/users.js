// Simple user registry (local only) + current user handling
const USERS_KEY = "rda.users.v1";
const CURRENT_USER_KEY = "rda.user.current.v1";

// Seed with Daan & Rosa if empty
const SEED = [
  { id: "u-daan", name: "Daan", email: "" },
  { id: "u-rosa", name: "Rosa", email: "" },
];

const read = (k, fb) => {
  try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(fb)); }
  catch { return fb; }
};
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

export function initUsers() {
  let list = read(USERS_KEY, null);
  if (!list || !Array.isArray(list) || list.length === 0) {
    list = SEED;
    write(USERS_KEY, list);
    write(CURRENT_USER_KEY, list[0].id);
  }
  // if no current set, set first
  const current = localStorage.getItem(CURRENT_USER_KEY);
  if (!current) write(CURRENT_USER_KEY, list[0].id);
  return list;
}

export function getUsers() {
  return read(USERS_KEY, []);
}

export function getCurrentUser() {
  const id = localStorage.getItem(CURRENT_USER_KEY) || (initUsers(), localStorage.getItem(CURRENT_USER_KEY));
  const user = getUsers().find(u => u.id === id) || getUsers()[0];
  return user || { id: "u-unknown", name: "Unknown", email: "" };
}

export function setCurrentUser(id) {
  write(CURRENT_USER_KEY, id);
  window.dispatchEvent(new CustomEvent("rda:userChanged", { detail: { id } }));
}

export function addUser({ name, email }) {
  const id = `u-${name?.toLowerCase().replace(/[^a-z0-9]+/g, "-") || Date.now()}`;
  const list = getUsers();
  const u = { id, name: name || "New user", email: email || "" };
  write(USERS_KEY, [u, ...list]);
  setCurrentUser(id);
  return u;
}

export function removeUser(id) {
  const list = getUsers().filter(u => u.id !== id);
  write(USERS_KEY, list);
  const cur = getCurrentUser().id;
  if (cur === id) {
    const fallback = list[0] ? list[0].id : "u-daan";
    setCurrentUser(fallback);
  }
}
