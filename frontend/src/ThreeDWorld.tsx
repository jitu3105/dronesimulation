import React, { memo, Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF, useTexture, Sky } from "@react-three/drei";
import {
  Group,
  Object3D,
  Vector3,
  Euler,
  TextureLoader,
  RepeatWrapping,
  Quaternion,
} from "three";
useGLTF.preload("/drone.glb");
const ThreeDWorld: React.FC<{ state: any }> = ({ state }) => {
  const texture = useLoader(TextureLoader, "/ground.png");
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(25, 25);

  return (
    <Canvas
      style={{ background: "#87CEEB" }}
      shadows
      gl={{ antialias: true }}
      dpr={[1, 2]}
      camera={{ fov: 60 }}
    >
      <Sky
        distance={1000}
        sunPosition={[100, 20, 100]}
        inclination={0}
        azimuth={0.25}
      />

      <Suspense fallback={null}>
        <DroneModel state={state} />
      </Suspense>

      <ambientLight intensity={0.4} />
      <directionalLight
        position={[100, 100, 100]}
        intensity={1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />

      <Ground />
    </Canvas>
  );
};

const degToRad = (deg: number) => (deg * Math.PI) / 180;

// Convert Lat/Lon to meters (North/East)
const latLonToMeters = (
  lat: number,
  lon: number,
  originLat: number,
  originLon: number,
) => {
  const R = 6378137;

  const dLat = ((lat - originLat) * Math.PI) / 180;
  const dLon = ((lon - originLon) * Math.PI) / 180;
  const meanLat = (((lat + originLat) / 2) * Math.PI) / 180;

  const east = R * dLon * Math.cos(meanLat);
  const north = R * dLat;

  return { east: -east, north: -north };
};
const DroneModel: React.FC<{ state: any }> = ({ state }) => {
  const { scene } = useGLTF("/drone.glb");
  const sceneRef = useRef<Group>(null);
  const { camera } = useThree();

  const [origin, setOrigin] = useState<{ lat: number; lon: number } | null>(
    null,
  );

  const currentPosition = useRef(new Vector3());
  const targetPosition = useRef(new Vector3());

  const currentRotation = useRef(new Euler());
  const targetRotation = useRef(new Euler());

  const smoothThrottle = useRef(0);

  const cameraTarget = useRef(new Vector3());
  const droneWorldPos = useRef(new Vector3());

  const propRefs = useRef<Object3D[]>([]);

  // Get propellers once
  useEffect(() => {
    if (!scene) return;

    propRefs.current = [
      scene.getObjectByName("prop_fl"),
      scene.getObjectByName("prop_fr"),
      scene.getObjectByName("prop_rl"),
      scene.getObjectByName("prop_rr"),
    ].filter(Boolean) as Object3D[];
  }, [scene]);

  useFrame((_, delta) => {
    if (!state.current) return;

    // Initialize origin once
    if (!origin && state.current.lat && state.current.lon) {
      setOrigin({
        lat: state.current.lat,
        lon: state.current.lon,
      });
      return;
    }

    if (!sceneRef.current || !origin) return;

    // ======================
    // PROPELLER SPIN
    // ======================

    const rawThrottle = state.current.throttle || 0;
    smoothThrottle.current += (rawThrottle - smoothThrottle.current) * 0.1;

    const spinSpeed = smoothThrottle.current * 120;

    propRefs.current.forEach((prop, index) => {
      // Alternate spin direction (realistic quad physics)
      const direction = index % 2 === 0 ? 1 : -1;
      prop.rotation.y += delta * spinSpeed * direction;
    });

    // ======================
    // POSITION (NED → THREE)
    // ======================

    const { east, north } = latLonToMeters(
      state.current.lat,
      state.current.lon,
      origin.lat,
      origin.lon,
    );

    // MAVLink: NED (North East Down)
    // Three.js: X right, Y up, Z toward camera
    // So:
    // X = East
    // Y = Up (invert down)
    // Z = -North

    const altitude = state.current.agl || 0;
    const up = state.current.armed ? altitude / 2 : 0;

    targetPosition.current.set(east, up, -north);

    currentPosition.current.lerp(targetPosition.current, 0.1);
    sceneRef.current.position.copy(currentPosition.current);

    // ======================
    // ROTATION
    // ======================

    const roll = degToRad(state.current.roll_deg ?? 0);
    const pitch = -degToRad(state.current.pitch_deg ?? 0);
    const yaw = -degToRad(state.current.yaw_deg ?? 0);

    targetRotation.current.set(pitch, yaw, roll, "YXZ");

    // currentRotation.current.x +=
    //   (targetRotation.current.x - currentRotation.current.x) * 0.1;
    // currentRotation.current.y +=
    //   (targetRotation.current.y - currentRotation.current.y) * 0.1;
    // currentRotation.current.z +=
    //   (targetRotation.current.z - currentRotation.current.z) * 0.1;

    // sceneRef.current.rotation.copy(currentRotation.current);
    const targetQuat = new Quaternion().setFromEuler(targetRotation.current);
    sceneRef.current.quaternion.slerp(targetQuat, 0.1);

    // GTA CHASE CAMERA
    sceneRef.current.getWorldPosition(droneWorldPos.current);

    const distance = 12;
    const height = 5;

    // Yaw-only facing direction
    const facingDir = new Vector3(0, 0, 1).applyQuaternion(
      sceneRef.current.quaternion,
    );
    facingDir.y = 0;
    facingDir.normalize();

    // Ideal position: behind and above
    const idealPos = new Vector3(
      droneWorldPos.current.x - facingDir.x * distance,
      droneWorldPos.current.y + height,
      droneWorldPos.current.z - facingDir.z * distance,
    );

    camera.position.lerp(idealPos, 0.1);

    // Always look at the drone
    const lookTarget = droneWorldPos.current.clone();
    lookTarget.y += 1.5;
    camera.lookAt(lookTarget);
  });

  return (
    <group ref={sceneRef}>
      <primitive object={scene} rotation={[0, Math.PI, 0]} />
    </group>
  );
};

const MemoisedThreeDWorld = memo(ThreeDWorld);
export default MemoisedThreeDWorld;

const Ground = () => {
  const texture = useTexture("/ground.png");

  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(100, 100);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[2000, 2000]} />
      <meshStandardMaterial map={texture} />
    </mesh>
  );
};
