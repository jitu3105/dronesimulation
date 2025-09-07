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
  const [socket, setSocket] = useState<Socket>();
  useEffect(() => {
    // const a = new Set();
    const skt = io(SOCKET_URL, {
      path: "/ws/dronesim", // 👈 Must match FastAPI mount path + socket.io suffix
      transports: ["websocket"], // Optional, avoid long-polling
    });
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
