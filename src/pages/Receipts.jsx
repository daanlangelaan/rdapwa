import { useEffect, useMemo, useRef, useState } from "react";
import Card from "../components/Card";
import CameraPopup from "../components/CameraPopup";
import Tesseract from "tesseract.js";

/** Storage key */
const LS_KEY = "rda.receipts.v1";

/** Helpers */
const uuid = () => crypto.randomUUID();
const fmtDate = (isoOrStr) => {
  try { return new Date(isoOrStr).toLocaleDateString(); } catch { return isoOrStr || ""; }
};

/** Downscale file → dataURL  */
async function downscaleFileToDataURL(file, maxW = 1600) {
  const blobURL = URL.createObjectURL(file);
  const img = new Image();
  img.src = blobURL;
  await new Promise((r) => (img.onload = r));
  const scale = Math.min(1, maxW / img.naturalWidth);
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  cv.getContext("2d").drawImage(img, 0, 0, w, h);
  const dataUrl = cv.toDataURL("image/jpeg", 0.9);
  URL.revokeObjectURL(blobURL);
  return dataUrl;
}

/** Downscale bestaand dataURL (van camera) → kleiner dataURL */
async function downscaleDataURL(dataUrl, maxW = 1600) {
  const img = new Image();
  img.src = dataUrl;
  await new Promise((r) => (img.onload = r));
  const scale = Math.min(1, maxW / img.naturalWidth);
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  cv.getContext("2d").drawImage(img, 0, 0, w, h);
  return cv.toDataURL("image/jpeg", 0.9);
}

/** Parser voor totaal/BTW/datum/verkoper */
function parseReceiptText(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const joined = lines.join(" ").replace(/\s+/g, " ").toUpperCase();

  // TOTAL/TOTAAL/AMOUNT
  const rxes = [/TOTAAL[:\s]*([€]?\s*[\d.,]+)/i, /TOTAL[:\s]*([€]?\s*[\d.,]+)/i, /AMOUNT[:\s]*([€]?\s*[\d.,]+)/i];
  let total = "";
  for (const rx of rxes) {
    const m = text.match(rx);
    if (m?.[1]) { total = m[1].replace(/[€\s]/g, "").replace(",", "."); break; }
  }
  if (!total) {
    const nums = [...text.matchAll(/([€]?\s*[\d]+[.,]\d{2})/g)]
      .map(m => parseFloat(m[1].replace(/[€\s]/g, "").replace(",", ".")))
      .filter(n => !isNaN(n));
    if (nums.length) total = String(Math.max(...nums).toFixed(2));
  }

  let vatPercent = "";
  const v = joined.match(/BTW\s*([0-9]{1,2})\s*%/) || joined.match(/VAT\s*([0-9]{1,2})\s*%/) || joined.match(/TAX\s*([0-9]{1,2})\s*%/);
  if (v?.[1]) vatPercent = v[1];

  let dateStr = "";
  const d =
    text.match(/\b(\d{4})[-/\.](\d{1,2})[-/\.](\d{1,2})\b/) ||
    text.match(/\b(\d{1,2})[-/\.](\d{1,2})[-/\.](\d{2,4})\b/);
  if (d) dateStr = d[0];

  const bad = /(BON|RECEIPT|FACTUUR|TOTAAL|TOTAL|BTW|VAT|AMOUNT|SUBTOTAL|KASSA|PIN|DEBIT|CREDIT)/i;
  let merchant = "";
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const l = lines[i];
    if (!bad.test(l) && /[A-Za-z]/.test(l)) { merchant = l.replace(/[_\-]+/g, " ").trim(); break; }
  }

  return { total, vatPercent, date: dateStr, merchant, rawText: text };
}

/** Record */
function makeReceipt({ id, imageDataUrl }) {
  return {
    id, imageDataUrl,
    status: "new", ocrProgress: 0, text: "",
    fields: { merchant: "", date: "", vatPercent: "", total: "", notes: "" },
    createdAt: new Date().toISOString(),
  };
}

