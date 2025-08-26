import { useEffect, useMemo, useState } from "react";
import Card from "../components/Card";
import CameraPopup from "../components/CameraPopup";
import { getCurrentUser } from "../lib/users";
import { keys, loadJSON, saveJSON } from "../lib/ns";

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

export default function Receipts() {
  const user = getCurrentUser();
  const K = {
    RECEIPTS: keys.receipts(user.id),
    PROJECT: keys.projectCurrent(user.id),
  };

  const [project, setProject] = useState(() => localStorage.getItem(K.PROJECT) || "Project A");
  const projects = ["Project A", "Project B", "RDM Retrofit"];
  useEffect(() => localStorage.setItem(K.PROJECT, project), [K.PROJECT, project]);

  const [receipts, setReceipts] = useState(() => loadJSON(K.RECEIPTS, []));
  useEffect(() => saveJSON(K.RECEIPTS, receipts), [K.RECEIPTS, receipts]);

  // filter
  const [filterProject, setFilterProject] = useState("All");
  const visible = useMemo(() => filterProject === "All" ? receipts : receipts.filter(r => (r.project || project) === filterProject), [receipts, filterProject, project]);
  const totalSum = useMemo(() => visible.reduce((acc, r) => acc + (Number(r.fields?.total || 0) || 0), 0), [visible]);

  useEffect(() => {
    const onUser = () => window.location.reload();
    window.addEventListener("rda:userChanged", onUser);
    return () => window.removeEventListener("rda:userChanged", onUser);
  }, []);

  const addFromImage = async (dataUrl) => {
    const base = {
      id: uid(),
      imageDataUrl: dataUrl,
      status: "done",
      ocrProgress: 100,
      text: "",
      fields: { merchant: "", date: "", vatPercent: "21/9/0", total: "" },
      notes: "",
      project,
      createdAt: new Date().toISOString(),
    };
    setReceipts(prev => [base, ...prev]);
  };

  const onPickImage = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = () => addFromImage(reader.result.toString());
    reader.readAsDataURL(f);
    e.target.value = "";
  };

  const updateRec = (id, patch) => setReceipts(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  const removeRec = (id) => setReceipts(prev => prev.filter(r => r.id !== id));

  return (
    <div className="page">
      <Card title="Scan receipt" subtitle="Maak een foto (camera) of kies een afbeelding — OCR draait automatisch" wide>
        <div className="grid2">
          <div>
            <button className="btn" onClick={() => document.getElementById("capCamBtn")?.click()}>📷 Use camera</button>
            <label className="btn" style={{ marginLeft: 6 }}>
              📁 Pick image
              <input type="file" accept="image/*" onChange={onPickImage} style={{ display: "none" }} />
            </label>
          </div>
          <div style={{ textAlign: "right" }}>
            <label className="lbl">Default project for new receipts</label>
            <div className="grid2">
              <select className="select" value={project} onChange={(e) => setProject(e.target.value)}>
                {projects.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select className="select" value={filterProject} onChange={(e) => setFilterProject(e.target.value)}>
                <option value="All">All</option>
                {projects.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Receipts" subtitle={`Total (sum): € ${totalSum.toFixed(2)}`} wide>
        {visible.length === 0 ? <div className="muted">No receipts.</div> : (
          <div className="cards-grid">
            {visible.map(r => (
              <div className="card" key={r.id}>
                <button className="btn ghost small" style={{ float: "right" }} onClick={() => removeRec(r.id)}>Delete</button>
                <div className="thumb">{r.imageDataUrl ? <img src={r.imageDataUrl} alt="receipt" /> : <div className="muted">no image</div>}</div>

                <div className="grid2">
                  <div>
                    <label className="lbl">Merchant</label>
                    <input className="input" value={r.fields?.merchant || ""} onChange={e => updateRec(r.id, { fields: { ...r.fields, merchant: e.target.value } })} />
                  </div>
                  <div>
                    <label className="lbl">Date</label>
                    <input className="input" value={r.fields?.date || ""} onChange={e => updateRec(r.id, { fields: { ...r.fields, date: e.target.value } })} placeholder="YYYY-MM-DD" />
                  </div>
                </div>

                <div className="grid2">
                  <div>
                    <label className="lbl">VAT %</label>
                    <input className="input" value={r.fields?.vatPercent || "21/9/0"} onChange={e => updateRec(r.id, { fields: { ...r.fields, vatPercent: e.target.value } })} />
                  </div>
                  <div>
                    <label className="lbl">Total (€)</label>
                    <input className="input" value={r.fields?.total || ""} onChange={e => updateRec(r.id, { fields: { ...r.fields, total: e.target.value } })} />
                  </div>
                </div>

                <div className="grid2">
                  <div>
                    <label className="lbl">Project</label>
                    <select className="select" value={r.project || project} onChange={e => updateRec(r.id, { project: e.target.value })}>
                      {projects.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="lbl">Notes</label>
                    <input className="input" value={r.notes || ""} onChange={e => updateRec(r.id, { notes: e.target.value })} placeholder="Optional note (supplier, project, PO, etc.)" />
                  </div>
                </div>

                <div className="muted" style={{ marginTop: 6 }}>
                  Saved: {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "-"}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Hidden trigger for camera popup (we keep your camera component) */}
      <button id="capCamBtn" style={{ display: "none" }} onClick={() => setShowCam(true)} />
    </div>
  );
}
