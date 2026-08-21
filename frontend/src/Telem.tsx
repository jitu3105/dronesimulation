import React, { useEffect, useRef, useState } from "react";
import { Joystick, JoystickShape } from "react-joystick-component";
import { toast } from "sonner";
import type { Socket } from "socket.io-client";

const clamp = (value: number, min = -1, max = 1) =>
  Math.min(Math.max(value, min), max);

const Telem: React.FC<{ state: any; socket: Socket }> = ({ state, socket }) => {
  const [, refreshHud] = useState(0);
  const leftJoySitckRef = useRef<Joystick>(null);
  const rightJoySitckRef = useRef<Joystick>(null);

  const controls = useRef<{
    rgt: number;
    dwn: number;
    fwd: number;
    yaw: number;
  }>({ rgt: 0, fwd: 0, yaw: 0, dwn: 0 });

  const emitMove = (next: Partial<typeof controls.current>) => {
    controls.current = {
      ...controls.current,
      ...next,
    };

    if (socket) {
      socket.emit("move", { ...controls.current });
    }
  };

  useEffect(() => {
    const telemUpdater = (data: any) => {
      state.current = { ...state.current, ...data, lastUpdate: Date.now() };
      refreshHud((value) => value + 1);
    };

    const statusUpdater = (data: any) => {
      switch (data.type) {
        case "INFO":
          toast.info(data.text);
          break;
        case "WARNING":
        case "DEBUG":
        case "ALERT":
          toast.warning(data.text);
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
    emitMove({
      // Flip the joystick's vertical axis: pushing up must command climb.
      dwn: clamp(data.y * 3, -3, 3),
      yaw: clamp(data.x * 35, -35, 35),
    });
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

    emitMove({ dwn: 0, yaw: 0 });
  };

  const handleRightMove = (data: any) => {
    emitMove({
      fwd: clamp(data.y * 8, -8, 8),
      rgt: clamp(data.x * 8, -8, 8),
    });
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

    emitMove({ fwd: 0, rgt: 0 });
  };

  useEffect(() => {
    const keyboardState = {
      w: false,
      s: false,
      a: false,
      d: false,
      ArrowUp: false,
      ArrowDown: false,
      ArrowLeft: false,
      ArrowRight: false,
    };

    const refreshKeyboardState = () => {
      const throttle = (keyboardState.w ? 1 : 0) - (keyboardState.s ? 1 : 0);
      const yaw = (keyboardState.d ? 1 : 0) - (keyboardState.a ? 1 : 0);
      const pitch = (keyboardState.ArrowUp ? 1 : 0) - (keyboardState.ArrowDown ? 1 : 0);
      const roll = (keyboardState.ArrowRight ? 1 : 0) - (keyboardState.ArrowLeft ? 1 : 0);

      emitMove({
        dwn: -throttle * 3,
        yaw: yaw * 35,
        fwd: pitch * 8,
        rgt: roll * 8,
      });
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key;
      if (["w", "s", "a", "d", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key)) {
        event.preventDefault();
      }

      const normalizedKey = key.length === 1 ? key.toLowerCase() : key;
      if (normalizedKey in keyboardState) {
        keyboardState[normalizedKey as keyof typeof keyboardState] = true;
        refreshKeyboardState();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const normalizedKey = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (normalizedKey in keyboardState) {
        keyboardState[normalizedKey as keyof typeof keyboardState] = false;
        refreshKeyboardState();
      }
    };

    const handleWindowBlur = () => {
      Object.keys(keyboardState).forEach((key) => {
        keyboardState[key as keyof typeof keyboardState] = false;
      });
      refreshKeyboardState();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [socket]);

  const agl = Number(state.current?.agl ?? 0);
  const msl = Number(state.current?.msl ?? 0);
  const mode = state.current?.mode ?? "---";
  const armed = Boolean(state.current?.armed);
  const roll = Number(state.current?.roll_deg ?? 0);
  const pitch = Number(state.current?.pitch_deg ?? 0);
  const yaw = Number(state.current?.yaw_deg ?? state.current?.heading ?? 0);
  const connectionAge = state.current?.lastUpdate
    ? Math.max(0, (Date.now() - state.current.lastUpdate) / 1000)
    : 0;

  return (
    <>
      <div className="hud-shell">
        <div className="hud-vignette" />

        <div className="hud-brand"><span className="brand-mark">+</span><span>SKY//OPS</span><small>FLIGHT DECK</small></div>

        <div className={`arm-banner ${armed ? "is-armed" : ""}`}><span className="status-dot" /> {armed ? "Armed" : "Standby"}</div>

        <div className="hud-topbar">
          <div className="hud-chip hud-chip--mode"><span>FLIGHT MODE</span><strong>{mode}</strong></div>
          <div className="hud-chip"><span>AGL</span><strong>{Math.max(agl, 0).toFixed(0)}<em> m</em></strong></div>
          <div className="hud-chip"><span>MSL</span><strong>{Math.max(msl, 0).toFixed(0)}<em> m</em></strong></div>
        </div>

        <div className="attitude-panel">
          <div className="panel-title"><span>ATTITUDE</span><small>LIVE / 10 HZ</small></div>
          <div className="attitude-values">
            <div><span>ROLL</span><strong>{roll.toFixed(1)}°</strong></div>
            <div><span>PITCH</span><strong>{pitch.toFixed(1)}°</strong></div>
            <div><span>YAW</span><strong>{yaw.toFixed(1)}°</strong></div>
          </div>
          <div className="artificial-horizon" style={{ transform: `rotate(${-roll}deg)` }}>
            <div className="horizon-pitch" style={{ transform: `translateY(${pitch * 1.2}px)` }} />
            <div className="horizon-marker" />
          </div>
        </div>

        <div className="telemetry-panel">
          <div className="panel-title"><span>SYSTEM TELEMETRY</span><small>{connectionAge < 2 ? "LINK OK" : "NO DATA"}</small></div>
          <div className="telemetry-grid">
            <div><span>GPS</span><strong>{state.current?.lat ? `${Number(state.current.lat).toFixed(5)}, ${Number(state.current.lon).toFixed(5)}` : "—"}</strong></div>
            <div><span>HEADING</span><strong>{Number(state.current?.heading ?? yaw).toFixed(0)}°</strong></div>
            <div><span>STATUS</span><strong>{armed ? "ARMED" : "STANDBY"}</strong></div>
            <div><span>LINK</span><strong>{state.current?.lastUpdate ? "CONNECTED" : "WAITING"}</strong></div>
          </div>
        </div>

        <div className="hud-left">
          <div className="telemetry-label">VERTICAL<br /><span>HEIGHT</span></div>
          <div className="altitude-stack">
            <div className="altitude-meter" aria-label="altitude meter">
              <div className="altitude-meter__grid">
                {[0, 25, 50, 75, 100].map((line) => (
                  <span key={line} />
                ))}
              </div>
              <div
                className="altitude-meter__fill"
                style={{ height: `${Math.min(Math.max(agl, 0) * 2, 100)}%` }}
              />
            </div>
            <div className="hud-readout">
              AGL
              <strong>{Math.max(agl, 0).toFixed(0)}</strong>
            </div>
          </div>
        </div>

        <div className="hud-kbd" aria-label="keyboard control guide">
          <div className="controls-heading"><span>CONTROL SCHEME</span><small>KEYBOARD READY</small></div>
          <div className="key-group">
            <div className="key-row">
              <span className="key-pair"><span className="key">W</span><span className="key">S</span></span><span><b>THROTTLE</b><small>ASCEND / DESCEND</small></span>
            </div>
            <div className="key-row">
              <span className="key-pair"><span className="key">A</span><span className="key">D</span></span><span><b>YAW</b><small>ROTATE LEFT / RIGHT</small></span>
            </div>
          </div>
          <div className="key-group">
            <div className="key-row">
              <span className="key-pair"><span className="key">↑</span><span className="key">↓</span></span><span><b>PITCH</b><small>NOSE DOWN / UP</small></span>
            </div>
            <div className="key-row">
              <span className="key-pair"><span className="key">←</span><span className="key">→</span></span><span><b>ROLL</b><small>LEFT / RIGHT BANK</small></span>
            </div>
          </div>
        </div>
      </div>

      <div className="control-pad left">
        <div className="joystick-shell">
          <Joystick
            ref={leftJoySitckRef}
            size={150}
            sticky
            baseColor="rgba(255,255,255,0.05)"
            stickColor="#ff5d8f"
            throttle={200}
            controlPlaneShape={JoystickShape.Square}
            move={handleLeftMove}
            stop={handleLeftStop}
          />
        </div>
      </div>

      <div className="control-pad right">
        <div className="joystick-shell">
          <Joystick
            ref={rightJoySitckRef}
            size={150}
            sticky
            baseColor="rgba(255,255,255,0.05)"
            stickColor="#4ade80"
            throttle={200}
            controlPlaneShape={JoystickShape.Square}
            move={handleRightMove}
            stop={handleRightStop}
          />
        </div>
      </div>
    </>
  );
};

export default Telem;
