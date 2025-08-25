import { useEffect, useMemo, useState } from "react";
import Card from "../components/Card";
import WorkTimer from "../components/WorkTimer";
import TravelPopup from "../components/TravelPopup";

const DAYLOG_KEY = "rda.daylog.v1";
const TRIPS_KEY = "rda.trips.today";
const ACTIVE_TRIP_KEY = "rda.trip.active";

const fmtClock = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
};
const loadJSON = (k, fb) => {
  try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(fb)); }
  catch { return fb; }
};

export default function Home() {
  const [project, setProject] = useState("Project A");
  const projects = ["Project A", "Project B", "RDM Retrofit"];

  const [showTravel, setShowTravel] = useState(false);
  const [legsToday, setLegsToday] = useState(() => loadJSON(TRIPS_KEY, []));
  const [activeLeg, setActiveLeg] = useState(() => loadJSON(ACTIVE_TRIP_KEY, null));

  // Sync UI with storage changes
  useEffect(() => {
    const sync = () => {
      setLegsToday(loadJSON(TRIPS_KEY, []));
      setActiveLeg(loadJSON(ACTIVE_TRIP_KEY, null));
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  useEffect(() => {
    if (!showTravel) {
      setLegsToday(loadJSON(TRIPS_KEY, []));
      setActiveLeg(loadJSON(ACTIVE_TRIP_KEY, null));
    }
  }, [showTravel]);

  // Allow opening popup from WorkTimer (when switching to Travel)
  const openTravel = () => setShowTravel(true);

  // End day: pull summary → write daylog → clear today → reset WT
  const endDay = async () => {
    const summary = await new Promise((resolve) => {
      const onSummary = (e) => {
        window.removeEventListener("rda:summary", onSummary);
        resolve(e.detail || { totalMs: 0, perActivity: {} });
      };
      window.addEventListener("rda:summary", onSummary, { once: true });
      window.dispatchEvent(new CustomEvent("rda:requestSummary"));
    });

    const trips = loadJSON(TRIPS_KEY, []);

    const entry = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      date: new Date().toISOString().slice(0, 10),
      project,
      totalMs: summary.totalMs || 0,
      perActivity: summary.perActivity || {},
      trips,
      createdAt: new Date().toISOString(),
    };
    const log = [entry, ...loadJSON(DAYLOG_KEY, [])].slice(0, 90);
    localStorage.setItem(DAYLOG_KEY, JSON.stringify(log));

    localStorage.removeItem(TRIPS_KEY);
    localStorage.removeItem(ACTIVE_TRIP_KEY);

    window.dispatchEvent(new CustomEvent("rda:endDay"));

    alert(`End of day saved.\nTotal: ${fmtClock(entry.totalMs)}\nTrips: ${trips.length}`);

    setLegsToday([]);
    setActiveLeg(null);
  };

  const activeLegText = useMemo(() => {
    if (!activeLeg) return "none";
    const s = activeLeg.startName || "start";
    const e = activeLeg.endName || "(set on arrive)";
    return `${s} → ${e}`;
  }, [activeLeg]);

  return (
    <div className="page">
      <Card title="RDA Mobile • MVP" subtitle="tap an activity to switch • Travel opens trips popup">
        <div className="grid2">
          <div>
            <label className="lbl">Project</label>
            <select className="select" value={project} onChange={(e) => setProject(e.target.value)}>
              {projects.map((p) => (<option key={p} value={p}>{p}</option>))}
            </select>
          </div>
          <div>
            <label className="lbl">Today</label>
            <div className="muted">
              Trips: {legsToday.length} {activeLeg ? `• Active: ${activeLegText}` : "• Active: none"}
            </div>
            <div className="btnrow" style={{ marginTop: 6 }}>
              <button className="btn" onClick={openTravel}>Open Travel</button>
            </div>
          </div>
        </div>
      </Card>

      <WorkTimer onRequestTravel={openTravel} />

      <div className="btnrow" style={{ marginTop: 12, marginBottom: 70 }}>
        <button className="btn" onClick={openTravel}>Open Travel</button>
        <button className="btn primary" onClick={endDay}>End day</button>
      </div>

      {showTravel && (
        <TravelPopup
          onClose={() => setShowTravel(false)}
          onSaveLeg={() => {
            setLegsToday(loadJSON(TRIPS_KEY, []));
            setActiveLeg(loadJSON(ACTIVE_TRIP_KEY, null));
          }}
        />
      )}
    </div>
  );
}
