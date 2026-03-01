import React, { useEffect, useRef, useState } from "react";
import { Card } from "./components/ui/card";
import { Joystick, JoystickShape } from "react-joystick-component";
import { toast } from "sonner";
import type { MapRef } from "react-map-gl/maplibre";
import { Map, Marker } from "react-map-gl/maplibre";
import Pin from "./Pin";
import { Send } from "lucide-react";
import { Socket } from "socket.io-client";

const Telem: React.FC<{
  state: any;
  socket: Socket;
  // dispatch: Function
}> = ({
  state,
  socket,
  // dispatch,
}) => {
  const leftJoySitckRef = useRef<Joystick>(null);
  const rightJoySitckRef = useRef<Joystick>(null);
  const controls = useRef<{
    rgt: number;
    dwn: number;
    fwd: number;
    yaw: number;
  }>({ rgt: 0, fwd: 0, yaw: 0, dwn: 0 });

  useEffect(() => {
    const telemUpdater = (data: any) => {
      // console.log(mapRef);

      state.current = { ...state.current, ...data };
      // dispatch({ action: "update:telem", payload: data });
    };
    const statusUpdater = (data: any) => {
      switch (data.type) {
        case "INFO":
          toast.info(data.text);
          break;
        case "WARNING":
          toast.warning(data.text);
          break;
        case "DEBUG":
          toast.warning(data.text);
          break;
        case "ALERT":
          toast.warning(data.text);
          break;
        case "CRITICAL":
          toast.error(data.text);
          break;
        case "CRITICAL":
          toast.error(data.text);
          break;
        case "CRITICAL":
          toast.error(data.text);
          break;
        default:
          toast.info(data.text);
          break;
      }
    };
    if (socket) {
      socket.on("telem", telemUpdater);
      socket.on("status", statusUpdater);
    }
    return () => {
      socket?.removeListener("status", statusUpdater);
      socket?.removeListener("telem", telemUpdater);
    };
  }, [socket]);

  const handleLeftMove = (data: any) => {
    controls.current = {
      ...controls.current,
      dwn: -data.y * 2,
      yaw: data.x * 20,
    };
    if (socket) {
      socket.emit("move", { ...controls.current });
    }
  };
  const handleLeftStop = () => {
    leftJoySitckRef.current?.setState({
      ...leftJoySitckRef.current.state,
      coordinates: {
        axisX: 0,
        axisY: 0,
        direction: "BACKWARD",
        distance: 0,
        relativeX: 0,
        relativeY: 0,
      },
    });
    controls.current = {
      ...controls.current,
      dwn: 0,
      yaw: 0,
    };
    if (socket) {
      socket.emit("move", { ...controls.current });
    }
  };
  const handleRightMove = (data: any) => {
    controls.current = {
      ...controls.current,
      fwd: data.y * 5,
      rgt: data.x * 5,
    };
    if (socket) {
      socket.emit("move", { ...controls.current });
    }
  };
  const handleRightStop = () => {
    rightJoySitckRef.current?.setState({
      ...rightJoySitckRef.current.state,
      coordinates: {
        axisX: 0,
        axisY: 0,
        direction: "BACKWARD",
        distance: 0,
        relativeX: 0,
        relativeY: 0,
      },
    });
    controls.current = {
      ...controls.current,
      fwd: 0,
      rgt: 0,
    };
    if (socket) {
      socket.emit("move", { ...controls.current });
    }
  };

  const modeRef = useRef<HTMLParagraphElement>(null);
  const aglRef = useRef<HTMLParagraphElement>(null);
  const mslRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const aglBar = document.getElementById("aglBar");
    const mslBar = document.getElementById("mslBar");

    const animate = () => {
      const agl = state.current?.agl ?? 0;
      const msl = state.current?.msl ?? 0;

      if (aglRef.current) {
        aglRef.current.innerHTML = agl < 0 ? "0" : agl.toFixed(0);
      }

      if (mslRef.current) {
        mslRef.current.innerHTML = msl < 0 ? "0" : msl.toFixed(0);
      }

      if (modeRef.current && state.current?.mode) {
        modeRef.current.innerHTML = state.current.mode;
      }

      // update bar heights
      if (aglBar) {
        aglBar.style.height = `${Math.min(agl * 2, 100)}%`;
      }

      if (mslBar) {
        mslBar.style.height = `${Math.min(msl / 5, 100)}%`;
      }

      animationId = requestAnimationFrame(animate);
    };

    let animationId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationId);
  }, []);
  return (
    <>
      {/* Cinematic dark overlay */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/40 via-transparent to-black/70" />

      {/* ARMED ALERT */}
      {state.current?.armed && (
        <div className="absolute top-6 right-6 text-red-500 text-lg font-bold tracking-widest animate-pulse">
          ● ARMED
        </div>
      )}

      {/* MODE BAR (center bottom) */}
      <Card
        className="
    absolute
    bottom-8   /* sits above radar */
    left-1/2
    -translate-x-1/2
    px-8 py-3
    backdrop-blur-md
    bg-black/70
    text-white
    border border-white/10
    shadow-xl
    rounded-md
    tracking-widest
    text-sm
    font-semibold
    z-30
  "
      >
        <span className="opacity-60">MODE</span>
        <span
          ref={modeRef}
          className={`ml-4 ${
            state.current?.armed ? "text-red-400" : "text-cyan-400"
          }`}
        >
          ---
        </span>
      </Card>

      {/* LEFT SIDE ALTITUDE HUD */}
      <div className="absolute left-6 bottom-1/2 -translate-y-1/2 flex flex-col items-center gap-6">
        {/* AGL BAR */}
        <div className="relative w-6 h-52 bg-black/60 border border-white/10 rounded overflow-hidden shadow-lg">
          <div
            id="aglBar"
            className="absolute bottom-0 w-full bg-green-400 transition-all duration-150"
            style={{ height: "0%" }}
          />
        </div>
        {/* AGL BAR */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative w-10 h-56 bg-black/60 border border-white/10 rounded-lg overflow-hidden shadow-xl">
            {/* Scale lines */}
            <div className="absolute inset-0 flex flex-col justify-between py-2 pointer-events-none">
              {[0, 25, 50, 75, 100].map((v) => (
                <div key={v} className="w-full border-t border-white/10" />
              ))}
            </div>

            {/* Fill */}
            <div
              className="absolute bottom-0 w-full transition-all duration-200 ease-out
                 bg-gradient-to-t from-green-500 via-green-400 to-emerald-300
                 shadow-[0_0_15px_rgba(34,197,94,0.6)]"
              style={{
                height: `${Math.min((state.current?.agl ?? 0) * 2, 100)}%`,
              }}
            />
          </div>

          {/* Value Label */}
          <div className="text-xs text-white tracking-widest text-center">
            <div className="opacity-50">AGL</div>
            <div className="text-sm font-semibold">
              {(state.current?.agl ?? 0) < 0
                ? 0
                : Number(state.current?.agl ?? 0).toFixed(0)}
            </div>
          </div>
        </div>

        {/* MSL BAR */}
        <div className="relative w-6 h-52 bg-black/60 border border-white/10 rounded overflow-hidden shadow-lg">
          <div
            id="mslBar"
            className="absolute bottom-0 w-full bg-blue-400 transition-all duration-150"
            style={{ height: "0%" }}
          />
        </div>
        <div className="text-xs text-white opacity-70 tracking-widest">
          MSL <span ref={mslRef}>0</span>
        </div>
      </div>

      {/* RIGHT JOYSTICK */}
      <Card
        className="absolute p-5 bottom-[18vmin] right-[4vmax]
      bg-black/60 backdrop-blur-md rounded-full
      border border-white/10 shadow-2xl"
      >
        <Joystick
          ref={rightJoySitckRef}
          size={150}
          sticky
          baseColor="rgba(255,255,255,0.05)"
          stickColor="#00ffcc"
          throttle={200}
          controlPlaneShape={JoystickShape.Square}
          move={handleRightMove}
          stop={handleRightStop}
        />
      </Card>

      {/* LEFT JOYSTICK */}
      <Card
        className="absolute p-5 bottom-[18vmin] left-[4vmax]
      bg-black/60 backdrop-blur-md rounded-full
      border border-white/10 shadow-2xl"
      >
        <Joystick
          ref={leftJoySitckRef}
          size={150}
          sticky
          baseColor="rgba(255,255,255,0.05)"
          stickColor="#ff0066"
          throttle={200}
          controlPlaneShape={JoystickShape.Square}
          move={handleLeftMove}
          stop={handleLeftStop}
        />
      </Card>
    </>
  );
};

export default Telem;
