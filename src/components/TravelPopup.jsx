import { useEffect, useMemo, useState } from "react";
import Card from "./Card";

const TRIPS_KEY = "rda.trips.today";
const ACTIVE_TRIP_KEY = "rda.trip.active";

/* Utils */
const uid = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

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

/* Haversine km */
const haversine = (a, b) => {
  if (!a || !b) return 0;
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
};

const DEFAULT_LOCATIONS = [
  "Werkplaats",
  "Kantoor/Rosa",
  "Huis Daan",
  "Client (project)",
];

export default function TravelPopup({ onClose, onSaveLeg }) {
  const [active, setActive] = useState(() => loadJSON(ACTIVE_TRIP_KEY, null));
  const [tripsToday, setTripsToday] = useState(() => loadJSON(TRIPS_KEY, []));
  const [startName, setStartName] = useState(DEFAULT_LOCATIONS[2]); // Huis Daan
  const [endName, setEndName] = useState(DEFAULT_LOCATIONS[0]);     // Werkplaats
  const [note, setNote] = useState("");
  const [geoMsg, setGeoMsg] = useState("");

  /* Live trip timer */
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [active]);

  const tripMs = useMemo(() => {
    if (!active) return 0;
    return (Date.now() - new Date(active.startTime).getTime()) | 0;
  }, [active, tick]);

  /* Re-sync bij storage wijzigingen (andere tabs/comp.) */
  useEffect(() => {
    const sync = () => {
      setActive(loadJSON(ACTIVE_TRIP_KEY, null));
      setTripsToday(loadJSON(TRIPS_KEY, []));
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const saveActive = (leg) => {
    saveJSON(ACTIVE_TRIP_KEY, leg);
    setActive(leg);
  };
  const pushTrip = (leg) => {
    const list = [leg, ...loadJSON(TRIPS_KEY, [])];
    saveJSON(TRIPS_KEY, list);
    setTripsToday(list);
  };

  /* GPS permissie dwingen */
  const askGeoPermission = () => {
    if (!navigator.geolocation) {
      setGeoMsg("Geolocatie wordt niet ondersteund door deze browser.");
      return;
    }
    setGeoMsg("Vraagt permissie…");
    navigator.geolocation.getCurrentPosition(
      () => setGeoMsg("Locatie OK ✓"),
      (err) => {
        setGeoMsg(
          "Locatie geblokkeerd. Sta 'Location' toe (slotje → Site permissions) of check Windows → Privacy & Security → Location."
        );
        console.warn(err);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const getCoords = () =>
    new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });

  /* Start leg */
  const startTrip = async (source = "dropdown") => {
    let sName = startName;
    let sCoords = null;

    if (source === "gps") {
      sCoords = await getCoords();
      sName =
        prompt("Name for current (GPS) start location?", startName || "Start") ||
        "Start";
    }

    const leg = {
      id: uid(),
      startName: sName,
      startTime: new Date().toISOString(),
      startCoords: sCoords, // kan null zijn
      endName: "",
      endTime: null,
      endCoords: null,
      km: 0,
      note: "",
      date: new Date().toISOString().slice(0, 10),
    };

    saveActive(leg);
    window.dispatchEvent(new CustomEvent("rda:tripStarted", { detail: leg }));
  };

  /* Arrive (GPS / handmatig) */
  const arriveGPS = async () => {
    if (!active) return;
    const coords = await getCoords();
    const end =
      prompt("Name for current (GPS) end location?", endName || "End") || "End";
    closeLeg(end, coords);
  };
  const arriveManual = () => {
    if (!active) return;
    closeLeg(endName, null);
  };

  /* ✅ Sluit popup na opslaan */
  const closeLeg = (endLabel, endCoords) => {
    if (!active) return;

    const km =
      active.startCoords && endCoords
        ? haversine(active.startCoords, endCoords)
        : 0;

    const finished = {
      ...active,
      endName: endLabel,
      endTime: new Date().toISOString(),
      endCoords,
      km,
      note: note.trim(),
    };

    // store & cleanup
    pushTrip(finished);
    localStorage.removeItem(ACTIVE_TRIP_KEY);
    setActive(null);
    setNote("");

    // events
    window.dispatchEvent(new CustomEvent("rda:arrived", { detail: finished }));

    // refresh Home en sluit popup
    if (typeof onSaveLeg === "function") onSaveLeg(finished);
    if (typeof onClose === "function") onClose();
  };

  return (
    <div className="popup-mask full-opaque">
      <div className="popup-panel fullscreen-minus-bottom">
        <Card
          title={`Travel ${active ? "• active" : ""}`}
          subtitle={active ? "Trip is running — close this leg with Arrive" : "Start a new leg"}
          wide
        >
          {/* Live timer */}
          {active && (
            <div
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
                marginBottom: 10,
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  background: "#0b1020",
                  border: "1px solid rgba(148,163,184,.18)",
                  borderRadius: 12,
                  padding: "10px 14px",
                  minWidth: 200,
                }}
              >
                <div className="muted">Trip time</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{fmtClock(tripMs)}</div>
              </div>
              <div className="muted" style={{ marginLeft: 6 }}>
                Active: {active.startName || "Start"} → {active.endName || "…"}
              </div>
            </div>
          )}

          {/* Start/End selectors */}
          <div className="grid2">
            <div>
              <label className="lbl">Start</label>
              <select
                className="select"
                value={startName}
                onChange={(e) => setStartName(e.target.value)}
                disabled={!!active}
              >
                {DEFAULT_LOCATIONS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="lbl">End</label>
              <select
                className="select"
                value={endName}
                onChange={(e) => setEndName(e.target.value)}
                disabled={!!active}
              >
                {DEFAULT_LOCATIONS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Actieknoppen */}
          {!active ? (
            <>
              <div className="btnrow" style={{ marginTop: 8 }}>
                <button className="btn primary" onClick={() => startTrip("dropdown")}>
                  Start Trip
                </button>
                <button className="btn" onClick={() => startTrip("gps")}>
                  Quick one-time (GPS) → Start
                </button>
              </div>

              <div className="btnrow" style={{ marginTop: 6 }}>
                <button className="btn" onClick={askGeoPermission}>
                  🔓 Enable GPS (ask permission)
                </button>
                {geoMsg && <div className="muted">{geoMsg}</div>}
              </div>
            </>
          ) : (
            <>
              {/* Note tijdens de rit */}
              <div style={{ marginTop: 8 }}>
                <label className="lbl">Trip note (optional)</label>
                <textarea
                  className="input"
                  rows={3}
                  placeholder="What/why (used later on invoice)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              <div className="btnrow" style={{ marginTop: 8 }}>
                <button className="btn primary" onClick={arriveGPS}>
                  Arrive (GPS)
                </button>
                <button className="btn" onClick={arriveManual}>
                  Arrive (manual)
                </button>
                <button className="btn ghost" onClick={onClose}>
                  Hide
                </button>
              </div>
            </>
          )}
        </Card>

        {/* Overzicht legs vandaag */}
        <Card title="Today’s trips" subtitle={`${tripsToday.length} legs`} wide>
          {tripsToday.length === 0 ? (
            <div className="muted">No legs yet.</div>
          ) : (
            <ul style={{ marginTop: 4 }}>
              {tripsToday.map((leg, i) => (
                <li key={leg.id} style={{ marginBottom: 4 }}>
                  <strong>Leg {i + 1}</strong> • {leg.date} • {leg.startName} → {leg.endName} •{" "}
                  {leg.km?.toFixed ? leg.km.toFixed(1) : leg.km} km
                  {leg.note ? ` • ${leg.note}` : ""}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
