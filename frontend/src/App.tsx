import { useReducer, useRef, useState } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";
import { Card } from "./components/ui/card";
import WebRTCPlayer from "./WebRTCPlayer";
import Telem from "./Telem";
import { Toaster } from "@/components/ui/sonner";
import ThreeDWorld from "./ThreeDWorld";

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
  // const [state, dispatch] = useReducer(reducer, {});
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
        <WebRTCPlayer stream="drone" />
        <ThreeDWorld state={state} />
        {/* <ThreeDWorld /> */}
        {/* <Telem state={state} dispatch={dispatch} /> */}
        <Telem state={state} />
      </Card>
    </>
  );
}

export default App;
