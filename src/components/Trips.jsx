// src/components/Trips.jsx
import React, { useState, useEffect } from "react";

export default function Trips() {
  const [startPoint, setStartPoint] = useState("Huis Daan");
  const [endPoint, setEndPoint] = useState("Client (project)");
  const [tripStartTime, setTripStartTime] = useState(null);
  const [tripDuration, setTripDuration] = useState(0);

  // ⏱️ Trip tijd bijhouden
  useEffect(() => {
    let interval;
    if (tripStartTime) {
      interval = setInterval(() => {
        setTripDuration(Date.now() - tripStartTime);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [tripStartTime]);

  // GPS ophalen
  const getGPSLocation = (cb) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = `${pos.coords.latitude.toFixed(
            5
          )}, ${pos.coords.longitude.toFixed(5)}`;
          cb(coords);
        },
        (err) => {
          console.error("GPS error", err);
          cb("GPS unavailable");
        }
      );
    } else {
      cb("No GPS support");
    }
  };

  const startTrip = () => {
    getGPSLocation((loc) => {
      setStartPoint(loc);
      setTripStartTime(Date.now());
      setTripDuration(0);
    });
  };

  const arriveTrip = () => {
    getGPSLocation((loc) => {
      setEndPoint(loc);
      // 🚗 nieuwe startpoint = huidige endpoint
      setStartPoint(loc);
      setTripStartTime(Date.now());
      setTripDuration(0);
    });
  };

  return (
    <div className="bg-gray-800 text-white p-4 rounded-2xl shadow-lg">
      <h2 className="text-lg font-semibold">Trips</h2>

      <div className="flex justify-between items-center mt-2">
        <span className="text-sm">Start ➝ Arrive</span>
        <span className="text-2xl font-bold">
          {new Date(tripDuration).toISOString().substr(11, 8)}
        </span>
      </div>

      <div className="mt-4">
        <p className="text-sm text-gray-300">Start point</p>
        <p className="bg-gray-700 p-2 rounded">{startPoint}</p>
      </div>

      <div className="mt-2">
        <p className="text-sm text-gray-300">End point</p>
        <p className="bg-gray-700 p-2 rounded">{endPoint}</p>
      </div>

      <div className="flex gap-2 mt-4">
        <button
          onClick={startTrip}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl"
        >
          Start Trip
        </button>
        <button
          onClick={arriveTrip}
          className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 text-lg rounded-xl"
        >
          Arrive
        </button>
      </div>
    </div>
  );
}
