import { useState } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";
import { Card } from "./components/ui/card";
import WebRTCPlayer from "./WebRTCPlayer";
import Telem from "./Telem";

function App() {
  return (
    <Card className="relative w-screen h-screen p-0 rounded-none">
      <WebRTCPlayer stream="drone" />
      <Telem />
    </Card>
  );
}

export default App;
