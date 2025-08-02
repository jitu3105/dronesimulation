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
    const animate = () => {
      if (state.current.agl && aglRef.current && mslRef.current) {
        aglRef.current.innerHTML =
          state.current.agl < 0 ? 0 : state.current.agl.toFixed(0);
        mslRef.current.innerHTML =
          state.current.msl < 0 ? 0 : state.current.msl.toFixed(0);
      }
      if (modeRef.current && state.current.mode) {
        modeRef.current.innerHTML = state.current.mode;
      }
      animationId = requestAnimationFrame(animate);
    };
    let animationId = requestAnimationFrame(animate);
  }, []);
  return (
    <>
      {state.armed}
      <Card
        className={`absolute p-2 bottom-[12vmax] left-1/2 -translate-x-1/2 ${
          state.armed ? "bg-red-500/30" : "bg-white/30"
        }  backdrop-blur-sm rounded-sm border-none  flex flex-row gap-4`}
      >
        MODE: <p ref={modeRef}>{state.mode}</p>
      </Card>
      <Card className="absolute p-2 bottom-1/2 left-2  bg-white/30 backdrop-blur-sm  rounded-sm border-none flex flex-row gap-4">
        <p>AGL:</p>
        <p ref={aglRef}>{state.agl ? state.agl.toFixed(2) : "---"}</p>
      </Card>
      <Card className="absolute p-2 bottom-1/2 right-2  bg-white/30 backdrop-blur-sm  rounded-sm border-none  flex flex-row gap-4">
        MSL:<p ref={mslRef}>{state.msl ? state.msl.toFixed(2) : "---"}</p>
      </Card>

      <Card className="absolute p-2 bottom-[20vmin] right-[4vmax]  bg-white/30 backdrop-blur-sm  rounded-full border-none opacity-50">
        <Joystick
          ref={rightJoySitckRef}
          size={125}
          sticky={true}
          baseColor="transparent"
          stickColor="white"
          throttle={200}
          // baseShape={JoystickShape.Circle}
          controlPlaneShape={JoystickShape.Square}
          move={handleRightMove}
          stop={handleRightStop}
          // move={handleMove}
          // stop={handleStop}
        ></Joystick>
      </Card>
      <Card className="absolute p-2 bottom-[20vmin] left-[4vmax]  bg-white/30 backdrop-blur-sm  rounded-full border-none opacity-50">
        <Joystick
          ref={leftJoySitckRef}
          size={125}
          sticky={true}
          baseColor="transparent"
          stickColor="white"
          throttle={200}
          controlPlaneShape={JoystickShape.Square}
          move={handleLeftMove}
          stop={handleLeftStop}
        ></Joystick>
      </Card>
    </>
  );
};

export default Telem;
