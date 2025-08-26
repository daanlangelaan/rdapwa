import { useEffect, useMemo, useState } from "react";
import Card from "../components/Card";
import CameraPopup from "../components/CameraPopup";

const RECEIPTS_KEY = "rda.receipts.v1";
const CURRENT_PROJECT_KEY = "rda.project.current";

const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

const loadJSON = (k, fb) => {
  try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(fb)); }
  catch { return fb; }
};
const saveJSON = (k, v) => localStorage.setItem(k, JSON.stringify(v));

export default function Receipts() {
  const [receipts, setReceipts] = useState(() => loadJSON(RECEIPTS_KEY, []));
  const [showCam, setShowCam] = useState(false);

  // Projectfilter & default project (van Home)
  const [project, setProject] = useState(() => localStorage.getItem(CURRENT_PROJECT_KEY) || "Project A");
  const projects = ["Project A", "Project B", "RDM Retrofit"];

  useEffect(() => saveJSON(RECEIPTS_KEY, receipts), [receipts]);
  useEffect(() => localStorage.setItem(CURRENT_PROJECT_KEY, project), [project]);

  // Zichtbare bonnen (optioneel filter op project via dropdown rechts)
  const [filterProject, setFilterProject] = useState("All");
  const visible = useMemo(() => {
    return filterProject === "All" ? receipts : receipts.filter(r => (r.project || project) === filterProject);
  }, [receipts, filterProject, project]);

  const totalSum = useMemo(
    () =>
      visible.reduce((acc, r) => acc + (Number(r.fields?.total || 0) || 0), 0),
    [visible]
  );

  // OCR mock/parser – laat je bestaande OCR hier gewoon aanroepen; wij vullen alvast basisvelden
  const runOCR = async (rec) => {
    // TODO: vervang door Tesseract-run; dit is fallback:
    const parsed = { merchant: rec.fields?.merchant || "", date: rec.fields?.date || "", vatPercent: rec.fields?.vatPercent || "21/9/0", total: rec.fields?.total || "" };
    return parsed;
  };

  const addFromImage = async (dataUrl) => {
    const base = {
      id: uid(),
      imageDataUrl: dataUrl,
      status: "processing",
      ocrProgress: 0,
      text: "",
      fields: { merchant: "", date: "", vatPercent: "21/9/0", total: "" },
      notes: "",
      project, // ✅ koppel aan huidig project
      createdAt: new Date().toISOString(),
    };
    setReceipts((prev) => [base, ...prev]);

    // OCR simulatie/placeholder → markeer done
    try {
      const fields = await runOCR(base);
      setReceipts((prev) =>
        prev.map((r) =>
          r.id === base.id
            ? { ...r, status: "done", ocrProgress: 100, fields }
            : r
        )
      );
    } catch {
      setReceipts((prev) =>
        prev.map((r) =>
          r.id === base.id ? { ...r, status: "error", ocrProgress: 100 } : r
        )
      );
    }
  };

  const onPickImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => addFromImage(reader.result.toString());
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const updateRec = (id, patch) =>
    setReceipts((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const removeRec = (id) =>
    setReceipts((prev) => prev.filter((r) => r.id !== id));

  return (
    <div className="page">
      <Card
        title="Scan receipt"
        subtitle="Maak een foto (camera) of kies een afbeelding — OCR draait automatisch"
        wide
      >
        <div className="grid2">
          <div>
            <button className="btn" onClick={() => setShowCam(true)}>📷 Use camera</button>
            <label className="btn" style={{ marginLeft: 6 }}>
              📁 Pick image
              <input type="file" accept="image/*" onChange={onPickImage} style={{ display: "none" }} />
            </label>
          </div>
          <div style={{ textAlign: "right" }}>
            <label className="lbl">Default project for new receipts</label>
            <div className="grid2">
              <select className="select" value={project} onChange={(e) => setProject(e.target.value)}>
                {projects.map((p) => (<option key={p} value={p}>{p}</option>))}
              </select>

              <select className="select" value={filterProject} onChange={(e) => setFilterProject(e.target.value)}>
                <option value="All">All</option>
                {projects.map((p) => (<option key={p} value={p}>{p}</option>))}
              </select>
            </div>
          </div>
        </div>
      </Card>

      <Card
        title="Receipts"
        subtitle={`Total (sum): € ${totalSum.toFixed(2)}`}
        wide
      >
        {visible.length === 0 ? (
          <div className="muted">No receipts.</div>
        ) : (
          <div className="cards-grid">
            {visible.map((r) => (
              <div className="card" key={r.id}>
                <div className="chip">{r.status === "done" ? "done" : r.status}</div>
                <button className="btn ghost small" style={{ float: "right" }} onClick={() => removeRec(r.id)}>
                  Delete
                </button>

                <div className="thumb">
                  {r.imageDataUrl ? (
                    <img src={r.imageDataUrl} alt="receipt" />
                  ) : (
                    <div className="muted">no image</div>
                  )}
                </div>

                <div className="grid2">
                  <div>
                    <label className="lbl">Merchant</label>
                    <input
                      className="input"
                      value={r.fields?.merchant || ""}
                      onChange={(e) => updateRec(r.id, { fields: { ...r.fields, merchant: e.target.value } })}
                      placeholder="e.g. Gamma"
                    />
                  </div>
                  <div>
                    <label className="lbl">Date</label>
                    <input
                      className="input"
                      value={r.fields?.date || ""}
                      onChange={(e) => updateRec(r.id, { fields: { ...r.fields, date: e.target.value } })}
                      placeholder="YYYY-MM-DD"
                    />
                  </div>
                </div>

                <div className="grid2">
                  <div>
                    <label className="lbl">VAT %</label>
                    <input
                      className="input"
                      value={r.fields?.vatPercent || "21/9/0"}
                      onChange={(e) => updateRec(r.id, { fields: { ...r.fields, vatPercent: e.target.value } })}
                    />
                  </div>
                  <div>
                    <label className="lbl">Total (€)</label>
                    <input
                      className="input"
                      value={r.fields?.total || ""}
                      onChange={(e) => updateRec(r.id, { fields: { ...r.fields, total: e.target.value } })}
                      placeholder="124,95"
                    />
                  </div>
                </div>

                <div className="grid2">
                  <div>
                    <label className="lbl">Project</label>
                    <select
                      className="select"
                      value={r.project || project}
                      onChange={(e) => updateRec(r.id, { project: e.target.value })}
                    >
                      {projects.map((p) => (<option key={p} value={p}>{p}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="lbl">Notes</label>
                    <input
                      className="input"
                      value={r.notes || ""}
                      onChange={(e) => updateRec(r.id, { notes: e.target.value })}
                      placeholder="Optional note (supplier, project, PO, etc.)"
                    />
                  </div>
                </div>

                {r.text && (
                  <details style={{ marginTop: 8 }}>
                    <summary>Show recognized text</summary>
                    <pre className="muted" style={{ whiteSpace: "pre-wrap" }}>{r.text}</pre>
                  </details>
                )}

                <div className="muted" style={{ marginTop: 6 }}>
                  Saved: {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "-"}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {showCam && (
        <CameraPopup
          onClose={() => setShowCam(false)}
          onCapture={(dataUrl) => {
            setShowCam(false);
            addFromImage(dataUrl);
          }}
        />
      )}
    </div>
  );
}
