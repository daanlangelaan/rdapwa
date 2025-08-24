import { useEffect, useMemo, useState } from "react";
import Card from "../components/Card";
import WorkTimer from "../components/WorkTimer";
import TravelPopup from "../components/TravelPopup";

/* helpers */
const fmt = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
};
const haversineKm = (a, b) => {
  const R = 6371,
    dLat = ((b.lat - a.lat) * Math.PI) / 180,
    dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180,
    la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h)) * 1.25;
};
/* storage */
const FAV_KEY = "rda.favorites";
const LOG_KEY = "rda.daylog.v2";
const TRIP_CLOCK_KEY = "rda.tripclock.v1";
const load = (k, fb) => { try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(fb)); } catch { return fb; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

/* built-ins */
const BUILT_INS = {
  "Werkplaats": { lat: 51.924, lon: 4.479 },
  "Kantoor/Rosa": { lat: 51.915, lon: 4.485 },
  "Werkplaats 2": { lat: 51.93, lon: 4.5 },
  "Client": { lat: 51.89, lon: 4.43 },
  "Huis Daan": { lat: 51.92, lon: 4.44 },
};

export default function Home() {
  const [project, setProject] = useState("Project A");
  const projects = ["Project A", "Project B", "RDM Retrofit"];

  const [favorites, setFavorites] = useState(load(FAV_KEY, []));
  useEffect(() => {
    const onVis = () => setFavorites(load(FAV_KEY, []));
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const [dayClosed, setDayClosed] = useState(false);

  const [showTravel, setShowTravel] = useState(false);

  const [startChoice, setStart] = useState("Huis Daan");
  const [endChoice, setEnd] = useState("Werkplaats");
  const [activeLeg, setActiveLeg] = useState(null);
  const [legs, setLegs] = useState([]);

  const [tripClock, setTripClock] = useState(load(TRIP_CLOCK_KEY, { baseMs: 0, startAt: null }));
  useEffect(() => save(TRIP_CLOCK_KEY, tripClock), [tripClock]);
  useEffect(() => {
    const t = setInterval(() => setTripClock((tk) => ({ ...tk })), 1000);
    return () => clearInterval(t);
  }, []);
  const tripElapsedMs = useMemo(() => tripClock.baseMs + (tripClock.startAt ? Date.now() - tripClock.startAt : 0), [tripClock]);

  const handleRequestTravel = () => {
    setDayClosed(false);
    setShowTravel(true);
  };

  const resolve = async (choice) => {
    if (choice === "GPS (current)") {
      return new Promise((res) =>
        navigator.geolocation
          ? navigator.geolocation.getCurrentPosition(
              (p) => res({ lat: p.coords.latitude, lon: p.coords.longitude }),
              () => res(BUILT_INS["Werkplaats"]),
              { enableHighAccuracy: true, timeout: 10000 }
            )
          : res(BUILT_INS["Werkplaats"])
      );
    }
    const favMap = Object.fromEntries(favorites.map((f) => [f.name, { lat: f.lat, lon: f.lon }]));
    const merged = { ...BUILT_INS, ...favMap };
    return merged[choice] ?? BUILT_INS["Werkplaats"];
  };

  const locationOptions = [
    ...Object.keys(BUILT_INS),
    ...favorites.map((f) => f.name),
    "GPS (current)",
  ];

  const startTrip = async (viaGPS = false) => {
    const s = await resolve(startChoice);
    setActiveLeg({
      id: crypto.randomUUID(),
      start: s,
      stop: 1,
      viaGPS,
      date: new Date().toISOString().slice(0, 10),
    });
    setDayClosed(false);
    setTripClock({ baseMs: 0, startAt: Date.now() });
    window.dispatchEvent(new Event("rda:tripStarted"));
    // popup blijft open tijdens rit
  };

  const arrive = async ({ viaGPS, note }) => {
    if (!activeLeg) return alert("No active trip");
    const e = await resolve(endChoice);
    const km = haversineKm(activeLeg.start, e);

    const legDone = { ...activeLeg, end: e, km, project, id: crypto.randomUUID() };
    setLegs((prev) => [...prev, legDone]);

    // Travel note toevoegen via WorkTimer (alleen als er een titel is)
    const minutesFallback = Math.max(1, Math.round(tripElapsedMs / 60000));
    if (note?.title?.trim()) {
      window.dispatchEvent(
        new CustomEvent("rda:addActivityItem", {
          detail: {
            activity: "Travel",
            title: note.title.trim(),
            minutes: Math.max(1, parseInt(note.minutes || minutesFallback, 10)),
            billable: !!note.billable,
            wbso: false,
            startAt: new Date(Date.now() - minutesFallback * 60000).toISOString(),
            endAt: new Date().toISOString(),
          },
        })
      );
    } else if (viaGPS) {
      // Bij GPS is notitie verplicht
      alert("Please add a short travel note before arriving (GPS trip).");
      return;
    }

    // klaar met rit → sluit popup
    setActiveLeg(null);
    setTripClock({ baseMs: 0, startAt: null });
    setShowTravel(false);

    window.dispatchEvent(new Event("rda:arrived"));
  };

  const endDay = async () => {
    const summary = await new Promise((resolve) => {
      const onSummary = (e) => { window.removeEventListener("rda:summary", onSummary); resolve(e.detail); };
      window.addEventListener("rda:summary", onSummary, { once: true });
      window.dispatchEvent(new Event("rda:requestSummary"));
    });

    const entry = {
      id: crypto.randomUUID(),
      date: new Date().toISOString().slice(0, 10),
      project,
      legs,
      summary,
    };
    const all = load(LOG_KEY, []);
    save(LOG_KEY, [entry, ...all]);

    setActiveLeg(null);
    setLegs([]);
    setTripClock({ baseMs: 0, startAt: null });
    setDayClosed(true);
    setShowTravel(false);

    window.dispatchEvent(new Event("rda:endDay"));
  };

  return (
    <div className="page">
      {/* top bar */}
      <div className="quickbar">
        <label className="lbl">Project</label>
        <select className="select" value={project} onChange={(e) => setProject(e.target.value)}>
          {projects.map((p) => <option key={p}>{p}</option>)}
        </select>
        <div className="muted" style={{ marginLeft: 12 }}>
          Trip time: <b>{fmt(tripElapsedMs)}</b>
        </div>
      </div>

      {dayClosed ? (
        <Card title="Day closed" wide>
          <div className="muted">Start an activity or travel to begin a new day.</div>
        </Card>
      ) : (
        <>
          <WorkTimer onRequestTravel={handleRequestTravel} />

          {showTravel && (
            <TravelPopup
              startChoice={startChoice}
              endChoice={endChoice}
              setStartChoice={setStart}
              setEndChoice={setEnd}
              locationOptions={locationOptions}
              onStartGPS={() => startTrip(true)}
              onStartManual={() => startTrip(false)}
              onArrive={arrive}                       // <— geïntegreerde note
              activeLeg={activeLeg}
              tripElapsedMs={tripElapsedMs}
              onClose={() => setShowTravel(false)}
            />
          )}
        </>
      )}

      {/* Global End Day */}
      <Card title="End of day">
        <div className="btnrow">
          <button className="btn ghost" onClick={endDay}>End Day</button>
        </div>
      </Card>
    </div>
  );
}
