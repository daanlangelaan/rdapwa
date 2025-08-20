import React, { useState, useEffect } from "react";

function WorkTimer({ active, onStart, onStop, onSave }) {
  const [seconds, setSeconds] = useState(0);

  // Timer loopt alleen als actief
  useEffect(() => {
    let interval;
    if (active) {
      interval = setInterval(() => setSeconds((prev) => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [active]);

  const handleStop = () => {
    onStop();
    if (seconds > 0) {
      onSave({
        type: "work",
        duration: seconds,
        time: new Date().toISOString(),
      });
    }
    setSeconds(0);
  };

  return (
    <div className="work-timer">
      {active ? (
        <div>
          <p>⏱️ Werk timer: {Math.floor(seconds / 60)}m {seconds % 60}s</p>
          <button onClick={handleStop}>Stop</button>
        </div>
      ) : (
        <button onClick={onStart}>Start Werk</button>
      )}
    </div>
  );
}

export default WorkTimer;
