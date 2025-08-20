import { useState } from "react";
import Card from "../components/Card.jsx";

export default function Receipts(){
  const [ocr,setOcr]=useState("TOTAL 124,95\nBTW 21%\n2025-08-18\nGamma");
  const parse=()=>{
    const amount=(ocr.match(/(\d+[.,]\d{2})/g)||[]).pop()?.replace(",",".")||"0.00";
    const date=(ocr.match(/\d{4}-\d{2}-\d{2}|\d{2}[/-]\d{2}[/-]\d{4}/)||[])[0]||new Date().toISOString().slice(0,10);
    const vat=(ocr.match(/(21|9)\s?%/)||[null,"21"])[1];
    alert(`Parsed → €${amount} • VAT ${vat}% • ${date}`);
  };
  return (
    <div className="page">
      <Card title="Scan Receipt" subtitle="On-device OCR in MVP mocked" wide>
        <p className="muted">Paste recognized text here (simulating on-device OCR). Click Parse.</p>
        <textarea className="area" rows={8} value={ocr} onChange={e=>setOcr(e.target.value)}/>
        <div className="btnrow"><button className="btn primary" onClick={parse}>Parse</button></div>
      </Card>
    </div>
  );
}
