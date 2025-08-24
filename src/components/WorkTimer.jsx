import { useEffect, useMemo, useRef, useState } from "react";
import Card from "./Card";

/* ====== Config ====== */
const LS_KEY = "rda.workday.v4";
const SETTINGS_KEY = "rda.settings.v1";
const ACTIVITIES = ["Engineering", "Assembly", "Research", "Travel", "Meeting", "Admin"];

/* ====== Helpers ====== */
const fmtClock = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
};
const fmtDateTime = (iso) => {
  try { return new Date(iso).toLocaleString(); } catch { return iso || ""; }
};
const load = (k, fb) => { try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(fb)); } catch { return fb; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const blankSeg = () => ({ baseMs: 0, startAt: null, items: [], lastMarkMs: null });

/** Component */
export default function WorkTimer({ onRequestTravel }) {
  /* ====== Core state ====== */
  const [running, setRunning] = useState(false);
  const [current, setCurrent] = useState("Engineering");
  const [lastNonTravel, setLastNonTravel] = useState("Engineering");

  const [total, setTotal] = useState({ baseMs: 0, startAt: null });
  const [per, setPer] = useState(Object.fromEntries(ACTIVITIES.map((a) => [a, blankSeg()])));

  /* Settings (reminder e.d.) */
  const [settings] = useState(load(SETTINGS_KEY, { reminderEnabled: true, reminderMinutes: 240 }));

  /* Nieuw item form */
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState("");
  const [billable, setBillable] = useState(true);
  const [wbso, setWbso] = useState(false); // alleen bij Research

  /* ====== Speech-to-text ====== */
  const [canSpeech, setCanSpeech] = useState(false);
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [speechTarget, setSpeechTarget] = useState({ type: "new", itemId: null });
  const [speechErr, setSpeechErr] = useState("");
  const recRef = useRef(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setCanSpeech(!!SR);
  }, []);
  useEffect(() => () => { try { recRef.current?.stop(); } catch {} }, []);

  const startMic = (target = { type: "new", itemId: null }) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setSpeechErr("Spraak niet ondersteund in deze browser."); return; }
    setSpeechErr("");
    setSpeechTarget(target);

    const rec = new SR();
    rec.lang = "nl-NL";
    rec.interimResults = true;
    rec.continuous = true;

    rec.onresult = (e) => {
      let interim = "", finalChunk = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalChunk += chunk + " ";
        else interim += chunk + " ";
      }
      if (finalChunk) {
        if (target.type === "new") {
          setTitle((prev) => (prev ? prev + " " : "") + finalChunk.trim());
        } else if (target.type === "item" && target.itemId) {
          setPer((prev) => {
            const seg = prev[current] || blankSeg();
            const items = seg.items.map((it) =>
              it.id === target.itemId
                ? { ...it, title: (it.title ? it.title + " " : "") + finalChunk.trim() }
                : it
            );
            return { ...prev, [current]: { ...seg, items } };
          });
        }
        setInterimText("");
      } else {
        setInterimText(interim.trim());
      }
    };
    rec.onerror = (e) => { setSpeechErr(e?.error ? `Spraakfout: ${e.error}` : "Onbekende spraakfout."); stopMic(); };
    rec.onend = () => { setListening(false); recRef.current = null; setInterimText(""); };
    try { rec.start(); recRef.current = rec; setListening(true); setInterimText(""); }
    catch { setSpeechErr("Kon spraak niet starten. HTTPS/microfoon-toegang ok?"); }
  };
  const stopMic = () => { try { recRef.current?.stop(); } catch {}; recRef.current = null; setListening(false); setInterimText(""); };

  /* ====== Load/Save ====== */
  useEffect(() => {
    const s = load(LS_KEY, null);
    if (!s) return;
    setRunning(!!s.running);
    setCurrent(s.current || "Engineering");
    setLastNonTravel(s.lastNonTravel ?? "Engineering");
    setTotal(s.total || { baseMs: 0, startAt: null });

    const restored = Object.fromEntries(ACTIVITIES.map((a) => [a, blankSeg()]));
    if (s.per) for (const k of Object.keys(s.per)) restored[k] = { ...blankSeg(), ...s.per[k] };
    setPer(restored);
  }, []);
  useEffect(() => save(LS_KEY, { running, current, lastNonTravel, total, per }),
    [running, current, lastNonTravel, total, per]);

  /* ====== Ticking (live update) ====== */
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const totalMs = useMemo(
    () => total.baseMs + (total.startAt ? Date.now() - total.startAt : 0),
    [total, tick]
  );
  const perMs = useMemo(() => {
    const r = {};
    for (const [name, seg] of Object.entries(per)) {
      r[name] = seg.baseMs + (seg.startAt ? Date.now() - seg.startAt : 0);
    }
    return r;
  }, [per, tick]);

  /* ====== Segment helpers ====== */
  const startSeg = (name) => {
    setPer((prev) => {
      const seg = prev[name] || blankSeg();
      if (seg.startAt) return prev;
      return { ...prev, [name]: { ...seg, startAt: Date.now(), lastMarkMs: seg.lastMarkMs ?? Date.now() } };
    });
  };
  const stopSeg = (name) => {
    setPer((prev) => {
      const seg = prev[name] || blankSeg();
      if (!seg.startAt) return prev;
      const add = Date.now() - seg.startAt;
      return { ...prev, [name]: { ...seg, baseMs: seg.baseMs + add, startAt: null } };
    });
  };
  const ensureDay = () => {
    if (!running) {
      setRunning(true);
      setTotal({ baseMs: 0, startAt: Date.now() });
      startSeg(current);
    }
  };

  /* ====== Switching ====== */
  const switchActivity = (next) => {
    if (next === current) return;
    ensureDay();
    stopSeg(current);
    startSeg(next);
    setCurrent(next);
    if (next !== "Travel") setLastNonTravel(next);

    // reset inline form + prefill elapsed
    setTitle(""); setBillable(true); setWbso(false);
    prefillElapsed(next);

    // Travel → open popup
    if (next === "Travel" && typeof onRequestTravel === "function") onRequestTravel();
  };

  /* ====== Elapsed auto-prefill ====== */
  const prefillElapsed = (activity = current) => {
    const seg = per[activity] || blankSeg();
    const from = seg.lastMarkMs ?? seg.startAt ?? Date.now();
    const mins = Math.max(0, Math.round((Date.now() - from) / 60000));
    setMinutes(String(mins));
  };
  useEffect(() => { prefillElapsed(current); }, [current, per[current]?.lastMarkMs, per[current]?.startAt]);

  /* ====== Summary/Snapshot ====== */
  const snapshotNow = () => {
    let t = { ...total };
    if (t.startAt) { t.baseMs += Date.now() - t.startAt; t.startAt = null; }
    const out = {};
    for (const [name, seg] of Object.entries(per)) {
      out[name] = { ...seg };
      if (out[name].startAt) { out[name].baseMs += Date.now() - out[name].startAt; out[name].startAt = null; }
    }
    return { t, out };
  };

  /* ====== App events ====== */
  useEffect(() => {
    const onTripStart = () => { ensureDay(); if (current !== "Travel") switchActivity("Travel"); };
    const onArrived = () => { ensureDay(); /* geen auto-resume */ };
    const onEndDay = () => {
      const { t, out } = snapshotNow();
      alert(
        `Day closed.\nTotal: ${fmtClock(t.baseMs)}\n` +
        ACTIVITIES.map((a) => `${a}: ${fmtClock(out[a]?.baseMs || 0)}`).join("\n")
      );
      setRunning(false);
      setCurrent("Engineering");
      setLastNonTravel("Engineering");
      setTotal({ baseMs: 0, startAt: null });
      setPer(Object.fromEntries(ACTIVITIES.map((a) => [a, blankSeg()])));
      localStorage.removeItem(LS_KEY);
    };
    const onRequestSummary = () => {
      const { t, out } = snapshotNow();
      const payload = {
        totalMs: t.baseMs,
        perActivity: Object.fromEntries(
          Object.entries(out).map(([name, seg]) => [name, { ms: seg.baseMs, items: seg.items || [] }])
        ),
      };
      window.dispatchEvent(new CustomEvent("rda:summary", { detail: payload }));
    };
    const onAddItem = (e) => {
      const p = e.detail; // { activity, title, minutes, billable, wbso, startAt, endAt }
      if (!p || !p.activity) return;
      setPer((prev) => {
        const seg = prev[p.activity] || blankSeg();
        const item = {
          id: crypto.randomUUID(),
          title: (p.title || p.activity).trim(),
          minutes: Math.max(0, Math.round(Number(p.minutes || 0))),
          billable: !!p.billable,
          wbso: !!p.wbso,
          startAt: p.startAt || new Date().toISOString(),
          endAt: p.endAt || new Date().toISOString(),
        };
        return { ...prev, [p.activity]: { ...seg, items: [...seg.items, item], lastMarkMs: Date.now() } };
      });
    };

    window.addEventListener("rda:tripStarted", onTripStart);
    window.addEventListener("rda:arrived", onArrived);
    window.addEventListener("rda:endDay", onEndDay);
    window.addEventListener("rda:requestSummary", onRequestSummary);
    window.addEventListener("rda:addActivityItem", onAddItem);
    return () => {
      window.removeEventListener("rda:tripStarted", onTripStart);
      window.removeEventListener("rda:arrived", onArrived);
      window.removeEventListener("rda:endDay", onEndDay);
      window.removeEventListener("rda:requestSummary", onRequestSummary);
      window.removeEventListener("rda:addActivityItem", onAddItem);
    };
  }, [current, running, total, per]);

  /* Reminder (optioneel) */
  useEffect(() => {
    if (!settings.reminderEnabled) return;
    const ms = Math.max(1, Number(settings.reminderMinutes || 240)) * 60 * 1000;
    if (!running) return;
    const id = setTimeout(() => { confirm(`Reminder: still working on ${current}?`); }, ms);
    return () => clearTimeout(id);
  }, [running, current, settings.reminderEnabled, settings.reminderMinutes]);

  /* ====== Item toevoegen ====== */
  const addItem = () => {
    const m = Math.max(0, Math.round(Number(minutes || 0)));
    if (!m) return;
    const payload = {
      activity: current,
      title,
      minutes: m,
      billable,
      wbso: current === "Research" ? wbso : false,
      startAt: new Date(Date.now() - m * 60000).toISOString(),
      endAt: new Date().toISOString(),
    };
    window.dispatchEvent(new CustomEvent("rda:addActivityItem", { detail: payload }));
    setTitle(""); setMinutes("");
  };

  /* ====== Render ====== */
  const items = per[current]?.items || [];

  return (
    <Card title="Work timer (All day)" subtitle="tap an activity to switch • Travel opens trips popup">
      {/* Totals */}
      <div className="timer" style={{ marginTop: 6 }}>Total today: {fmtClock(totalMs)}</div>

      {/* Activity grid */}
      <div className="leglist" style={{ marginTop: 10 }}>
        {ACTIVITIES.map((a) => {
          const active = a === current;
          const t = perMs[a] || 0;
          return (
            <div
              key={a}
              className="legcard"
              style={active ? { outline: "1px solid rgba(96,165,250,.5)" } : {}}
            >
              <div>
                <div className="title">{a}{active ? " • live" : ""}</div>
                <div className="muted">{fmtClock(t)} • items: {(per[a]?.items?.length || 0)}</div>
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

      {/* Active details */}
      <div style={{ marginTop: 12 }}>
        <Card title={`Details • ${current}`} subtitle="Items per activity (title • minutes • billable • WBSO for Research)">
          {/* Nieuw item */}
          <div className="grid2">
            <div>
              <label className="lbl">Title / note</label>
              <input className="input" placeholder="e.g. Design concept / meeting note"
                     value={title} onChange={(e) => setTitle(e.target.value)} />
              {interimText && <div className="muted" style={{ marginTop: 4 }}>🎙️ {interimText}</div>}
            </div>
            <div>
              <label className="lbl">Minutes (prefilled)</label>
              <input className="input" type="number" min="0" step="1"
                     value={minutes} onChange={(e) => setMinutes(e.target.value)} />
              <div className="muted" style={{ marginTop: 4 }}>Voorstel = tijd sinds laatste item/start.</div>
            </div>
          </div>

          <div className="btnrow" style={{ marginTop: 6 }}>
            <label className="lbl" style={{ margin: 0 }}>
              <input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} /> Billable
            </label>
            {current === "Research" && (
              <label className="lbl" style={{ margin: 0 }}>
                <input type="checkbox" checked={wbso} onChange={(e) => setWbso(e.target.checked)} /> WBSO
              </label>
            )}
          </div>

          <div className="btnrow">
            <button className="btn" onClick={() => prefillElapsed(current)}>Use elapsed since last mark</button>

            {/* Mic voor nieuw item */}
            <button className="btn"
                    onClick={() => (listening ? stopMic() : startMic({ type: "new", itemId: null }))}
                    disabled={!canSpeech}
                    title={!canSpeech ? "Niet ondersteund in deze browser" : ""}>
              {listening && speechTarget.type === "new" ? "⏹️ Stop mic" : "🎤 Speak"}
            </button>

            <button className="btn primary" onClick={addItem}>Add item</button>
          </div>

          {speechErr && <div className="muted" style={{ color: "#f88", marginTop: 6 }}>{speechErr}</div>}

          {/* Items lijst */}
          <div style={{ marginTop: 14 }}>
            <div className="title" style={{ fontSize: 14, opacity: 0.8 }}>Items for {current}</div>
            {items.length === 0 ? (
              <div className="muted">No items yet.</div>
            ) : (
              <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                {items.map((it) => (
                  <div key={it.id}
                       style={{
                         display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center",
                         padding: "8px 10px", borderRadius: 12,
                         background: "rgba(148,163,184,.08)", border: "1px solid rgba(148,163,184,.18)"
                       }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{it.title || "(no title)"}</div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {it.billable ? "Billable" : "Non-billable"}
                        {it.wbso ? " • WBSO" : ""} • {it.minutes} min
                      </div>
                      {(it.startAt || it.endAt) && (
                        <div className="muted" style={{ fontSize: 12 }}>
                          {it.startAt ? fmtDateTime(it.startAt) : ""} → {it.endAt ? fmtDateTime(it.endAt) : ""}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn"
                              onClick={() =>
                                listening && speechTarget.type === "item" && speechTarget.itemId === it.id
                                  ? stopMic()
                                  : startMic({ type: "item", itemId: it.id })
                              }
                              disabled={!canSpeech}
                              title={!canSpeech ? "Niet ondersteund in deze browser" : "Spraak naar notitie"}>
                        {listening && speechTarget.type === "item" && speechTarget.itemId === it.id ? "⏹️ Mic" : "🎙️ Add note"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Start Day (End Day zit onderaan Home) */}
      <div className="btnrow">
        {!running && (
          <button className="btn primary" onClick={() => {
            setRunning(true);
            setTotal({ baseMs: 0, startAt: Date.now() });
            startSeg(current);
            prefillElapsed(current);
          }}>
            Start Day
          </button>
        )}
      </div>
    </Card>
  );
}
