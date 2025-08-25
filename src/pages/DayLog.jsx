import { useEffect, useState } from "react";
import Card from "../components/Card";

const DAYLOG_KEY = "rda.daylog.v1";

const fmtClock = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
};

export default function DayLog() {
  const [log, setLog] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(DAYLOG_KEY) || "[]");
    } catch {
      return [];
    }
  });

  // herlaad wanneer storage elders wijzigt (end day)
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === DAYLOG_KEY) {
        try {
          setLog(JSON.parse(e.newValue || "[]"));
        } catch {}
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <div className="page">
      <Card title="Day log" subtitle="Gesloten dagen met activiteiten en trips" wide>
        {log.length === 0 ? (
          <div className="muted">Nog geen daglogs opgeslagen.</div>
        ) : (
          log.map((entry) => (
            <div key={entry.id} style={{ marginBottom: 12 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                <div className="title">
                  {entry.date} • {entry.project}
                </div>
                <span className="badge">Total {fmtClock(entry.totalMs || 0)}</span>
              </div>

              {/* activities */}
              {Object.entries(entry.perActivity || {}).map(([name, data]) => (
                <div key={name} style={{ marginLeft: 6, marginBottom: 6 }}>
                  <div style={{ fontWeight: 600 }}>
                    {name} — {fmtClock(data?.ms || 0)}
                  </div>
                  {(data?.items?.length || 0) === 0 ? (
                    <div className="muted" style={{ marginLeft: 12 }}>
                      No items
                    </div>
                  ) : (
                    <ul style={{ marginTop: 2, marginBottom: 0 }}>
                      {data.items.map((it) => (
                        <li key={it.id}>
                          {it.title || "(no title)"} — {it.minutes} min{" "}
                          {it.billable ? "• billable" : "• non-billable"}
                          {it.wbso ? " • WBSO" : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}

              {/* trips */}
              <div style={{ marginTop: 8, marginLeft: 6 }}>
                <div style={{ fontWeight: 600 }}>Trips</div>
                {(entry.trips || []).length === 0 ? (
                  <div className="muted" style={{ marginLeft: 12 }}>
                    No trips
                  </div>
                ) : (
                  <ul style={{ marginTop: 2, marginBottom: 0 }}>
                    {entry.trips.map((leg, idx) => (
                      <li key={leg.id || idx}>
                        Leg {idx + 1} • {leg.date || ""} • {leg.km?.toFixed ? leg.km.toFixed(1) : leg.km} km
                        {leg.startName ? ` • ${leg.startName}` : ""}{" "}
                        {leg.endName ? `→ ${leg.endName}` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <hr style={{ borderColor: "rgba(148,163,184,.18)", marginTop: 10 }} />
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
