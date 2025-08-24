import { NavLink } from "react-router-dom";

export default function BottomNav() {
  return (
    <nav className="tabbar">
      <NavLink to="/" className={({isActive}) => "tab" + (isActive ? " active" : "")}>
        <span className="ico">🏁</span>
        <span>Home</span>
      </NavLink>
      <NavLink to="/receipts" className={({isActive}) => "tab" + (isActive ? " active" : "")}>
        <span className="ico">🧾</span>
        <span>Receipts</span>
      </NavLink>
      <NavLink to="/daylog" className={({isActive}) => "tab" + (isActive ? " active" : "")}>
        <span className="ico">📅</span>
        <span>Day Log</span>
      </NavLink>
      <NavLink to="/settings" className={({isActive}) => "tab" + (isActive ? " active" : "")}>
        <span className="ico">⚙️</span>
        <span>Settings</span>
      </NavLink>
    </nav>
  );
}
