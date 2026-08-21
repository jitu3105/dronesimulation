import { useEffect, useRef, useState } from "react";
import "./App.css";
import { Card } from "./components/ui/card";
import Telem from "./FlightControlsGCS";
import { Toaster } from "@/components/ui/sonner";
import ThreeDWorld from "./TacticalWorldGCS";
const SOCKET_URL = `https://${location.hostname}`; // Adjust if your server runs on a different port
import io, { Socket } from "socket.io-client";
import GameMap from "./TacticalRadarGCS";

function App() {
  const [isReady, setIsReady] = useState(false);
  const [loading, setLoading] = useState({ percent: 0, stage: "Connecting" });
  const [socket, setSocket] = useState<Socket>();
  useEffect(() => {
    // const a = new Set();
    const skt = io(SOCKET_URL, {
      path: "/ws/dronesim", // 👈 Must match FastAPI mount path + socket.io suffix
      transports: ["websocket"], // Optional, avoid long-polling
    });
    skt.once("telem", () => {
      setLoading({ percent: 100, stage: "Flight systems online" });
      setIsReady(true);
    });
    skt.on("loading", (data) => setLoading(data));

    skt.on("connect", () => {
      setLoading({ percent: 5, stage: "Connecting to simulator" });
      setSocket(skt);
    });
  }, []);
  const state = useRef<any>({});
  return (
    <>
      <Toaster
        position="top-center"
        richColors={true}
        theme="light"
        className="opacity-80 pointer-events-none"
      />

      <Card className="relative w-screen h-screen p-0 rounded-none border-none">
        {!isReady && (
          <div className="loading-screen absolute inset-0 z-50 flex items-center justify-center bg-black">
            <div className="loading-card text-center">
              <div className="loading-eyebrow">SKY//OPS FLIGHT LAB</div>
              <h1>Browser-based drone simulation</h1>
              <p className="loading-intro">Fly a PX4-powered quadcopter in a live 3D environment with real telemetry, offboard control, and a ground-control-style HUD.</p>
              <div className="loading-features">
                <span><b>W / S</b> Altitude</span>
                <span><b>A / D</b> Heading</span>
                <span><b>ARROWS</b> Pitch &amp; roll</span>
              </div>
              <div className="loading-orbit"><div /></div>
              <p className="loading-stage">{loading.stage}</p>
              <div className="loading-progress"><div style={{ width: `${loading.percent}%` }} /></div>
              <div className="loading-meta"><span>{loading.percent}%</span><span>PX4 SITL / FLIGHT SYSTEMS</span></div>
            </div>
          </div>
        )}
        {socket && socket.id && (
          <>
            {/*<WebRTCPlayer stream={socket.id} />*/}
            <ThreeDWorld state={state} />
            <GameMap state={state} />
            {/* <ThreeDWorld /> */}
            {/* <Telem state={state} dispatch={dispatch} /> */}
            <Telem state={state} socket={socket} />
          </>
        )}
      </Card>
    </>
  );
}

export default App;
