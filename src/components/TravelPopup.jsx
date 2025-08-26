import { useEffect, useMemo, useState } from "react";
import Card from "./Card";
import { getCurrentUser } from "../lib/users";
import { keys, loadJSON, saveJSON } from "../lib/ns";

const DEFAULT_LOCATIONS = ["Werkplaats", "Kantoor/Rosa", "Huis Daan", "Client (project)"];
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
const fmtClock = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
};
const haversine = (a, b) => {
  if (!a || !b) return 0;
  const R = 6371, toRad = d => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
  const la1 = toRad(a.lat), la2 = toRad(b.lat);
  const h = Math.sin(dLat/2)**2 + Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;
  return R * 2 * Math.asin(Math.sqrt(h));
};
const getCoords = () => new Promise(res => {
  if (!navigator.geolocation) return res(null);
  navigator.geolocation.getCurrentPosition(
    p => res({ lat: p.coords.latitude, lon: p.coords.longitude }),
    () => res(null),
    { enableHighAccuracy: true, timeout: 10000 }
  );
});

export default function TravelPopup({ onClose, onSaveLeg }) {
  const user = getCurrentUser();
  const K = { TRIPS: keys.trips(user.id), ACTIVE: keys.activeTrip(user.id) };

  const [active, setActive] = useState(() => loadJSON(K.ACTIVE, null));
  const [tripsToday, setTripsToday] = useState(() => loadJSON(K.TRIPS, []));
  const [startName, setStartName] = useState(DEFAULT_LOCATIONS[2]);
  const [endName, setEndName] = useState(DEFAULT_LOCATIONS[0]);
  const [note, setNote] = useState("");

  // live timer
  const [tick, setTick] = useState(0);
  useEffect(() => { if (!active) return; const id = setInterval(()=>setTick(t=>t+1),1000); return ()=>clearInterval(id); }, [active]);
  const tripMs = useMemo(() => !active ? 0 : (Date.now() - new Date(active.startTime).getTime()), [active, tick]);

  // storage sync
  useEffect(() => {
    const sync = () => {
      setActive(loadJSON(K.ACTIVE, null));
      setTripsToday(loadJSON(K.TRIPS, []));
    };
    const onUser = () => window.location.reload();
    window.addEventListener("storage", sync);
    window.addEventListener("rda:userChanged", onUser);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("rda:userChanged", onUser);
    };
  }, [K.ACTIVE, K.TRIPS]);

  const saveActive = (leg) => { saveJSON(K.ACTIVE, leg); setActive(leg); };
  const pushTrip = (leg) => { const list = [leg, ...loadJSON(K.TRIPS, [])]; saveJSON(K.TRIPS, list); setTripsToday(list); };

  const startTrip = async (mode="dropdown") => {
    let sName = startName, sCoords = null;
    if (mode === "gps") {
      sCoords = await getCoords();
      sName = prompt("Name for current (GPS) start location?", sName || "Start") || "Start";
    }
    const leg = {
      id: uid(), startName: sName, startTime: new Date().toISOString(),
      startCoords: sCoords, endName: "", endTime: null, endCoords: null, km: 0, note: "", date: new Date().toISOString().slice(0,10)
    };
    saveActive(leg);
    window.dispatchEvent(new CustomEvent("rda:tripStarted", { detail: leg }));
  };

  const arrive = async (mode="gps") => {
    if (!active) return;
    const endCoords = mode === "gps" ? await getCoords() : null;
    const end = mode === "gps"
      ? (prompt("Name for current (GPS) end location?", endName || "End") || "End")
      : endName;

    const km = active.startCoords && endCoords ? haversine(active.startCoords, endCoords) : 0;
    const finished = { ...active, endName: end, endTime: new Date().toISOString(), endCoords, km, note: note.trim() };

    pushTrip(finished);
    localStorage.removeItem(K.ACTIVE);
    setActive(null); setNote("");
    window.dispatchEvent(new CustomEvent("rda:arrived", { detail: finished }));

    if (typeof onSaveLeg === "function") onSaveLeg(finished);
    if (typeof onClose === "function") onClose(); // close popup
  };

  return (
    <div className="popup-mask full-opaque">
      <div className="popup-panel fullscreen-minus-bottom">
        <Card title={`Travel ${active ? "• active" : ""}`} subtitle={active ? "Trip is running — close this leg with Arrive" : "Start a new leg"} wide>
          {active && (
            <div style={{ display:"flex", gap:12, alignItems:"center", marginBottom:10, flexWrap:"wrap" }}>
              <div style={{ background:"#0b1020", border:"1px solid rgba(148,163,184,.18)", borderRadius:12, padding:"10px 14px", minWidth:200 }}>
                <div className="muted">Trip time</div>
                <div style={{ fontSize:22, fontWeight:700 }}>{fmtClock(tripMs)}</div>
              </div>
              <div className="muted">Active: {active.startName || "Start"} → {active.endName || "…"}</div>
            </div>
          )}

          <div className="grid2">
            <div>
              <label className="lbl">Start</label>
              <select className="select" value={startName} onChange={(e)=>setStartName(e.target.value)} disabled={!!active}>
                {DEFAULT_LOCATIONS.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className="lbl">End</label>
              <select className="select" value={endName} onChange={(e)=>setEndName(e.target.value)} disabled={!!active}>
                {DEFAULT_LOCATIONS.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          {!active ? (
            <>
              <div className="btnrow" style={{ marginTop: 8 }}>
                <button className="btn primary" onClick={() => startTrip("dropdown")}>Start Trip</button>
                <button className="btn" onClick={() => startTrip("gps")}>Quick one-time (GPS) → Start</button>
              </div>
            </>
          ) : (
            <>
              <div style={{ marginTop: 8 }}>
                <label className="lbl">Trip note (optional)</label>
                <textarea className="input" rows={3} placeholder="What/why (used later on invoice)" value={note} onChange={(e)=>setNote(e.target.value)} />
              </div>
              <div className="btnrow" style={{ marginTop: 8 }}>
                <button className="btn primary" onClick={() => arrive("gps")}>Arrive (GPS)</button>
                <button className="btn" onClick={() => arrive("manual")}>Arrive (manual)</button>
                <button className="btn ghost" onClick={onClose}>Hide</button>
              </div>
            </>
          )}
        </Card>

        <Card title="Today’s trips" subtitle={`${tripsToday.length} legs`} wide>
          {tripsToday.length === 0 ? <div className="muted">No legs yet.</div> : (
            <ul style={{ marginTop: 4 }}>
              {tripsToday.map((leg, i) => (
                <li key={leg.id} style={{ marginBottom: 4 }}>
                  <strong>Leg {i + 1}</strong> • {leg.date} • {leg.startName} → {leg.endName} • {leg.km?.toFixed ? leg.km.toFixed(1) : leg.km} km {leg.note ? ` • ${leg.note}` : ""}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
