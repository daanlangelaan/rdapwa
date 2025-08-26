import { useEffect, useState } from "react";
import { getUsers, getCurrentUser, setCurrentUser, addUser, removeUser, initUsers } from "../lib/users";

export default function UserChip() {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState(() => (initUsers(), getUsers()));
  const [current, setCurrent] = useState(getCurrentUser());

  useEffect(() => {
    const onChange = () => {
      setUsers(getUsers());
      setCurrent(getCurrentUser());
    };
    window.addEventListener("rda:userChanged", onChange);
    return () => window.removeEventListener("rda:userChanged", onChange);
  }, []);

  const onAdd = () => {
    const name = prompt("Name of new user?", "New user");
    if (!name) return;
    addUser({ name, email: "" });
    setUsers(getUsers());
    setCurrent(getCurrentUser());
  };

  const onSwitch = (id) => {
    setCurrentUser(id);
    setOpen(false);
    setUsers(getUsers());
    setCurrent(getCurrentUser());
  };

  const onRemove = (id) => {
    if (!confirm("Remove this user from this device? Data in this browser for that user will remain unless you clear storage.")) return;
    removeUser(id);
    setUsers(getUsers());
    setCurrent(getCurrentUser());
  };

  return (
    <div style={{ position: "relative" }}>
      <button className="btn" onClick={() => setOpen((v) => !v)}>
        👤 {current.name}
      </button>
      {open && (
        <div style={{
          position: "absolute", right: 0, top: "110%",
          background: "#0b1020", border: "1px solid rgba(148,163,184,.18)",
          borderRadius: 12, minWidth: 220, padding: 8, zIndex: 50
        }}>
          {users.map(u => (
            <div key={u.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: 6 }}>
              <button className="btn ghost small" onClick={() => onSwitch(u.id)} style={{ flex: 1, textAlign: "left" }}>
                {u.id === current.id ? "• " : ""}{u.name}
              </button>
              <button className="btn ghost small" onClick={() => onRemove(u.id)}>✕</button>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
            <button className="btn small" onClick={onAdd}>＋ Add user</button>
          </div>
        </div>
      )}
    </div>
  );
}
