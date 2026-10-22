import { useState, useEffect } from "react";

function formatTime() {
  return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function StatusStrip({ status }) {
  const [time, setTime] = useState(formatTime);

  useEffect(() => {
    const interval = setInterval(() => setTime(formatTime()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="status-strip">
      <span>{status}</span>
      <span>{time}</span>
    </div>
  );
}
