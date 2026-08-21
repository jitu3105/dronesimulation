import { useEffect, useRef, useState } from "react";
import "./App.css";
import { Card } from "./components/ui/card";
import Telem from "./Telem";
import { Toaster } from "@/components/ui/sonner";
import ThreeDWorld from "./ThreeDWorld";
const SOCKET_URL = `https://${location.hostname}`; // Adjust if your server runs on a different port
import io, { Socket } from "socket.io-client";
import GameMap from "./GameMap";

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
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black">
            <div className="text-center space-y-6">
              <div className="loading-orbit"><div /></div>
              <p className="text-white text-lg tracking-wide">{loading.stage}</p>
              <div className="loading-progress"><div style={{ width: `${loading.percent}%` }} /></div>
              <div className="loading-meta"><span>{loading.percent}%</span><span>PX4 / GAZEBO HARMONIC</span></div>
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
