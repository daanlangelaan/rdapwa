import Card from "../components/Card.jsx";
import { useState } from "react";

export default function Settings(){
  const [rateHour,setRateHour]=useState(95);
  const [rateKm,setRateKm]=useState(0.23);
  const [addr,setAddr]=useState({
    werkplaats:"…",
    kantoor:"…",
    werkplaats2:"…",
  });

  return (
    <div className="page">
      <Card title="Rates" subtitle="Defaults per project">
        <div className="grid2">
          <div>
            <label className="lbl">Rate/hour</label>
            <input className="input" type="number" step="0.01" value={rateHour} onChange={e=>setRateHour(+e.target.value)} />
          </div>
          <div>
            <label className="lbl">Rate/km</label>
            <input className="input" type="number" step="0.01" value={rateKm} onChange={e=>setRateKm(+e.target.value)} />
          </div>
        </div>
      </Card>

      <Card title="Addresses" subtitle="Used in location dropdowns" wide>
        <label className="lbl">Werkplaats</label>
        <input className="input" value={addr.werkplaats} onChange={e=>setAddr({...addr,werkplaats:e.target.value})}/>
        <label className="lbl">Kantoor</label>
        <input className="input" value={addr.kantoor} onChange={e=>setAddr({...addr,kantoor:e.target.value})}/>
        <label className="lbl">Werkplaats 2</label>
        <input className="input" value={addr.werkplaats2} onChange={e=>setAddr({...addr,werkplaats2:e.target.value})}/>
      </Card>
    </div>
  );
}
