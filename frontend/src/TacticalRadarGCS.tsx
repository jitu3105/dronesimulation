import React, { useEffect, useState } from "react";

const GameMap: React.FC<{ state: any }> = ({ state }) => {
  const [display, setDisplay] = useState({ heading: 0, lat: Number.NaN, lon: Number.NaN });
  useEffect(() => {
    const timer = window.setInterval(() => setDisplay({
      heading: Number(state.current?.heading ?? state.current?.yaw_deg ?? 0),
      lat: Number(state.current?.lat),
      lon: Number(state.current?.lon),
    }), 400);
    return () => window.clearInterval(timer);
  }, [state]);

  return (
    <div className="gcs-map radar-map">
      <div className="gcs-map__header"><span>LOCAL RADAR</span><small>TRACK UP</small></div>
      <div className="radar-grid" />
      <div className="radar-sweep" />
      <div className="radar-track radar-track--one" />
      <div className="radar-track radar-track--two" />
      <div className="radar-ownship" style={{ transform: `translate(-50%,-50%) rotate(${display.heading}deg)` }} />
      <div className="radar-coords">{Number.isFinite(display.lat) ? display.lat.toFixed(4) : "—"} / {Number.isFinite(display.lon) ? display.lon.toFixed(4) : "—"}</div>
      <div className="gcs-map__north">N</div>
    </div>
  );
};

export default GameMap;
