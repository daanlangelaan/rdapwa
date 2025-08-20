import React, { useState } from "react";

function NotePopup({ onClose, onSave }) {
  const [note, setNote] = useState("");

  const handleSave = () => {
    if (!note.trim()) return;
    onSave(note);
  };

  return (
    <div className="popup">
      <h2>📝 Notitie toevoegen</h2>
      <textarea
        placeholder="Typ je notitie..."
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <button onClick={handleSave}>Opslaan</button>
      <button onClick={onClose}>Annuleer</button>
    </div>
  );
}

export default NotePopup;
