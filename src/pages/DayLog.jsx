import Card from "../components/Card";

const LOG_KEY = "rda.daylog.v2";
const fmt = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
};
const load = (k, fb) => { try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(fb)); } catch { return fb; } };

export default function DayLog(){
  const items = load(LOG_KEY, []);
  return (
    <div className="page">
      <Card title="Day log" subtitle="Closed days (local only)" wide>
        {items.length===0 ? (
          <div className="muted">No closed days yet.</div>
        ) : (
          <div className="leglist">
            {items.map(entry=>(
              <div key={entry.id} className="legcard" style={{flexDirection:"column", alignItems:"stretch"}}>
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
                  <div className="title">{entry.date} • {entry.project}</div>
                  <div className="badge">Total {fmt(entry.summary.totalMs)}</div>
                </div>

                <div style={{marginTop:8}}>
                  {Object.entries(entry.summary.perActivity||{}).map(([name, val])=>(
                    <div key={name} style={{marginBottom:8}}>
                      <div style={{fontWeight:600}}>{name} — {fmt(val.ms||0)}</div>
                      {(val.items && val.items.length>0) ? (
                        <ul style={{margin:0, paddingLeft:18}}>
                          {val.items.map(it=>(
                            <li key={it.id}>
                              {it.title} — {it.minutes} min • {it.wbso ? "WBSO" : "non-WBSO"} • {it.billable ? "billable" : "non-billable"} • {new Date(it.startAt).toLocaleTimeString()}–{new Date(it.endAt).toLocaleTimeString()}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="muted">No items</div>
                      )}
                    </div>
                  ))}
                </div>

                <div style={{marginTop:8, fontWeight:600}}>Trips</div>
                {entry.legs.length===0 ? (
                  <div className="muted">No trips</div>
                ) : (
                  <ul style={{margin:0, paddingLeft:18}}>
                    {entry.legs.map((l, i)=>(
                      <li key={l.id}>
                        Leg {i+1} • {l.date} • {l.km?.toFixed(1)} km
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
