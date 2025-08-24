import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import Home from "./pages/Home";
import Receipts from "./pages/Receipts";
import Settings from "./pages/Settings";
import DayLog from "./pages/DayLog";
import Header from "./components/Header";
import BottomNav from "./components/BottomNav";
import "./index.css";

function Layout() {
  const location = useLocation();
  return (
    <div className="app">
      <Header />
      <main className="content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/receipts" element={<Receipts />} />
          <Route path="/daylog" element={<DayLog />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
      <BottomNav activePath={location.pathname} />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/*" element={<Layout />} />
      </Routes>
    </BrowserRouter>
  );
}
