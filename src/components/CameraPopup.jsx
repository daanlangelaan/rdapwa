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

  useEffect(() => {
    let active = true;

    const enumerate = async () => {
      try {
        const devs = await navigator.mediaDevices.enumerateDevices();
        const cams = devs.filter((d) => d.kind === "videoinput");
        if (!active) return;
        setDevices(cams);
        // kies achtercamera als beschikbaar
        const env = cams.find((d) => /back|rear|environment/i.test(d.label));
        setDeviceId((env || cams[0] || {}).deviceId || null);
      } catch (e) {
        setError("Geen camera-apparaten gevonden of geen permissie.");
      }
    };

    enumerate();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    // start stream zodra er een device gekozen is
    if (!deviceId) return;
    startCamera(deviceId);
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  const startCamera = async (id) => {
    stopCamera();
    setError("");
    try {
      const st = await navigator.mediaDevices.getUserMedia({
        video: id ? { deviceId: { exact: id } } : { facingMode: { ideal: "environment" } },
        audio: false,
      });
      setStream(st);
      if (videoRef.current) {
        videoRef.current.srcObject = st;
        await videoRef.current.play();
      }
    } catch (e) {
      setError("Camera start mislukt. Toegang toegestaan? (localhost/HTTPS vereist)");
    }
  };

  const stopCamera = () => {
    try {
      stream?.getTracks()?.forEach((t) => t.stop());
    } catch {}
    setStream(null);
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
    onCapture(snapDataUrl); // levert dataURL terug aan ouder
    onClose();
  };

  return (
    <div className="popup-mask full-opaque">
      <div className="popup-panel fullscreen-minus-bottom">
        <Card title="Camera" subtitle="Maak een foto van de bon" wide>
          {error && <div className="muted" style={{ color: "#f88" }}>{error}</div>}

          {!snapDataUrl ? (
            <>
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

              <div className="camera-view">
                <video ref={videoRef} playsInline muted />
              </div>

              <div className="btnrow">
                <button className="btn primary" onClick={takePhoto}>📸 Take photo</button>
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
