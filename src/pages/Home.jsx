import { useEffect, useMemo, useState } from "react";
import Card from "../components/Card";
import WorkTimer from "../components/WorkTimer";

/* ---------- helpers ---------- */
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
  return 2 * R * Math.asin(Math.sqrt(h)) * 1.25; // fastest route benadering
};

const BUILT_INS = {
  Werkplaats: { lat: 51.924, lon: 4.479 },
  "Kantoor/Rosa": { lat: 51.915, lon: 4.485 },
  "Werkplaats 2": { lat: 51.93, lon: 4.5 },
  "Client (project)": { lat: 51.89, lon: 4.43 },
  "Huis Daan": { lat: 51.92, lon: 4.44 },
};

const FAV_KEY = "rda.favorites";
const LOG_KEY = "rda.daylog.v1";
const TRIP_CLOCK_KEY = "rda.tripclock.v1";

const loadFavs = () => {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) || "[]"); }
  catch { return []; }
};
const saveFavs = (list) => localStorage.setItem(FAV_KEY, JSON.stringify(list));
const loadLog = () => {
  try { return JSON.parse(localStorage.getItem(LOG_KEY) || "[]"); }
  catch { return []; }
};
const saveLog = (items) => localStorage.setItem(LOG_KEY, JSON.stringify(items));

const loadTripClock = () => {
  try { return JSON.parse(localStorage.getItem(TRIP_CLOCK_KEY) || "null"); }
  catch { return null; }
};
const saveTripClock = (obj) =>
  localStorage.setItem(TRIP_CLOCK_KEY, JSON.stringify(obj));
const clearTripClock = () => localStorage.removeItem(TRIP_CLOCK_KEY);

