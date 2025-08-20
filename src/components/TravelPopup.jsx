import React, { useState } from "react";

function TravelPopup({ onClose, onSave }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [km, setKm] = useState("");

  const handleSave = () => {
    if (!from || !to || !km) return;
    onSave({
      from,
      to,
      km: parseFloat(km),
      time: new Date().toISOString(),
    });
  };

  return (
    <div className="popup">
      <h2>🚗 Reis toevoegen</h2>
      <input
        type="text"
        placeholder="Van"
        value={from}
        onChange={(e) => setFrom(e.target.value)}
      />
      <input
        type="text"
        placeholder="Naar"
        value={to}
        onChange={(e) => setTo(e.target.value)}
      />
      <input
        type="number"
        placeholder="Kilometers"
        value={km}
        onChange={(e) => setKm(e.target.value)}
      />

      <button onClick={handleSave}>Opslaan</button>
      <button onClick={onClose}>Annuleer</button>
    </div>
  );
}

export default TravelPopup;
