import { useEffect, useReducer, useRef, useState } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";
import { Card } from "./components/ui/card";
import WebRTCPlayer from "./WebRTCPlayer";
import Telem from "./Telem";
import { Toaster } from "@/components/ui/sonner";
import ThreeDWorld from "./ThreeDWorld";
const SOCKET_URL = `http://${location.hostname}:8000`; // Adjust if your server runs on a different port
import io, { Socket } from "socket.io-client";

const reducer = (
  state: any,
  { action, payload }: { action: string; payload: any }
) => {
  switch (action) {
    case "update:telem":
      state = { ...state, ...payload };
    default:
      return state;
  }
};

function App() {
  const [socket, setSocket] = useState<Socket>();
  useEffect(() => {
    // const a = new Set();
    const skt = io(SOCKET_URL, {
      path: "/ws/socket.io", // 👈 Must match FastAPI mount path + socket.io suffix
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
            <WebRTCPlayer stream={socket.id} />
            <ThreeDWorld state={state} />
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