export default function Receipts() {
  const [receipts, setReceipts] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; }
  });
  const [showCam, setShowCam] = useState(false);
  useEffect(() => { localStorage.setItem(LS_KEY, JSON.stringify(receipts)); }, [receipts]);

  const fileRef = useRef(null);
  const canCamera = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

  const ocrFromDataUrl = async (dataUrl) => {
    const id = uuid();
    const rec = makeReceipt({ id, imageDataUrl: dataUrl });
    rec.status = "processing";
    setReceipts(prev => [rec, ...prev]);

    try {
      const { data } = await Tesseract.recognize(dataUrl, "eng+nld", {
        logger: (m) => {
          if (m.status === "recognizing text" && m.progress != null) {
            setReceipts(prev =>
              prev.map(r => r.id === id ? { ...r, ocrProgress: Math.round(m.progress * 100) } : r)
            );
          }
        },
      });
      const parsed = parseReceiptText(data.text || "");
      setReceipts(prev =>
        prev.map(r => r.id === id ? {
          ...r,
          status: "done",
          text: data.text || "",
          fields: {
            merchant: parsed.merchant,
            date: parsed.date,
            vatPercent: parsed.vatPercent,
            total: parsed.total,
            notes: "",
          }
        } : r)
      );
    } catch (err) {
      console.error(err);
      setReceipts(prev => prev.map(r => r.id === id ? { ...r, status: "error" } : r));
    }
  };

  const addFromFile = async (file) => {
    if (!file) return;
    const dataUrl = await downscaleFileToDataURL(file, 1600);
    await ocrFromDataUrl(dataUrl);
  };
  const addFromCamera = async (dataUrl) => {
    const scaled = await downscaleDataURL(dataUrl, 1600);
    await ocrFromDataUrl(scaled);
  };

  const onPick = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) addFromFile(f);
  };

  const updateField = (id, key, val) => {
    setReceipts(prev => prev.map(r => r.id === id ? { ...r, fields: { ...r.fields, [key]: val } } : r));
  };
  const removeReceipt = (id) => {
    if (!confirm("Delete this receipt?")) return;
    setReceipts(prev => prev.filter(r => r.id !== id));
  };

  const totalSum = useMemo(() => {
    const nums = receipts.map(r => parseFloat((r.fields.total || "").replace(",", "."))).filter(n => !isNaN(n));
    return nums.reduce((a, b) => a + b, 0).toFixed(2);
  }, [receipts]);

  return (
    <div className="page">
      <Card title="Scan receipt" subtitle="Maak een foto (camera) of kies een afbeelding – OCR draait automatisch">
        <div className="btnrow">
          {canCamera && (
            <button className="btn primary" onClick={() => setShowCam(true)}>
              🎥 Use camera
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={onPick}
          />
          <button className="btn" onClick={() => fileRef.current?.click()}>
            🖼️ Pick image
          </button>
        </div>
        {!canCamera && (
          <div className="muted">Tip: camera is alleen beschikbaar in een browser met
            <code> getUserMedia</code> (Edge/Chrome/Firefox). Op desktop verschijnt normaal de webcam.
          </div>
        )}
      </Card>

      {showCam && (
        <CameraPopup
          onClose={() => setShowCam(false)}
          onCapture={(dataUrl) => addFromCamera(dataUrl)}
        />
      )}

      <Card title="Receipts" subtitle={`Total (sum): € ${totalSum}`} wide>
        {receipts.length === 0 ? (
          <div className="muted">No receipts yet.</div>
        ) : (
          <div className="receipt-grid">
            {receipts.map((r) => (
              <div key={r.id} className="receipt-card">
                <div className="rc-head">
                  <div className="rc-status">
                    {r.status === "processing" ? (
                      <span className="badge">OCR {r.ocrProgress}%</span>
                    ) : r.status === "error" ? (
                      <span className="badge" style={{ background: "#ef4444", color: "#fff" }}>
                        error
                      </span>
                    ) : (
                      <span className="badge" style={{ background: "#22c55e", color: "#031526" }}>
                        done
                      </span>
                    )}
                  </div>
                  <button className="btn ghost" onClick={() => removeReceipt(r.id)}>
                    Delete
                  </button>
                </div>

                <div className="rc-imgwrap">
                  <img src={r.imageDataUrl} alt="receipt" />
                </div>

                <div className="grid2" style={{ marginTop: 8 }}>
                  <div>
                    <label className="lbl">Merchant</label>
                    <input
                      className="input"
                      value={r.fields.merchant}
                      onChange={(e) => updateField(r.id, "merchant", e.target.value)}
                      placeholder="e.g. Gamma"
                    />
                  </div>
                  <div>
                    <label className="lbl">Date</label>
                    <input
                      className="input"
                      value={r.fields.date}
                      onChange={(e) => updateField(r.id, "date", e.target.value)}
                      placeholder="2025-08-19 of 19-08-2025"
                    />
                  </div>
                </div>

                <div className="grid2">
                  <div>
                    <label className="lbl">VAT %</label>
                    <input
                      className="input"
                      value={r.fields.vatPercent}
                      onChange={(e) => updateField(r.id, "vatPercent", e.target.value)}
                      placeholder="21 / 9 / 0"
                    />
                  </div>
                  <div>
                    <label className="lbl">Total (€)</label>
                    <input
                      className="input"
                      value={r.fields.total}
                      onChange={(e) => updateField(r.id, "total", e.target.value)}
                      placeholder="124,95"
                    />
                  </div>
                </div>

                <div>
                  <label className="lbl">Notes</label>
                  <textarea
                    className="input"
                    rows={3}
                    value={r.fields.notes}
                    onChange={(e) => updateField(r.id, "notes", e.target.value)}
                    placeholder="Optional note (supplier, project, PO, etc.)"
                  />
                </div>

                <details style={{ marginTop: 8 }}>
                  <summary className="muted">Show recognized text</summary>
                  <pre className="rc-raw">{r.text || "(none)"}</pre>
                </details>

                <div className="muted" style={{ marginTop: 6 }}>
                  Saved: {fmtDate(r.createdAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
