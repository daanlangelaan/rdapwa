import { useEffect, useMemo, useRef, useState } from "react";
import Card from "./Card";
import { getCurrentUser } from "../lib/users";
import { keys, loadJSON, saveJSON } from "../lib/ns";

const ACTIVITIES = ["Engineering", "Assembly", "Research", "Travel", "Meeting", "Admin"];
const fmtClock = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
};

export default function WorkTimer({ onRequestTravel }) {
  const user = getCurrentUser();                       // ← active user
  const K = { WORKDAY: keys.workday(user.id) };

  const [current, setCurrent] = useState(() => {
    const st = loadJSON(K.WORKDAY, null);
    return st?.current || "Engineering";
  });
  const [state, setState] = useState(() => {
    return (
      loadJSON(K.WORKDAY, {
        startedAt: Date.now(),
        current: "Engineering",
        totals: Object.fromEntries(ACTIVITIES.map(a => [a, 0])),
        items: Object.fromEntries(ACTIVITIES.map(a => [a, []])),
        lastMarkAt: Date.now(),
      }) || {}
    );
  });

  // Tick
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Persist on change
  useEffect(() => {
    saveJSON(K.WORKDAY, { ...state, current });
  }, [K.WORKDAY, state, current]);

  // user change → reload
  useEffect(() => {
    const onUser = () => window.location.reload();
    window.addEventListener("rda:userChanged", onUser);
    return () => window.removeEventListener("rda:userChanged", onUser);
  }, []);

  // End-day reset
  useEffect(() => {
    const onReset = () => {
      setState({
        startedAt: Date.now(),
        current: "Engineering",
        totals: Object.fromEntries(ACTIVITIES.map(a => [a, 0])),
        items: Object.fromEntries(ACTIVITIES.map(a => [a, []])),
        lastMarkAt: Date.now(),
      });
      setCurrent("Engineering");
    };
    window.addEventListener("rda:endDay", onReset);
    return () => window.removeEventListener("rda:endDay", onReset);
  }, []);

  // Travel selection opens popup
  useEffect(() => {
    if (current === "Travel" && typeof onRequestTravel === "function") {
      onRequestTravel();
    }
  }, [current, onRequestTravel]);

  // Totals (live clock for current)
  const totalsLive = useMemo(() => {
    const base = { ...state.totals };
    const add = Date.now() - state.lastMarkAt;
    base[current] = (base[current] || 0) + add;
    return base;
  }, [tick, state, current]);

  // Add item
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState(0);
  const [billable, setBillable] = useState(true);
  const [wbso, setWbso] = useState(false);

  const addItem = () => {
    const min = Number(minutes || 0);
    const it = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      title: title || "(no title)",
      minutes: min,
      billable: !!billable,
      wbso: current === "Research" ? !!wbso : false,
      startAt: new Date(state.lastMarkAt).toISOString(),
      endAt: new Date().toISOString(),
    };
    setState(s => {
      const items = { ...s.items };
      items[current] = [it, ...(items[current] || [])];
      return { ...s, items, lastMarkAt: Date.now() };
    });
    setTitle("");
    setMinutes(0);
    setBillable(true);
    setWbso(false);
    window.dispatchEvent(new CustomEvent("rda:addActivityItem", { detail: it }));
  };

  const useElapsed = () => {
    const ms = Date.now() - state.lastMarkAt;
    setMinutes(Math.max(1, Math.round(ms / 60000)));
  };

  // Switch activity
  const switchTo = (a) => {
    if (a === current) return;
    const now = Date.now();
    const delta = now - state.lastMarkAt;
    setState(s => ({
      ...s,
      totals: { ...s.totals, [current]: (s.totals[current] || 0) + delta },
      lastMarkAt: now,
    }));
    setCurrent(a);
  };

  // Request summary → respond
  useEffect(() => {
    const onReq = () => {
      const totals = { ...state.totals };
      const extra = Date.now() - state.lastMarkAt;
      totals[current] = (totals[current] || 0) + extra;
      const summary = {
        totalMs: Object.values(totals).reduce((a, b) => a + b, 0),
        perActivity: Object.fromEntries(
          ACTIVITIES.map(a => [a, { ms: totals[a] || 0, items: state.items[a] || [] }])
        ),
      };
      window.dispatchEvent(new CustomEvent("rda:summary", { detail: summary }));
    };
    window.addEventListener("rda:requestSummary", onReq);
    return () => window.removeEventListener("rda:requestSummary", onReq);
  }, [state, current]);

  return (
    <Card title="Work timer (All day)" subtitle="Total • live per activity • auto Travel on trips" wide>
      <div className="title" style={{ marginBottom: 8 }}>
        Total today: {fmtClock(Object.values(totalsLive).reduce((a, b) => a + b, 0))}
      </div>

      {/* activity tiles */}
      <div className="cards-grid">
        {ACTIVITIES.map(a => {
          const live = totalsLive[a] || 0;
          return (
            <div key={a} className={`card ${a === current ? "active" : ""}`}>
              <div className="title">{a}{a === current ? " • live" : ""}</div>
              <div className="muted">{fmtClock(live)} • items: {(state.items[a] || []).length}</div>
              <div className="btnrow" style={{ marginTop: 8 }}>
                <button className="btn" onClick={() => switchTo(a)}>{a === current ? "current" : "Switch"}</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* details/input */}
      <div style={{ marginTop: 12 }}>
        <div className="title" style={{ marginBottom: 4 }}>Details • {current}</div>
        <div className="grid2">
          <input className="input" placeholder="e.g. Design concept / meeting note" value={title} onChange={e => setTitle(e.target.value)} />
          <input className="input" placeholder="Minutes" value={minutes} onChange={e => setMinutes(e.target.value)} />
        </div>
        <div className="btnrow" style={{ marginTop: 6 }}>
          <label className="lbl"><input type="checkbox" checked={billable} onChange={e => setBillable(e.target.checked)} /> Billable</label>
          {current === "Research" && (
            <label className="lbl"><input type="checkbox" checked={wbso} onChange={e => setWbso(e.target.checked)} /> WBSO</label>
          )}
          <button className="btn" onClick={useElapsed}>Use elapsed since last mark</button>
          <button className="btn primary" onClick={addItem}>Add item</button>
        </div>

        {/* items list for current */}
        {(state.items[current] || []).length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div className="muted">Items for {current}</div>
            {(state.items[current] || []).map(it => (
              <div key={it.id} className="card" style={{ padding: 10, marginTop: 6 }}>
                <div className="title">{it.title}</div>
                <div className="muted">{it.billable ? "Billable" : "Non-billable"} • {it.minutes} min {it.wbso ? "• WBSO" : ""}</div>
                <div className="muted">{new Date(it.startAt).toLocaleString()} — {new Date(it.endAt).toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
