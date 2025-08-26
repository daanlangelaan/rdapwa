import { useEffect, useMemo, useState } from "react";
import Card from "../components/Card";
import WorkTimer from "../components/WorkTimer";
import TravelPopup from "../components/TravelPopup";

const DAYLOG_KEY = "rda.daylog.v1";
const TRIPS_KEY = "rda.trips.today";
const ACTIVE_TRIP_KEY = "rda.trip.active";
const RECEIPTS_KEY = "rda.receipts.v1";
const CURRENT_PROJECT_KEY = "rda.project.current";

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
const saveJSON = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const isoDate = (d = new Date()) => new Date(d).toISOString().slice(0, 10);

export default function Home() {
  // Project selectie (bewaar ook in LS zodat andere pagina’s het default project weten)
  const [project, setProject] = useState(() => {
    return localStorage.getItem(CURRENT_PROJECT_KEY) || "Project A";
  });
  const projects = ["Project A", "Project B", "RDM Retrofit"];

  useEffect(() => {
    localStorage.setItem(CURRENT_PROJECT_KEY, project);
  }, [project]);

  // Travel popup & status
  const [showTravel, setShowTravel] = useState(false);
  const [legsToday, setLegsToday] = useState(() => loadJSON(TRIPS_KEY, []));
  const [activeLeg, setActiveLeg] = useState(() => loadJSON(ACTIVE_TRIP_KEY, null));

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

  const openTravel = () => setShowTravel(true);

  // END DAY: voeg receipts van deze dag + dit project toe, wis daarna uit de lijst
  const endDay = async () => {
    // 1) Summary uit WorkTimer
    const summary = await new Promise((resolve) => {
      const onSummary = (e) => {
        window.removeEventListener("rda:summary", onSummary);
        resolve(e.detail || { totalMs: 0, perActivity: {} });
      };
      window.addEventListener("rda:summary", onSummary, { once: true });
      window.dispatchEvent(new CustomEvent("rda:requestSummary"));
    });

    // 2) Trips + Receipts (filter op vandaag + huidig project)
    const trips = loadJSON(TRIPS_KEY, []);
    const allReceipts = loadJSON(RECEIPTS_KEY, []);
    const today = isoDate();
    const inScope = allReceipts.filter((r) => {
      const rDate = (r.fields?.date && r.fields.date.slice(0, 10)) ||
                    (r.createdAt ? r.createdAt.slice(0, 10) : today);
      const rProject = r.project || project;
      return r.status === "done" && rProject === project && rDate === today;
    });

    // Minimal payload (kleine thumb + kernvelden)
    const receiptsPayload = inScope.map((r) => ({
      id: r.id,
      merchant: r.fields?.merchant || "",
      total: Number(r.fields?.total || 0),
      date: r.fields?.date || (r.createdAt ? r.createdAt.slice(0, 10) : today),
      project: r.project || project,
      thumb: r.imageDataUrl, // PWA-opslaan is ok; backend kan ‘m uploaden naar Asana
    }));

    // 3) Daylog entry opslaan
    const entry = {
      id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
      date: today,
      project,
      totalMs: summary.totalMs || 0,
      perActivity: summary.perActivity || {},
      trips,
      receipts: receiptsPayload,
      createdAt: new Date().toISOString(),
    };
    const log = [entry, ...loadJSON(DAYLOG_KEY, [])].slice(0, 90);
    saveJSON(DAYLOG_KEY, log);

    // 4) Opruimen: trips + actieve trip + receipts van vandaag voor dit project
    const remaining = allReceipts.filter((r) => !inScope.find((x) => x.id === r.id));
    saveJSON(RECEIPTS_KEY, remaining);
    localStorage.removeItem(TRIPS_KEY);
    localStorage.removeItem(ACTIVE_TRIP_KEY);

    // 5) WorkTimer resetten + feedback
    window.dispatchEvent(new CustomEvent("rda:endDay"));
    alert(
      `End of day saved.\nTotal: ${fmtClock(entry.totalMs)}\nTrips: ${trips.length}\nReceipts: ${receiptsPayload.length}`
    );

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
            setShowTravel(false);
          }}
        />
      )}
    </div>
  );
}