export default function Home() {
  /* Project quick picker */
  const [project, setProject] = useState("Project A");
  const projects = ["Project A", "Project B", "RDM Retrofit"];

  /* Favorites */
  const [favorites, setFavorites] = useState(loadFavs());
  useEffect(() => {
    const onShow = () => setFavorites(loadFavs());
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, []);

  /* Trip state */
  const [startChoice, setStart] = useState("Huis Daan");
  const [endChoice, setEnd] = useState("Client (project)");
  const [active, setActive] = useState(null);
  const [legs, setLegs] = useState([]);

  /* Dag-status (UI dicht/open) */
  const [dayClosed, setDayClosed] = useState(false);

  /* Trip clock (los van WorkTimer): { baseMs, startAt } */
  const [tripClock, setTripClock] = useState(() => {
    return loadTripClock() || { baseMs: 0, startAt: null };
  });

  // trip clock live teller
  useEffect(() => {
    const i = setInterval(() => {
      setTripClock((t) => ({ ...t })); // trigger re-render
    }, 1000);
    return () => clearInterval(i);
  }, []);
  // persist
  useEffect(() => { saveTripClock(tripClock); }, [tripClock]);

  const tripElapsedMs = useMemo(() => {
    const live = tripClock.startAt ? Date.now() - tripClock.startAt : 0;
    return tripClock.baseMs + live;
  }, [tripClock]);

  const resetAndStartTripClock = () => {
    setTripClock({ baseMs: 0, startAt: Date.now() });
  };
  const stopTripClock = () => {
    setTripClock((t) => {
      if (!t.startAt) return { baseMs: 0, startAt: null };
      return { baseMs: t.baseMs + (Date.now() - t.startAt), startAt: null };
    });
  };
  const clearTripClockAll = () => {
    setTripClock({ baseMs: 0, startAt: null });
    clearTripClock();
  };

  /* helpers */
  const resolve = async (choice) => {
    if (choice === "GPS (current)") {
      return new Promise((res) =>
        navigator.geolocation
          ? navigator.geolocation.getCurrentPosition(
              (p) => res({ lat: p.coords.latitude, lon: p.coords.longitude }),
              () => res(BUILT_INS["Werkplaats"])
            )
          : res(BUILT_INS["Werkplaats"])
      );
    }
    const favMap = Object.fromEntries(
      favorites.map((f) => [f.name, { lat: f.lat, lon: f.lon }])
    );
    const merged = { ...BUILT_INS, ...favMap };
    return merged[choice] ?? BUILT_INS["Werkplaats"];
  };

  const locationOptions = [
    ...Object.keys(BUILT_INS),
    ...favorites.map((f) => f.name),
    "GPS (current)",
  ];

  const quickGPS = async (applyTo) => {
    if (!("geolocation" in navigator)) {
      alert("Geolocation not available.");
      return;
    }
    const name = prompt("Name for this location (will be saved as favorite):");
    if (!name) return;
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const fav = {
          id: crypto.randomUUID(),
          name: name.trim(),
          lat: +p.coords.latitude.toFixed(6),
          lon: +p.coords.longitude.toFixed(6),
        };
        const next = [...favorites, fav];
        setFavorites(next);
        saveFavs(next);
        if (applyTo === "start") setStart(fav.name);
        if (applyTo === "end") setEnd(fav.name);
        setDayClosed(false);
        alert(`Saved "${fav.name}" and selected as ${applyTo}.`);
      },
      () => alert("Could not get current GPS position."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const startTrip = async () => {
    const s = await resolve(startChoice);
    setActive({
      id: crypto.randomUUID(),
      start: s,
      stop: 1,
      date: new Date().toISOString().slice(0, 10),
    });
    setDayClosed(false);
    resetAndStartTripClock();          // ⏱️ Start trip clock
    window.dispatchEvent(new Event("rda:tripStarted")); // WorkTimer → Travel
  };

  const arrive = async () => {
    if (!active) return alert("No active trip");
    const e = await resolve(endChoice);
    const km = haversineKm(active.start, e);
    setLegs((prev) => [
      ...prev,
      { ...active, end: e, km, project, id: crypto.randomUUID() },
    ]);
    // volgende leg voorbereiden
    setActive({
      id: crypto.randomUUID(),
      start: e,
      stop: active.stop + 1,
      date: new Date().toISOString().slice(0, 10),
    });
    setDayClosed(false);

    // ⏱️ bij aankomst: klok herstarten voor de volgende leg
    resetAndStartTripClock();

    // WorkTimer → vraag resume last non-travel
    window.dispatchEvent(new Event("rda:arrived"));
  };

  // --- GLOBAL END DAY ---
  const endDay = async () => {
    // 1) vraag samenvatting aan WorkTimer (vóór reset)
    const summary = await new Promise((resolve) => {
      const onSummary = (e) => {
        window.removeEventListener("rda:summary", onSummary);
        resolve(e.detail); // { totalMs, perActivityMs, note, wbso }
      };
      window.addEventListener("rda:summary", onSummary, { once: true });
      window.dispatchEvent(new Event("rda:requestSummary"));
    });

    // 2) schrijf daglog weg
    const logItems = loadLog();
    const entry = {
      id: crypto.randomUUID(),
      date: new Date().toISOString().slice(0, 10),
      project,
      legs,
      summary,
      tripClockAtCloseMs: tripElapsedMs, // optioneel inzicht in laatste leg looptijd
    };
    saveLog([entry, ...logItems]);

    // 3) UI opschonen + clocks/Timer resetten
    setActive(null);
    setLegs([]);
    clearTripClockAll(); // ⏱️ trip klok stoppen & wissen
    setDayClosed(true);
    window.dispatchEvent(new Event("rda:endDay"));
  };

  return (
    <div className="page">
      {/* sticky top bar */}
      <div className="quickbar">
        <label className="lbl">Project</label>
        <select
          value={project}
          onChange={(e) => setProject(e.target.value)}
          className="select"
        >
          {projects.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </div>

      {dayClosed && (
        <Card title="Day closed" subtitle="Start a trip or choose an activity to begin a new day" wide>
          <div className="muted">
            Trips and activities are cleared. Any new action will start a fresh day timer.
          </div>
        </Card>
      )}

      {!dayClosed && (
        <>
          <Card
            title="Trips"
            subtitle={
              <>
                Start • Arrive
                <span style={{ marginLeft: 10, opacity: 0.7 }}>
                  | Trip time: <b>{fmt(tripElapsedMs)}</b>
                </span>
              </>
            }
            wide
          >
            <div className="grid2">
              <div>
                <label className="lbl">Start point</label>
                <select
                  className="select"
                  value={startChoice}
                  onChange={(e) => setStart(e.target.value)}
                >
                  {locationOptions.map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>
                <div className="btnrow" style={{ marginTop: 6 }}>
                  <button className="btn" onClick={() => quickGPS("start")}>
                    Quick one-time (GPS) → Start
                  </button>
                </div>
              </div>
              <div>
                <label className="lbl">End point</label>
                <select
                  className="select"
                  value={endChoice}
                  onChange={(e) => setEnd(e.target.value)}
                >
                  {locationOptions.map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>
                <div className="btnrow" style={{ marginTop: 6 }}>
                  <button className="btn" onClick={() => quickGPS("end")}>
                    Quick one-time (GPS) → End
                  </button>
                </div>
              </div>
            </div>

            <div className="btnrow">
              <button className="btn primary" onClick={startTrip}>Start Trip</button>
              <button className="btn" onClick={arrive}>Arrive</button>
            </div>

            <div className="hint">
              Active leg:{" "}
              {active
                ? `Stop #${active.stop} (${active.start.lat.toFixed(4)}, ${active.start.lon.toFixed(4)})`
                : "none"}
            </div>

            <div className="leglist">
              {legs.map((l, i) => (
                <div key={l.id} className="legcard">
                  <div>
                    <div className="title">Leg {i + 1} • {l.project}</div>
                    <div className="muted">
                      {l.date} • {l.km?.toFixed(1)} km (fastest)
                    </div>
                  </div>
                  <div className="badge">#{l.stop}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* WorkTimer laat total + per-activity zien */}
          <WorkTimer />
        </>
      )}

      {/* GLOBAL day controls onderaan */}
      <Card title="Day controls" subtitle="Close the day globally (trips + timer)">
        <div className="btnrow">
          <button className="btn ghost" onClick={endDay}>End Day</button>
        </div>
        <div className="muted">
          Saves a day entry to Day Log (legs + activities + trip time), resets timer and clears Home.
        </div>
      </Card>
    </div>
  );
}
