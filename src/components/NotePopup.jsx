import { useEffect, useRef, useState } from "react";
import Card from "./Card";

/**
 * Note popup met optionele force (bij GPS-arrive).
 * Web Speech API voor spraak (Chrome/Edge). iOS Safari ondersteunt dit zelden.
 */
export default function NotePopup({ activity, defaultTitle = "", force = false, onSave, onCancel }) {
  const [title, setTitle] = useState(defaultTitle);
  const [minutes, setMinutes] = useState("");
  const [billable, setBillable] = useState(true);
  const [wbso, setWbso] = useState(false); // enkel relevant voor Research

  // Speech state
  const [canSpeech, setCanSpeech] = useState(false);
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const recRef = useRef(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setCanSpeech(!!SR);
  }, []);

  useEffect(() => {
    return () => {
      try {
        if (recRef.current) {
          recRef.current.onresult = null;
          recRef.current.onerror = null;
          recRef.current.onend = null;
          recRef.current.stop();
        }
      } catch {}
      recRef.current = null;
    };
  }, []);

  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setErrorMsg("Spraakherkenning wordt niet ondersteund in deze browser.");
      return;
    }
    setErrorMsg("");

    const rec = new SR();
    rec.lang = "nl-NL";
    rec.interimResults = true;
    rec.continuous = true;

    rec.onresult = (e) => {
      let interim = "";
      let finalChunk = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalChunk += chunk + " ";
        else interim += chunk + " ";
      }
      if (finalChunk) {
        setTitle(prev => (prev ? prev + " " : "") + finalChunk.trim());
        setInterimText("");
      } else {
        setInterimText(interim.trim());
      }
    };

    rec.onerror = (e) => {
      setErrorMsg(e?.error ? `Spraakfout: ${e.error}` : "Onbekende spraakfout.");
      setListening(false);
      try { rec.stop(); } catch {}
      recRef.current = null;
      setInterimText("");
    };

    rec.onend = () => {
      setListening(false);
      recRef.current = null;
      setInterimText("");
    };

    try {
      rec.start();
      recRef.current = rec;
      setListening(true);
      setInterimText("");
    } catch (err) {
      setErrorMsg("Kon spraak niet starten. Is deze site HTTPS en heb je microfoon-toegang gegeven?");
    }
  };

  const stopListening = () => {
    try { recRef.current?.stop(); } catch {}
    recRef.current = null;
    setListening(false);
    setInterimText("");
  };

  const save = () => {
    const m = Math.max(0, Math.round(Number(minutes || 0)));
    if (!m) return alert("Vul minuten in.");
    if (force && !title.trim()) return alert("Voeg een korte notitie/titel toe.");

    if (listening) stopListening();

    onSave({
      activity,
      title: title.trim() || activity,
      minutes: m,
      billable,
      wbso: activity === "Research" ? wbso : false,
      startAt: new Date(Date.now() - m * 60000).toISOString(),
      endAt: new Date().toISOString(),
    });
  };

  return (
    <div className="popup-mask">
      <div className="popup-panel">
        <Card title={`${activity} note`} subtitle="Add a split item with timestamps" wide>
          <div className="grid2">
            <div>
              <label className="lbl">Title</label>
              <input
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Onsite support"
              />
              {interimText && <div className="muted" style={{ marginTop: 4 }}>🎙️ {interimText}</div>}
            </div>
            <div>
              <label className="lbl">Minutes</label>
              <input
                className="input"
                type="number"
                min="0"
                step="1"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
              />
            </div>
          </div>

          <div className="btnrow" style={{ marginTop: 6 }}>
            <label className="lbl" style={{ margin: 0 }}>
              <input
                type="checkbox"
                checked={billable}
                onChange={(e) => setBillable(e.target.checked)}
              />{" "}
              Billable
            </label>
            {activity === "Research" && (
              <label className="lbl" style={{ margin: 0 }}>
                <input
                  type="checkbox"
                  checked={wbso}
                  onChange={(e) => setWbso(e.target.checked)}
                />{" "}
                WBSO
              </label>
            )}
          </div>

          <div className="btnrow" style={{ marginTop: 6 }}>
            <button
              className="btn"
              onClick={listening ? stopListening : startListening}
              disabled={!canSpeech}
              title={!canSpeech ? "Niet ondersteund in deze browser" : ""}
            >
              {listening ? "⏹️ Stop mic" : "🎤 Speak"}
            </button>
            {!canSpeech && <div className="muted">Spraak werkt in Chrome/Edge (niet in iOS Safari).</div>}
          </div>
          {errorMsg && <div className="muted" style={{ color: "#f88" }}>{errorMsg}</div>}

          <div className="btnrow" style={{ marginTop: 6 }}>
            <button className="btn primary" onClick={save}>Save</button>
            <button
              className="btn ghost"
              onClick={() => { if (listening) stopListening(); onCancel(); }}
            >
              Cancel
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
