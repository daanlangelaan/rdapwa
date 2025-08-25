import { useEffect, useRef, useState } from "react";
import Card from "./Card";

export default function CameraPopup({ onClose, onCapture }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [stream, setStream] = useState(null);
  const [devices, setDevices] = useState([]);
  const [deviceId, setDeviceId] = useState(null);
  const [error, setError] = useState("");
  const [snapDataUrl, setSnapDataUrl] = useState("");
  const [askedOnce, setAskedOnce] = useState(false);

  // Enumerate devices (kan zonder permissie, maar labels zijn dan vaak leeg)
  const enumerateDevices = async () => {
    try {
      const devs = await navigator.mediaDevices.enumerateDevices();
      const cams = devs.filter((d) => d.kind === "videoinput");
      setDevices(cams);
      const env = cams.find((d) => /back|rear|environment/i.test(d.label));
      setDeviceId((env || cams[0] || {}).deviceId || null);
    } catch (e) {
      setError("Kon camera-apparaten niet ophalen.");
    }
  };

  useEffect(() => {
    enumerateDevices();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!deviceId) return;
    if (stream) stopCamera();
    // probeer meteen te starten; als permissie geblokt is, tonen we een knop hieronder
    startCamera(deviceId).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  const startCamera = async (id) => {
    setError("");
    const constraints = id
      ? { video: { deviceId: { exact: id } }, audio: false }
      : { video: { facingMode: { ideal: "environment" } }, audio: false };

    const st = await navigator.mediaDevices.getUserMedia(constraints);
    setStream(st);

    const v = videoRef.current;
    if (v) {
      v.srcObject = st;
      // Autoplay werkt alleen na user-gesture in sommige browsers,
      // maar we hebben sowieso een klik op "Take photo".
      try { await v.play(); } catch {}
    }
  };

  const stopCamera = () => {
    try { stream?.getTracks()?.forEach((t) => t.stop()); } catch {}
    setStream(null);
  };

  // Dwing expliciet permissie prompt af
  const requestPermission = async () => {
    setError("");
    setAskedOnce(true);
    try {
      await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      await enumerateDevices();
      await startCamera(deviceId); // start met huidig gekozen device
    } catch (e) {
      setError(
        "Camera-toegang is geblokkeerd. Sta 'Camera' toe voor deze site (klik op het slotje links van de URL) of controleer Windows privacy-instellingen."
      );
    }
  };

  const takePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setSnapDataUrl(dataUrl);
  };

  const usePhoto = () => {
    if (!snapDataUrl) return;
    stopCamera();
    onCapture(snapDataUrl);
    onClose();
  };

  const noStream = !stream;

  return (
    <div className="popup-mask full-opaque">
      <div className="popup-panel fullscreen-minus-bottom">
        <Card title="Camera" subtitle="Maak een foto van de bon" wide>
          {error && <div className="muted" style={{ color: "#f88" }}>{error}</div>}

          <div className="grid2">
            <div>
              <label className="lbl">Camera</label>
              <select
                className="select"
                value={deviceId || ""}
                onChange={(e) => setDeviceId(e.target.value)}
              >
                {devices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || "Camera"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!snapDataUrl ? (
            <>
              <div className="camera-view">
                {/* Autoplay + muted + playsInline helpen op mobiel */}
                <video ref={videoRef} autoPlay playsInline muted />
              </div>

              {noStream && (
                <div className="muted" style={{ marginTop: 8 }}>
                  Zie je geen beeld of geen prompt? Klik hieronder om een permissie-vraag te forceren.
                  {askedOnce ? (
                    <div style={{ marginTop: 6 }}>
                      • Check ook <b>Site permissions</b> → Camera = Allow. <br />
                      • Windows: Instellingen → Privacy & Security → <b>Camera</b> → toestaan voor desktop-apps/Edge.
                    </div>
                  ) : null}
                </div>
              )}

              <div className="btnrow">
                {noStream && (
                  <button className="btn" onClick={requestPermission}>
                    🔓 Enable camera (ask permission)
                  </button>
                )}
                <button className="btn primary" onClick={takePhoto}>
                  📸 Take photo
                </button>
                <button className="btn ghost" onClick={onClose}>Cancel</button>
              </div>
            </>
          ) : (
            <>
              <div className="camera-view">
                <img src={snapDataUrl} alt="snapshot" />
              </div>
              <div className="btnrow">
                <button className="btn" onClick={() => setSnapDataUrl("")}>Retake</button>
                <button className="btn primary" onClick={usePhoto}>Use photo</button>
              </div>
            </>
          )}

          <canvas ref={canvasRef} style={{ display: "none" }} />
        </Card>
      </div>
    </div>
  );
}
