import { useEffect, useMemo, useRef, useState } from "react";
import Card from "./Card";

const LS_KEY = "rda.workday.v2";
const ACTIVITIES = ["Engineering", "Assembly", "Travel", "Meeting", "Admin"];

const fmt = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
};
const nowMs = () => Date.now();

const load = () => {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "null"); }
  catch { return null; }
};
const save = (obj) => localStorage.setItem(LS_KEY, JSON.stringify(obj));
const clear = () => localStorage.removeItem(LS_KEY);

/**
 * Model:
 * running: bool (day timer)
 * total: { baseMs, startAt }
 * currentActivity, lastNonTravel
 * perActivity: {
 *   [name]: {
 *     baseMs, startAt,
 *     items: [ {id, title, minutes, wbso, billable, createdAt} ],
 *     lastMarkMs: number|null    // voor "Use elapsed since last mark"
 *   }
 * }
 * dayNote: optioneel algemene dagnotitie (niet getoond in UI nu)
 */
export default function WorkTimer() {
  const [running, setRunning] = useState(false);
  const [currentActivity, setCurrentActivity] = useState("Engineering");
  const [lastNonTravel, setLastNonTravel] = useState("Engineering");

  const blankActivity = () => ({ baseMs: 0, startAt: null, items: [], lastMarkMs: null });
  const [perActivity, setPerActivity] = useState(
    Object.fromEntries(ACTIVITIES.map(a => [a, blankActivity()]))
  );

  const [total, setTotal] = useState({ baseMs: 0, startAt: null });

  // Inline form state voor items van de live activiteit
  const [itemTitle, setItemTitle] = useState("");
  const [itemMinutes, setItemMinutes] = useState("");
  const [itemWbso, setItemWbso] = useState(false);
  const [itemBillable, setItemBillable] = useState(true);

  // tick
  const tickRef = useRef(null);

  /** LOAD */
  useEffect(() => {
    const data = load();
    if (data) {
      setRunning(!!data.running);
      setCurrentActivity(data.currentActivity || "Engineering");
      setLastNonTravel(data.lastNonTravel ?? "Engineering");
      setTotal(data.total || { baseMs: 0, startAt: null });

      const restored = Object.fromEntries(ACTIVITIES.map(a => [a, blankActivity()]));
      if (data.perActivity) {
        for (const k of Object.keys(data.perActivity)) {
          const v = data.perActivity[k];
          restored[k] = {
            baseMs: Number(v.baseMs || 0),
            startAt: v.startAt || null,
            items: Array.isArray(v.items) ? v.items : [],
            lastMarkMs: ("lastMarkMs" in v) ? v.lastMarkMs : null
          };
        }
      }
      setPerActivity(restored);
    }
  }, []);

  /** SAVE */
  useEffect(() => {
    save({ running, currentActivity, lastNonTravel, total, perActivity });
  }, [running, currentActivity, lastNonTravel, total, perActivity]);

  /** TICK */
  useEffect(() => {
    if (running) {
      tickRef.current = setInterval(() => setTotal(t => ({ ...t })), 1000);
      return () => clearInterval(tickRef.current);
    } else if (tickRef.current) clearInterval(tickRef.current);
  }, [running]);

  /** Derived times */
  const totalElapsedMs = useMemo(() => {
    const live = total.startAt ? nowMs() - total.startAt : 0;
    return total.baseMs + live;
  }, [total]);

  const perActivityElapsed = useMemo(() => {
    const r = {};
    for (const [name, seg] of Object.entries(perActivity)) {
      const live = seg.startAt ? nowMs() - seg.startAt : 0;
      r[name] = seg.baseMs + live;
    }
    return r;
  }, [perActivity]);

  /** segment helpers */
  const stopSeg = (name) => {
    setPerActivity(prev => {
      const seg = prev[name] || blankActivity();
      if (!seg.startAt) return prev;
      const add = nowMs() - seg.startAt;
      return { ...prev, [name]: { ...seg, baseMs: seg.baseMs + add, startAt: null } };
    });
  };
  const startSeg = (name) => {
    setPerActivity(prev => {
      const seg = prev[name] || blankActivity();
      if (seg.startAt) return prev;
      return { ...prev, [name]: { ...seg, startAt: nowMs(), lastMarkMs: seg.lastMarkMs ?? nowMs() } };
    });
  };

  const switchActivity = (next) => {
    if (next === currentActivity) return;
    stopSeg(currentActivity);
    startSeg(next);
    setCurrentActivity(next);
    if (next !== "Travel") setLastNonTravel(next);
    // reset invoervelden voor de nieuwe live activiteit
    setItemTitle("");
    setItemMinutes("");
    setItemWbso(false);
    setItemBillable(true);
  };

  /** Day controls */
  const ensureDayRunning = () => {
    if (!running) {
      setRunning(true);
      setTotal(t => ({ ...t, startAt: nowMs() }));
      startSeg(currentActivity);
    }
  };

  const startDay = () => {
    if (running) return;
    setRunning(true);
    setTotal({ baseMs: 0, startAt: nowMs() });
    setPerActivity(Object.fromEntries(ACTIVITIES.map(a => [a, blankActivity()])));
    startSeg(currentActivity);
  };

  // Freeze totals without reset (voor summary export)
  const finalizeNow = () => {
    let newTotal = { ...total };
    if (newTotal.startAt) {
      newTotal.baseMs += nowMs() - newTotal.startAt;
      newTotal.startAt = null;
    }
    const newPer = {};
    for (const [name, seg] of Object.entries(perActivity)) {
      let base = seg.baseMs;
      if (seg.startAt) base += (nowMs() - seg.startAt);
      newPer[name] = { ...seg, baseMs: base, startAt: null };
    }
    return { newTotal, newPer };
  };

  const endDay = () => {
    const { newTotal, newPer } = finalizeNow();
    const perActivityMs = Object.fromEntries(Object.entries(newPer).map(([k, v]) => [k, v.baseMs]));
    alert(
      `Day closed.\nTotal: ${fmt(newTotal.baseMs)}\n` +
      ACTIVITIES.map(a => `${a}: ${fmt(perActivityMs[a] || 0)}`).join("\n")
    );

    // reset state
    setRunning(false);
    setCurrentActivity("Engineering");
    setLastNonTravel("Engineering");
    setTotal({ baseMs: 0, startAt: null });
    setPerActivity(Object.fromEntries(ACTIVITIES.map(a => [a, blankActivity()])));
    clear();
  };

  /** App events */
  useEffect(() => {
    const onTripStart = () => { ensureDayRunning(); switchActivity("Travel"); };
    const onArrived = () => {
      ensureDayRunning();
      if (lastNonTravel && lastNonTravel !== "Travel") {
        if (confirm(`Resume last activity: ${lastNonTravel}?`)) switchActivity(lastNonTravel);
      }
    };
    const onEndDay = () => endDay();

    // Home vraagt om summary (met items!)
    const onRequestSummary = () => {
      const { newTotal, newPer } = finalizeNow();
      const payload = {
        totalMs: newTotal.baseMs,
        perActivity: Object.fromEntries(
          Object.entries(newPer).map(([name, seg]) => [
            name,
            {
              ms: seg.baseMs,
              items: seg.items || []
            }
          ])
        )
      };
      window.dispatchEvent(new CustomEvent("rda:summary", { detail: payload }));
    };

    window.addEventListener("rda:tripStarted", onTripStart);
    window.addEventListener("rda:arrived", onArrived);
    window.addEventListener("rda:endDay", onEndDay);
    window.addEventListener("rda:requestSummary", onRequestSummary);
    return () => {
      window.removeEventListener("rda:tripStarted", onTripStart);
      window.removeEventListener("rda:arrived", onArrived);
      window.removeEventListener("rda:endDay", onEndDay);
      window.removeEventListener("rda:requestSummary", onRequestSummary);
    };
  }, [lastNonTravel, currentActivity, running, perActivity, total]);

  /** UI handlers voor Items (per activiteit) */
  const addItem = (minutes) => {
    const m = Math.max(0, Math.round(minutes));
    if (!m) return;
    const id = crypto.randomUUID();
    const upd = (seg) => ({
      ...seg,
      items: [...seg.items, {
        id, title: (itemTitle || "").trim() || currentActivity,
        minutes: m, wbso: itemWbso, billable: itemBillable, createdAt: new Date().toISOString()
      }],
      lastMarkMs: nowMs()
    });
    setPerActivity(prev => ({ ...prev, [currentActivity]: upd(prev[currentActivity] || blankActivity()) }));
    // reset velden behalve billable default true laten staan
    setItemTitle("");
    setItemMinutes("");
  };

  const useElapsedSinceLastMark = () => {
    const seg = perActivity[currentActivity] || blankActivity();
    const from = seg.lastMarkMs ?? (seg.startAt ?? nowMs());
    const elapsedMs = nowMs() - from;
    const minutes = Math.round(elapsedMs / 60000);
    setItemMinutes(String(minutes));
  };

  const removeItem = (id) => {
    setPerActivity(prev => {
      const seg = prev[currentActivity] || blankActivity();
      return { ...prev, [currentActivity]: { ...seg, items: seg.items.filter(i => i.id !== id) } };
    });
  };

  const totalMinutesOfItems = (name) => {
    const seg = perActivity[name] || blankActivity();
    return (seg.items || []).reduce((acc, it) => acc + (it.minutes || 0), 0);
    };

  /** RENDER */
  return (
    <Card title="Work timer (All day)" subtitle="Total • live per activity • line items per active activity">
      {/* lijst met activiteiten */}
      <div className="timer" style={{ marginTop: 6 }}>Total today: {fmt(totalElapsedMs)}</div>

      <div className="leglist" style={{ marginTop: 10 }}>
        {ACTIVITIES.map((a) => {
          const t = perActivityElapsed[a] || 0;
          const active = a === currentActivity;
          return (
            <div key={a} className="legcard" style={active ? { outline: "1px solid rgba(96,165,250,.5)" } : {}}>
              <div>
                <div className="title">{a}{active ? " • live" : ""}</div>
                <div className="muted">
                  {fmt(t)} • items: { (perActivity[a]?.items?.length || 0) } • items total: { totalMinutesOfItems(a) } min
                </div>
              </div>
              {!active ? (
                <button className="btn" onClick={() => { ensureDayRunning(); switchActivity(a); }}>
                  Switch
                </button>
              ) : (
                <span className="badge">current</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Detailvenster voor de LIVE activiteit */}
      <div style={{marginTop:12}}>
        <Card title={`Details • ${currentActivity}`} subtitle="Add split items (title • minutes • WBSO • billable)">
          <div className="grid2">
            <div>
              <label className="lbl">Title</label>
              <input className="input" placeholder="e.g. Concept design, onsite support"
                value={itemTitle} onChange={e=>setItemTitle(e.target.value)} />
            </div>
            <div>
              <label className="lbl">Minutes</label>
              <input className="input" type="number" min="0" step="1"
                value={itemMinutes} onChange={e=>setItemMinutes(e.target.value)} />
            </div>
          </div>

          <div className="btnrow" style={{marginTop:6}}>
            <label className="lbl" style={{margin:0}}>
              <input type="checkbox" checked={itemWbso} onChange={e=>setItemWbso(e.target.checked)} /> WBSO
            </label>
            <label className="lbl" style={{margin:0}}>
              <input type="checkbox" checked={itemBillable} onChange={e=>setItemBillable(e.target.checked)} /> Billable
            </label>
          </div>

          <div className="btnrow">
            <button className="btn" onClick={useElapsedSinceLastMark}>Use elapsed since last mark</button>
            <button className="btn primary" onClick={()=>addItem(Number(itemMinutes))}>Add item</button>
          </div>

          {/* lijst van items */}
          <div className="leglist" style={{marginTop:8}}>
            {(perActivity[currentActivity]?.items || []).map(it => (
              <div key={it.id} className="legcard">
                <div>
                  <div className="title">{it.title}</div>
                  <div className="muted">
                    {it.minutes} min • {it.wbso ? "WBSO" : "non-WBSO"} • {it.billable ? "billable" : "non-billable"}
                  </div>
                </div>
                <button className="btn ghost" onClick={()=>removeItem(it.id)}>Remove</button>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Day actions */}
      <div className="btnrow">
        {!running && <button className="btn primary" onClick={startDay}>Start Day</button>}
        {running && <button className="btn ghost" onClick={()=>{
          if (!confirm("Reset all per-activity totals (keeps day running)?")) return;
          setPerActivity(Object.fromEntries(ACTIVITIES.map(a => [a, {...blankActivity(), startAt: a===currentActivity ? nowMs() : null } ])));
        }}>Reset activity totals</button>}
        {running && <button className="btn" onClick={() => window.dispatchEvent(new Event("rda:endDay"))}>End Day</button>}
      </div>
    </Card>
  );
}
