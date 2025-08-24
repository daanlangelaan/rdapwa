import { useEffect, useMemo, useState } from "react";
import Card from "./Card";

const fmt = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
};

export default function TravelPopup({
  startChoice, endChoice, setStartChoice, setEndChoice, locationOptions,
  onStartGPS, onStartManual,
  onArrive,                                     // <— één arrive-handler met payload
  activeLeg, tripElapsedMs,
  onClose
}) {
  const active = !!activeLeg;

  // geïntegreerde travel note
  const defaultMinutes = useMemo(
    () => Math.max(1, Math.round(tripElapsedMs / 60000)),
    [tripElapsedMs]
  );
  const [noteTitle, setNoteTitle] = useState("");
  const [noteMinutes, setNoteMinutes] = useState(defaultMinutes);
  const [noteBillable, setNoteBillable] = useState(true);

  // sync minuten met looptijd, maar alleen als gebruiker het niet zelf aanpast
  useEffect(() => {
    setNoteMinutes((m) => (String(m) === "" ? defaultMinutes : m));
  }, [defaultMinutes]);

  const makeNote = () => ({
    title: (noteTitle || "").trim(),
    minutes: Math.max(1, parseInt(noteMinutes || defaultMinutes, 10)),
    billable: !!noteBillable,
  });

  const arriveGps = () => onArrive({ viaGPS: true, note: makeNote() });
  const arriveManual = () => onArrive({ viaGPS: false, note: makeNote() });

  return (
    <div className="popup-mask full-opaque">
      <div className="popup-panel fullscreen-minus-bottom">
        <Card
          title={`Travel ${active ? "• active" : ""}`}
          subtitle={active ? "Trip is running — you can arrive to close this leg" : "Set start/end and begin your trip"}
          wide
        >
          {/* Trip time */}
          <div className="leglist" style={{ marginBottom: 10 }}>
            <div className="legcard" style={{ alignItems: "center" }}>
              <div>
                <div className="title">Trip time</div>
                <div className="muted">Running duration</div>
              </div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{fmt(tripElapsedMs)}</div>
            </div>
          </div>

          {/* Selectors */}
          <div className="grid2">
            <div>
              <label className="lbl">Start</label>
              <select
                className="select"
                value={startChoice}
                onChange={(e) => setStartChoice(e.target.value)}
                disabled={active}
              >
                {locationOptions.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="lbl">End</label>
              <select
                className="select"
                value={endChoice}
                onChange={(e) => setEndChoice(e.target.value)}
              >
                {locationOptions.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Geïntegreerde Travel note */}
          <Card title="Travel note" subtitle="Saved as a 'Travel' item in your workday" style={{ marginTop: 10 }}>
            <div className="grid2">
              <div>
                <label className="lbl">Title</label>
                <input
                  className="input"
                  placeholder="e.g. Site visit / pickup"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="lbl">Minutes</label>
                <input
                  className="input"
                  type="number"
                  min="1"
                  step="1"
                  value={noteMinutes}
                  onChange={(e) => setNoteMinutes(e.target.value)}
                />
                <div className="muted" style={{ marginTop: 4 }}>
                  Tip: default = trip time ({defaultMinutes} min)
                </div>
              </div>
            </div>
            <div className="btnrow" style={{ marginTop: 6 }}>
              <label className="lbl" style={{ margin: 0 }}>
                <input
                  type="checkbox"
                  checked={noteBillable}
                  onChange={(e) => setNoteBillable(e.target.checked)}
                />{" "}
                Billable
              </label>
            </div>
          </Card>

          {/* Controls */}
          {!active ? (
            <div className="btnrow" style={{ marginTop: 10 }}>
              <button className="btn primary" onClick={onStartGPS}>Start (GPS)</button>
              <button className="btn" onClick={onStartManual}>Start (manual)</button>
            </div>
          ) : (
            <div className="btnrow" style={{ marginTop: 10 }}>
              <button className="btn primary" onClick={arriveGps}>Arrive (GPS)</button>
              <button className="btn" onClick={arriveManual}>Arrive (manual)</button>
            </div>
          )}

          <div className="btnrow">
            <button className="btn ghost" onClick={onClose}>Hide</button>
          </div>
        </Card>
      </div>
    </div>
  );
}
