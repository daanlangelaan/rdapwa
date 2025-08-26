import { useEffect, useMemo, useState } from "react";
import Card from "../components/Card";
import WorkTimer from "../components/WorkTimer";
import TravelPopup from "../components/TravelPopup";
import UserChip from "../components/UserChip";
import { getCurrentUser } from "../lib/users";
import { keys, loadJSON, saveJSON } from "../lib/ns";

const fmtClock = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
};
const isoDate = (d = new Date()) => new Date(d).toISOString().slice(0, 10);

export default function Home() {
  const user = getCurrentUser();              // ← active user
  const K = {
    TRIPS: keys.trips(user.id),
    ACTIVE: keys.activeTrip(user.id),
    DAYLOG: keys.daylog(user.id),
    RECEIPTS: keys.receipts(user.id),
    PROJECT: keys.projectCurrent(user.id),
  };

  const [project, setProject] = useState(() => localStorage.getItem(K.PROJECT) || "Project A");
  const projects = ["Project A", "Project B", "RDM Retrofit"];
  useEffect(() => localStorage.setItem(K.PROJECT, project), [K.PROJECT, project]);

  const [showTravel, setShowTravel] = useState(false);
  const [legsToday, setLegsToday] = useState(() => loadJSON(K.TRIPS, []));
  const [activeLeg, setActiveLeg] = useState(() => loadJSON(K.ACTIVE, null));

  // Re-sync on storage or user change
  useEffect(() => {
    const sync = () => {
      setLegsToday(loadJSON(K.TRIPS, []));
      setActiveLeg(loadJSON(K.ACTIVE, null));
    };
    const onUser = () => { window.location.reload(); };
    window.addEventListener("storage", sync);
    window.addEventListener("rda:userChanged", onUser);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("rda:userChanged", onUser);
    };
  }, [K.TRIPS, K.ACTIVE]);

  useEffect(() => {
    if (!showTravel) {
      setLegsToday(loadJSON(K.TRIPS, []));
      setActiveLeg(loadJSON(K.ACTIVE, null));
    }
  }, [showTravel, K.TRIPS, K.ACTIVE]);

  const openTravel = () => setShowTravel(true);

  // END DAY also bundles receipts for current user + project + today
  const endDay = async () => {
    // 1) Ask WorkTimer for summary (per user internally)
    const summary = await new Promise((resolve) => {
      const onSummary = (e) => {
        window.removeEventListener("rda:summary", onSummary);
        resolve(e.detail || { totalMs: 0, perActivity: {} });
      };
      window.addEventListener("rda:summary", onSummary, { once: true });
      window.dispatchEvent(new CustomEvent("rda:requestSummary"));
    });

    // 2) Pull trips + receipts
    const trips = loadJSON(K.TRIPS, []);
    const allReceipts = loadJSON(K.RECEIPTS, []);
    const today = isoDate();
    const inScope = allReceipts.filter((r) => {
      const rDate = (r.fields?.date && r.fields.date.slice(0, 10)) ||
                    (r.createdAt ? r.createdAt.slice(0, 10) : today);
      const rProject = r.project || project;
      return r.status === "done" && rProject === project && rDate === today;
    });
    const receiptsPayload = inScope.map((r) => ({
      id: r.id,
      merchant: r.fields?.merchant || "",
      total: Number(r.fields?.total || 0),
      date: r.fields?.date || (r.createdAt ? r.createdAt.slice(0, 10) : today),
      project: r.project || project,
      thumb: r.imageDataUrl,
    }));

    // 3) Store daylog entry
    const entry = {
      id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
      date: today,
      user: { id: user.id, name: user.name, email: user.email },
      project,
      totalMs: summary.totalMs || 0,
      perActivity: summary.perActivity || {},
      trips,
      receipts: receiptsPayload,
      createdAt: new Date().toISOString(),
    };
    const log = [entry, ...loadJSON(K.DAYLOG, [])].slice(0, 90);
    saveJSON(K.DAYLOG, log);

    // 4) Cleanup
    const remaining = allReceipts.filter((r) => !inScope.find((x) => x.id === r.id));
    saveJSON(K.RECEIPTS, remaining);
    localStorage.removeItem(K.TRIPS);
    localStorage.removeItem(K.ACTIVE);

    window.dispatchEvent(new CustomEvent("rda:endDay"));
    alert(
      `End of day saved for ${user.name}.\nTotal: ${fmtClock(entry.totalMs)}\nTrips: ${trips.length}\nReceipts: ${receiptsPayload.length}`
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
      <Card title="RDA Mobile • MVP (multi-user)" subtitle={`Logged in: ${user.name}`}>
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center" }}>
          <div className="grid2" style={{ flex: 1 }}>
            <div>
              <label className="lbl">Project</label>
              <select className="select" value={project} onChange={(e) => setProject(e.target.value)}>
                {projects.map((p) => (<option key={p} value={p}>{p}</option>))}
              </select>
            </div>
            <div>
              <label className="lbl">Trips today</label>
              <div className="muted">
                {legsToday.length} {activeLeg ? `• Active: ${activeLegText}` : "• Active: none"}
              </div>
              <div className="btnrow" style={{ marginTop: 6 }}>
                <button className="btn" onClick={openTravel}>Open Travel</button>
              </div>
            </div>
          </div>
          <UserChip />
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
            setLegsToday(loadJSON(K.TRIPS, []));
            setActiveLeg(loadJSON(K.ACTIVE, null));
            setShowTravel(false);
          }}
        />
      )}
    </div>
  );
}
