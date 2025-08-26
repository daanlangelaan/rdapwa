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

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === DAYLOG_KEY) {
        try { setLog(JSON.parse(e.newValue || "[]")); } catch {}
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <div className="page">
      <Card title="Day log" subtitle="Gesloten dagen met activiteiten, trips en receipts" wide>
        {log.length === 0 ? (
          <div className="muted">Nog geen daglogs opgeslagen.</div>
        ) : (
          log.map((entry) => {
            const perActivity = entry.perActivity || {};
            const nonEmptyActivities = Object.entries(perActivity).filter(
              ([, data]) => (data?.ms || 0) > 0 || (data?.items?.length || 0) > 0
            );
            const hasTrips = (entry.trips || []).length > 0;
            const receipts = entry.receipts || [];
            const sumReceipts = receipts.reduce((a, r) => a + (Number(r.total) || 0), 0);

            return (
              <div key={entry.id} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div className="title">{entry.date} • {entry.project}</div>
                  <span className="badge">Total {fmtClock(entry.totalMs || 0)}</span>
                  {receipts.length > 0 && (
                    <span className="badge">Receipts € {sumReceipts.toFixed(2)}</span>
                  )}
                </div>

                {nonEmptyActivities.map(([name, data]) => (
                  <div key={name} style={{ marginLeft: 6, marginBottom: 6 }}>
                    <div style={{ fontWeight: 600 }}>
                      {name} — {fmtClock(data?.ms || 0)}
                    </div>
                    {(data?.items?.length || 0) > 0 && (
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

                {hasTrips && (
                  <div style={{ marginTop: 8, marginLeft: 6 }}>
                    <div style={{ fontWeight: 600 }}>Trips</div>
                    <ul style={{ marginTop: 2, marginBottom: 0 }}>
                      {entry.trips.map((leg, idx) => (
                        <li key={leg.id || idx}>
                          <strong>Leg {idx + 1}</strong> • {leg.date || ""} •{" "}
                          {Number.isFinite(leg.km) ? leg.km.toFixed(1) : leg.km} km
                          {leg.startName ? ` • ${leg.startName}` : ""}{" "}
                          {leg.endName ? `→ ${leg.endName}` : ""}
                          {leg.note ? ` • ${leg.note}` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {receipts.length > 0 && (
                  <div style={{ marginTop: 10, marginLeft: 6 }}>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>
                      Receipts — € {sumReceipts.toFixed(2)}
                    </div>
                    <div className="thumbs-row">
                      {receipts.map((r) => (
                        <div key={r.id} className="thumb-mini" title={`${r.merchant || ""} — € ${Number(r.total || 0).toFixed(2)}`}>
                          {r.thumb ? <img src={r.thumb} alt="receipt" /> : <div className="muted">no image</div>}
                          <div className="muted ellipsis">
                            {r.merchant || "—"} • € {Number(r.total || 0).toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <hr style={{ borderColor: "rgba(148,163,184,.18)", marginTop: 10 }} />
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}
