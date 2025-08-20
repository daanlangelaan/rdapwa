import { useEffect, useRef, useState } from "react";
import Card from "../components/Card.jsx";

/* helpers */
const fmt = (ms)=>{
  const s=Math.floor(ms/1000);
  const h=String(Math.floor(s/3600)).padStart(2,"0");
  const m=String(Math.floor((s%3600)/60)).padStart(2,"0");
  const ss=String(s%60).padStart(2,"0");
  return `${h}:${m}:${ss}`;
};
const haversineKm=(a,b)=>{
  const R=6371, dLat=(b.lat-a.lat)*Math.PI/180, dLon=(b.lon-a.lon)*Math.PI/180;
  const la1=a.lat*Math.PI/180, la2=b.lat*Math.PI/180;
  const h=Math.sin(dLat/2)**2 + Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(h))*1.25;
};
const ADDR={
  "Werkplaats":{lat:51.924,lon:4.479},
  "Kantoor":{lat:51.915,lon:4.485},
  "Werkplaats 2":{lat:51.93,lon:4.50},
  "Client (project)":{lat:51.89,lon:4.43},
};

export default function Home(){
  const [project,setProject]=useState("Project A");
  const projects=["Project A","Project B","RDM Retrofit"];

  const [startChoice,setStart]=useState("Werkplaats");
  const [endChoice,setEnd]=useState("Client (project)");
  const [active,setActive]=useState(null);
  const [legs,setLegs]=useState([]);

  const [work,setWork]=useState({running:false,paused:false,activity:"Engineering",wbso:false,note:"",elapsedMs:0});
  const raf=useRef();

  useEffect(()=>{
    if(work.running && !work.paused){
      const base=work.elapsedMs, t0=performance.now();
      const loop=()=>{ setWork(w=>({...w,elapsedMs:base+(performance.now()-t0)})); raf.current=requestAnimationFrame(loop); };
      raf.current=requestAnimationFrame(loop);
      return ()=> cancelAnimationFrame(raf.current);
    }
  },[work.running,work.paused]);

  const resolve=async(choice)=>{
    if(choice==="GPS (current)"){
      return new Promise(res=>navigator.geolocation
        ? navigator.geolocation.getCurrentPosition(p=>res({lat:p.coords.latitude,lon:p.coords.longitude}),()=>res({lat:51.92,lon:4.47}))
        : res({lat:51.92,lon:4.47}));
    }
    return ADDR[choice] ?? ADDR["Werkplaats"];
  };

  const startTrip=async()=>{
    const s=await resolve(startChoice);
    setActive({id:crypto.randomUUID(),start:s,stop:1,date:new Date().toISOString().slice(0,10)});
  };

  const arrive=async()=>{
    if(!active){ alert("No active trip"); return; }
    const e=await resolve(endChoice);
    const km=haversineKm(active.start,e);
    setLegs(prev=>[...prev,{...active,end:e,km,project}]);
    setActive({id:crypto.randomUUID(),start:e,stop:active.stop+1,date:new Date().toISOString().slice(0,10)});
    if(!work.running && confirm("Next trip leg started.\n\nStart work at this stop?")){
      setWork(w=>({...w,running:true,paused:false,elapsedMs:0}));
    }
  };

  const endDay=()=>{ setActive(null); alert(`Day closed. Saved ${legs.length} legs.`); };

  const startWork=()=> setWork(w=>({...w,running:true,paused:false,elapsedMs:0}));
  const pauseWork=()=> setWork(w=>({...w,paused:true}));
  const resumeWork=()=> setWork(w=>({...w,paused:false}));
  const stopWork=()=>{ const t=work.elapsedMs; setWork(w=>({...w,running:false,paused:false})); alert(`Work logged: ${fmt(t)}`); };

  return (
    <div className="page">
      {/* Quick project picker (sticky) */}
      <div className="quickbar">
        <label className="lbl">Project</label>
        <select value={project} onChange={e=>setProject(e.target.value)} className="select">
          {projects.map(p=><option key={p}>{p}</option>)}
        </select>
      </div>

      <Card title="Trips" subtitle="Start • Arrive • End Day" wide>
        <div className="grid2">
          <div>
            <label className="lbl">Start point</label>
            <select className="select" value={startChoice} onChange={e=>setStart(e.target.value)}>
              {Object.keys(ADDR).map(k=><option key={k}>{k}</option>)}
              <option>GPS (current)</option>
            </select>
          </div>
          <div>
            <label className="lbl">End point</label>
            <select className="select" value={endChoice} onChange={e=>setEnd(e.target.value)}>
              {Object.keys(ADDR).map(k=><option key={k}>{k}</option>)}
              <option>GPS (current)</option>
            </select>
          </div>
        </div>

        <div className="btnrow">
          <button className="btn primary" onClick={startTrip}>Start Trip</button>
          <button className="btn" onClick={arrive}>Arrive</button>
          <button className="btn ghost" onClick={endDay}>End Day</button>
        </div>

        <div className="hint">Active leg: {active ? `Stop #${active.stop} (${active.start.lat.toFixed(4)}, ${active.start.lon.toFixed(4)})` : "none"}</div>

        <div className="leglist">
          {legs.map((l,i)=>(
            <div key={l.id} className="legcard">
              <div>
                <div className="title">Leg {i+1} • {l.project}</div>
                <div className="muted">{l.date} • {l.km?.toFixed(1)} km (fastest)</div>
              </div>
              <div className="badge">#{l.stop}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Work timer" subtitle="Activity • WBSO • Notes">
        <div className="grid2">
          <div>
            <label className="lbl">Activity</label>
            <select className="select" value={work.activity} onChange={e=>setWork(w=>({...w,activity:e.target.value}))}>
              {["Engineering","Assembly","Travel","Meeting","Admin"].map(a=><option key={a}>{a}</option>)}
            </select>
          </div>
          <div className="switch">
            <label className="lbl">WBSO</label>
            <input type="checkbox" checked={work.wbso} onChange={e=>setWork(w=>({...w, wbso:e.target.checked}))}/>
          </div>
        </div>

        <label className="lbl">Note</label>
        <textarea className="area" rows={3} placeholder="Optional note"
          value={work.note} onChange={e=>setWork(w=>({...w, note:e.target.value}))}/>

        <div className="timer">{fmt(work.elapsedMs)}</div>
        <div className="btnrow">
          {!work.running && <button className="btn primary" onClick={startWork}>Start</button>}
          {work.running && !work.paused && <button className="btn" onClick={pauseWork}>Pause</button>}
          {work.running && work.paused && <button className="btn" onClick={resumeWork}>Resume</button>}
          {work.running && <button className="btn ghost" onClick={stopWork}>Stop</button>}
        </div>
      </Card>
    </div>
  );
}
