import { useEffect, useMemo, useRef, useState } from "react";
import Card from "./Card";

const LS_KEY = "rda.workday.v1";
const ACTIVITIES = ["Engineering", "Assembly", "Travel", "Meeting", "Admin"];

/** ---------- helpers ---------- */
const fmt = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
};
const nowMs = () => Date.now();

/** Persist/Load */
const load = () => {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "null");
  } catch {
    return null;
  }
};
const save = (obj) => localStorage.setItem(LS_KEY, JSON.stringify(obj));
const clear = () => localStorage.removeItem(LS_KEY);

/**
 * Model:
 * - running: whole day timer state
 * - total: { baseMs, startAt }  // whole-day clock
 * - currentActivity: string
 * - lastNonTravel: string|null   // to resume after travel
 * - perActivity: { [name]: { baseMs, startAt|null } }
 * - note, wbso
 */
export default function WorkTimer() {
  const [running, setRunning] = useState(false);
  const [note, setNote] = useState("");
  const [wbso, setWbso] = useState(false);

  const [currentActivity, setCurrentActivity] = useState("Engineering");
  const [lastNonTravel, setLastNonTravel] = useState("Engineering");

  const [total, setTotal] = useState({ baseMs: 0, startAt: null });
  const [perActivity, setPerActivity] = useState(() =>
    Object.fromEntries(ACTIVITIES.map((a) => [a, { baseMs: 0, startAt: null }]))
  );

  // tick to force live updates
  const tickRef = useRef(null);

  /** ---------- LOAD on mount ---------- */
  useEffect(() => {
    const data = load();
    if (data) {
      setRunning(!!data.running);
      setNote(data.note || "");
      setWbso(!!data.wbso);
      setCurrentActivity(data.currentActivity || "Engineering");
      setLastNonTravel(data.lastNonTravel ?? "Engineering");
      setTotal(data.total || { baseMs: 0, startAt: null });
      setPerActivity((prev) => ({ ...prev, ...(data.perActivity || {}) }));
    }
  }, []);

  /** ---------- SAVE on changes ---------- */
  useEffect(() => {
    save({
      running,
      note,
      wbso,
      currentActivity,
      lastNonTravel,
      total,
      perActivity,
    });
  }, [running, note, wbso, currentActivity, lastNonTravel, total, perActivity]);

  /** ---------- Interval ---------- */
  useEffect(() => {
    if (running) {
      tickRef.current = setInterval(() => {
        // trigger rerender
        setTotal((t) => ({ ...t }));
      }, 1000);
      return () => clearInterval(tickRef.current);
    } else {
      if (tickRef.current) clearInterval(tickRef.current);
    }
  }, [running]);

  /** ---------- Derived times ---------- */
  const totalElapsedMs = useMemo(() => {
    const live = total.startAt ? nowMs() - total.startAt : 0;
    return total.baseMs + live;
  }, [total]);

  const perActivityElapsed = useMemo(() => {
    const result = {};
    for (const [name, seg] of Object.entries(perActivity)) {
      const live = seg.startAt ? nowMs() - seg.startAt : 0;
      result[name] = seg.baseMs + live;
    }
    return result;
  }, [perActivity]);

  /** ---------- Activity Switch Logic ---------- */
  const stopSeg = (name) => {
    setPerActivity((prev) => {
      const seg = prev[name] || { baseMs: 0, startAt: null };
      if (!seg.startAt) return prev;
      const add = nowMs() - seg.startAt;
      return { ...prev, [name]: { baseMs: seg.baseMs + add, startAt: null } };
    });
  };

  const startSeg = (name) => {
    setPerActivity((prev) => {
      const seg = prev[name] || { baseMs: 0, startAt: null };
      if (seg.startAt) return prev;
      return { ...prev, [name]: { ...seg, startAt: nowMs() } };
    });
  };

  const switchActivity = (next) => {
    if (next === currentActivity) return;
    // stop current
    stopSeg(currentActivity);
    // start next
    startSeg(next);
    setCurrentActivity(next);
    if (next !== "Travel") {
      setLastNonTravel(next);
    }
  };

  /** ---------- Day Controls ---------- */
  const ensureDayRunning = () => {
    if (!running) {
      setRunning(true);
      setTotal((t) => ({ ...t, startAt: nowMs() }));
      // start current activity segment too
      startSeg(currentActivity);
    }
  };

  const startDay = () => {
    if (running) return;
    setRunning(true);
    setTotal({ baseMs: 0, startAt: nowMs() });
    // reset all segments’ startAt to null, then start current activity
    setPerActivity(Object.fromEntries(ACTIVITIES.map((a) => [a, { baseMs: 0, startAt: null }])));
    startSeg(currentActivity);
  };

  const endDay = () => {
    // finalize all running timers
    if (total.startAt) {
      const add = nowMs() - total.startAt;
      setTotal((t) => ({ baseMs: t.baseMs + add, startAt: null }));
    }
    for (const [name, seg] of Object.entries(perActivity)) {
      if (seg.startAt) stopSeg(name);
    }
    setRunning(false);
    alert(
      `Day closed.\nTotal: ${fmt(totalElapsedMs)}\n` +
        ACTIVITIES.map((a) => `${a}: ${fmt(perActivityElapsed[a] || 0)}`).join("\n")
    );
    // reset everything
    setNote("");
    setWbso(false);
    setCurrentActivity("Engineering");
    setLastNonTravel("Engineering");
    setTotal({ baseMs: 0, startAt: null });
    setPerActivity(Object.fromEntries(ACTIVITIES.map((a) => [a, { baseMs: 0, startAt: null }])));
    clear();
  };

  /** ---------- React to global app events ---------- */
  useEffect(() => {
    // From Home: start of a trip → force timer on + switch to Travel
    const onTripStart = () => {
      ensureDayRunning();
      switchActivity("Travel");
    };
    // From Home: arrived → suggest resume to last non-travel
    const onArrived = () => {
      ensureDayRunning();
      if (lastNonTravel && lastNonTravel !== "Travel") {
        if (confirm(`Resume last activity: ${lastNonTravel}?`)) {
          switchActivity(lastNonTravel);
        }
      }
    };
    // From Home: end day
    const onEndDay = () => endDay();

    window.addEventListener("rda:tripStarted", onTripStart);
    window.addEventListener("rda:arrived", onArrived);
    window.addEventListener("rda:endDay", onEndDay);
    // compatibility with earlier flow (ask to start)
    const onStartReq = () => ensureDayRunning();
    window.addEventListener("rda:startWorkRequested", onStartReq);

    return () => {
      window.removeEventListener("rda:tripStarted", onTripStart);
      window.removeEventListener("rda:arrived", onArrived);
      window.removeEventListener("rda:endDay", onEndDay);
      window.removeEventListener("rda:startWorkRequested", onStartReq);
    };
  }, [lastNonTravel, currentActivity, running]);

  /** ---------- Manual UI handlers ---------- */
  const manualSwitch = (e) => switchActivity(e.target.value);

  const resetActivityTotals = () => {
    if (!confirm("Reset all per-activity totals for today (keeps the day running)?")) return;
    setPerActivity((prev) =>
      Object.fromEntries(Object.keys(prev).map((k) => [k, { baseMs: 0, startAt: k === currentActivity ? nowMs() : null }]))
    );
  };

  /** ---------- Render ---------- */
  return (
    <Card title="Work timer (All day)" subtitle="Total • live per activity • auto Travel on trips">
      {/* Top controls */}
      <div className="grid2">
        <div>
          <label className="lbl">Current activity</label>
          <select className="select" value={currentActivity} onChange={manualSwitch}>
            {ACTIVITIES.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </div>
        <div className="switch">
          <label className="lbl">WBSO</label>
          <input type="checkbox" checked={wbso} onChange={(e) => setWbso(e.target.checked)} />
        </div>
      </div>

      <label className="lbl">Note (for today)</label>
      <textarea
        className="area"
        rows={2}
        placeholder="Optional day note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      {/* Total day time */}
      <div className="timer" style={{ marginTop: 10 }}>Total today: {fmt(totalElapsedMs)}</div>

      {/* Per-activity live list */}
      <div className="leglist" style={{ marginTop: 10 }}>
        {ACTIVITIES.map((a) => {
          const t = perActivityElapsed[a] || 0;
          const active = a === currentActivity;
          return (
            <div key={a} className="legcard" style={active ? { outline: "1px solid rgba(96,165,250,.5)" } : {}}>
              <div>
                <div className="title">{a}{active ? " • live" : ""}</div>
                <div className="muted">{fmt(t)}</div>
              </div>
              {!active ? (
                <button className="btn" onClick={() => switchActivity(a)}>Switch</button>
              ) : (
                <span className="badge">current</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Day actions */}
      <div className="btnrow">
        {!running && <button className="btn primary" onClick={startDay}>Start Day</button>}
        {running && <button className="btn ghost" onClick={resetActivityTotals}>Reset activity totals</button>}
        {running && <button className="btn" onClick={endDay}>End Day</button>}
      </div>
    </Card>
  );
}
