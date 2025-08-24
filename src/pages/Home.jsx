import { useEffect, useState } from "react";
import Card from "../components/Card";
import WorkTimer from "../components/WorkTimer";

/* ---------- helpers ---------- */
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

const BUILT_INS = {
  Werkplaats: { lat: 51.924, lon: 4.479 },
  "Kantoor/Rosa": { lat: 51.915, lon: 4.485 },
  "Werkplaats 2": { lat: 51.93, lon: 4.5 },
  "Client (project)": { lat: 51.89, lon: 4.43 },
  "Huis Daan": { lat: 51.92, lon: 4.44 },
};

const FAV_KEY = "rda.favorites";
const loadFavs = () => {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
  } catch {
    return [];
  }
};
const saveFavs = (list) => localStorage.setItem(FAV_KEY, JSON.stringify(list));

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

  /* Dag-status voor UI: na End Day verbergen we de kaarten tot er weer iets gebeurt */
  const [dayClosed, setDayClosed] = useState(false);

  const resolve = async (choice) => {
    if (choice === "GPS (current)") {
      return new Promise((res) =>
        navigator.geolocation
          ? navigator.geolocation.getCurrentPosition(
              (p) =>
                res({
                  lat: p.coords.latitude,
                  lon: p.coords.longitude,
                }),
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

  // Quick one-time (GPS): vraag naam → sla op als favourite → selecteer direct
  const quickGPS = async (applyTo /* 'start' | 'end' */) => {
    if (!("geolocation" in navigator)) {
      alert("Geolocation not available.");
      return;
    }
    const name = prompt(
      "Name for this location (will be saved as favorite):"
    );
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
        setDayClosed(false); // UI heropenen zodra er weer activiteit is
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
    setDayClosed(false); // UI openen als dag gesloten was
    // → WorkTimer: dag aan + naar Travel
    window.dispatchEvent(new Event("rda:tripStarted"));
  };

  const arrive = async () => {
    if (!active) {
      alert("No active trip");
      return;
    }
    const e = await resolve(endChoice);
    const km = haversineKm(active.start, e);
    setLegs((prev) => [
      ...prev,
      { ...active, end: e, km, project, id: crypto.randomUUID() },
    ]);
    setActive({
      id: crypto.randomUUID(),
      start: e,
      stop: active.stop + 1,
      date: new Date().toISOString().slice(0, 10),
    });
    setDayClosed(false);
    // → WorkTimer: voorstel om terug te gaan naar laatste niet-Travel
    window.dispatchEvent(new Event("rda:arrived"));
  };

  const endDay = () => {
    // Wis trips in de UI en sluit de dag in de WorkTimer (die toont samenvatting)
    setActive(null);
    setLegs([]);
    setDayClosed(true); // verberg kaarten tot volgende actie
    window.dispatchEvent(new Event("rda:endDay"));
  };

  return (
    <div className="page">
      {/* Sticky project bar */}
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

      {/* Als de dag gesloten is: een korte melding */}
      {dayClosed && (
        <Card title="Day closed" subtitle="Start a trip or choose an activity to begin a new day" wide>
          <div className="muted">
            Your trips list is cleared and the timer is reset. Any new action will
            start a fresh day timer.
          </div>
        </Card>
      )}

      {/* Trips & WorkTimer alleen tonen als de dag niet gesloten is */}
      {!dayClosed && (
        <>
          <Card title="Trips" subtitle="Start • Arrive" wide>
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
              <button className="btn primary" onClick={startTrip}>
                Start Trip
              </button>
              <button className="btn" onClick={arrive}>
                Arrive
              </button>
            </div>

            <div className="hint">
              Active leg:{" "}
              {active
                ? `Stop #${active.stop} (${active.start.lat.toFixed(
                    4
                  )}, ${active.start.lon.toFixed(4)})`
                : "none"}
            </div>

            <div className="leglist">
              {legs.map((l, i) => (
                <div key={l.id} className="legcard">
                  <div>
                    <div className="title">
                      Leg {i + 1} • {l.project}
                    </div>
                    <div className="muted">
                      {l.date} • {l.km?.toFixed(1)} km (fastest)
                    </div>
                  </div>
                  <div className="badge">#{l.stop}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* WorkTimer toont al live per-activity breakdown + total today */}
          <WorkTimer />
        </>
      )}

      {/* Globale dagacties – ALTIJD zichtbaar, onderaan de pagina */}
      <Card title="Day controls" subtitle="Close the day globally (trips + timer)">
        <div className="btnrow">
          <button className="btn ghost" onClick={endDay}>
            End Day
          </button>
        </div>
        <div className="muted">
          End Day closes the WorkTimer (summary popup) and clears the Trips list on this
          screen. Any new action (start trip, switch activity) starts a fresh day timer.
        </div>
      </Card>
    </div>
  );
}
