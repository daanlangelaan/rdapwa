import Card from "../components/Card";
import { useState, useEffect } from "react";

/* ---- persistence helpers ---- */
const LS_KEY = "rda.favorites";
const loadFavorites = () => {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); }
  catch { return []; }
};
const saveFavorites = (list) => {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
};

export default function Settings() {
  // demo rates (unchanged)
  const [rateHour, setRateHour] = useState(95);
  const [rateKm, setRateKm] = useState(0.23);

  // favorites
  const [favorites, setFavorites] = useState(loadFavorites());

  useEffect(() => {
    // reload if user came back to tab
    const onShow = () => setFavorites(loadFavorites());
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, []);

  // form state for new favorite
  const [mode, setMode] = useState("gps"); // "gps" | "manual"
  const [name, setName] = useState("");
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const pickGPS = async () => {
    setMsg("");
    if (!("geolocation" in navigator)) {
      setMsg("Geolocation not available in this browser.");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLat(p.coords.latitude.toFixed(6));
        setLon(p.coords.longitude.toFixed(6));
        setBusy(false);
      },
      (err) => {
        setMsg("Could not get position.");
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const addFavorite = () => {
    setMsg("");
    const nm = name.trim();
    const la = parseFloat(String(lat).replace(",", "."));
    const lo = parseFloat(String(lon).replace(",", "."));

    if (!nm) return setMsg("Please enter a name.");
    if (Number.isNaN(la) || Number.isNaN(lo)) return setMsg("Lat/Lon are required numbers.");

    const newFav = { id: crypto.randomUUID(), name: nm, lat: la, lon: lo };
    const next = [...favorites, newFav];
    setFavorites(next);
    saveFavorites(next);

    // reset form
    setName("");
    setLat("");
    setLon("");
    setMode("gps");
    setMsg("Saved ✔");
  };

  const removeFavorite = (id) => {
    const next = favorites.filter((f) => f.id !== id);
    setFavorites(next);
    saveFavorites(next);
  };

  return (
    <div className="page">
      <Card title="Rates" subtitle="Defaults per project">
        <div className="grid2">
          <div>
            <label className="lbl">Rate/hour</label>
            <input
              className="input"
              type="number"
              step="0.01"
              value={rateHour}
              onChange={(e) => setRateHour(+e.target.value)}
            />
          </div>
          <div>
            <label className="lbl">Rate/km</label>
            <input
              className="input"
              type="number"
              step="0.01"
              value={rateKm}
              onChange={(e) => setRateKm(+e.target.value)}
            />
          </div>
        </div>
      </Card>

      <Card title="Favorite locations" subtitle="Use these in Start/End dropdowns" wide>
        {/* Add new favorite */}
        <div style={{ display: "grid", gap: 10 }}>
          <div className="grid2">
            <div>
              <label className="lbl">Name</label>
              <input
                className="input"
                placeholder="e.g. Kantoor/Rosa, Huis Daan"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="lbl">Mode</label>
              <select
                className="select"
                value={mode}
                onChange={(e) => setMode(e.target.value)}
              >
                <option value="gps">Use current GPS</option>
                <option value="manual">Manual lat/lon</option>
              </select>
            </div>
          </div>

          {mode === "gps" ? (
            <div className="grid2">
              <div>
                <label className="lbl">Latitude</label>
                <input
                  className="input"
                  placeholder="press Get current GPS"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                />
              </div>
              <div>
                <label className="lbl">Longitude</label>
                <input
                  className="input"
                  placeholder="press Get current GPS"
                  value={lon}
                  onChange={(e) => setLon(e.target.value)}
                />
              </div>
              <div className="btnrow">
                <button className="btn" onClick={pickGPS} disabled={busy}>
                  {busy ? "Locating…" : "Get current GPS"}
                </button>
                <button className="btn primary" onClick={addFavorite} disabled={busy}>
                  Save favorite
                </button>
              </div>
            </div>
          ) : (
            <div className="grid2">
              <div>
                <label className="lbl">Latitude</label>
                <input
                  className="input"
                  placeholder="e.g. 51.924000"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                />
              </div>
              <div>
                <label className="lbl">Longitude</label>
                <input
                  className="input"
                  placeholder="e.g. 4.479000"
                  value={lon}
                  onChange={(e) => setLon(e.target.value)}
                />
              </div>
              <div className="btnrow">
                <button className="btn primary" onClick={addFavorite}>
                  Save favorite
                </button>
              </div>
            </div>
          )}

          {msg && <div className="muted">{msg}</div>}

          {/* List existing favorites */}
          {favorites.length > 0 ? (
            <div className="leglist" style={{ marginTop: 6 }}>
              {favorites.map((f) => (
                <div key={f.id} className="legcard">
                  <div>
                    <div className="title">{f.name}</div>
                    <div className="muted">
                      {f.lat.toFixed(6)}, {f.lon.toFixed(6)}
                    </div>
                  </div>
                  <button className="btn ghost" onClick={() => removeFavorite(f.id)}>
                    Delete
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="muted">No favorites yet.</div>
          )}
        </div>
      </Card>
    </div>
  );
}
