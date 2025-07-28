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
} from "three";

const ThreeDWorld: React.FC<{ state: any }> = ({ state }) => {
  const texture = useLoader(TextureLoader, "/ground.png");
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(25, 25);

  return (
    <Canvas style={{ background: "#87CEEB" }} shadows>
      <Sky
        distance={450000}
        sunPosition={[100, 20, 100]}
        inclination={0}
        azimuth={0.25}
      />
      <Suspense fallback={null}>
        <DroneModel props={{ position: [0, 0, 0] }} state={state} />
      </Suspense>
      <ambientLight intensity={0.4} />
      <directionalLight position={[100, 100, 100]} intensity={1} castShadow />
      <Ground />
      <OrbitControls />
    </Canvas>
  );
};

const degToRad = (deg: number) => (deg * Math.PI) / 180;

const latLonToMeters = (
  lat: number,
  lon: number,
  originLat: number,
  originLon: number
) => {
  const R = 6378137;
  const dLat = ((lat - originLat) * Math.PI) / 180;
  const dLon = ((lon - originLon) * Math.PI) / 180;
  const meanLat = (((lat + originLat) / 2) * Math.PI) / 180;

  const x = R * dLon * Math.cos(meanLat); // East
  const z = R * dLat; // North

  return { x, z };
};

const DroneModel: React.FC<{ props: any; state: any }> = ({ props, state }) => {
  const temp: any = useGLTF("/drone.glb");
  const gltf: Group = temp.scene;
  const sceneRef = useRef<Group>(null);

  const prop1 = useRef<Object3D>(null);
  const prop2 = useRef<Object3D>(null);
  const prop3 = useRef<Object3D>(null);
  const prop4 = useRef<Object3D>(null);

  const { camera } = useThree();
  const [origin, setOrigin] = useState<{ lat: number; lon: number } | null>(
    null
  );

  // Smooth state
  const currentPosition = useRef(new Vector3());
  const currentRotation = useRef(new Euler());
  const smoothThrottle = useRef(0);

  useEffect(() => {
    if (sceneRef.current) {
      prop1.current = sceneRef.current.getObjectByName("prop_fl") || null;
      prop2.current = sceneRef.current.getObjectByName("prop_fr") || null;
      prop3.current = sceneRef.current.getObjectByName("prop_rl") || null;
      prop4.current = sceneRef.current.getObjectByName("prop_rr") || null;
    }
  }, [temp]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!origin && state.current.lat && state.current.lon) {
        setOrigin({ lat: state.current.lat, lon: state.current.lon });
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [origin]);

  useFrame((_, delta) => {
    if (!sceneRef.current || !origin) return;

    // Smooth throttle
    const rawThrottle = state.current?.throttle || 0;
    smoothThrottle.current += (rawThrottle - smoothThrottle.current) * 0.1;
    const spinSpeed = smoothThrottle.current * 100;

    // Spin propellers
    for (const prop of [prop1, prop2, prop3, prop4]) {
      if (prop.current) {
        prop.current.rotation.y += delta * spinSpeed;
      }
    }

    // Calculate drone position
    const { x, z } = latLonToMeters(
      state.current.lat,
      state.current.lon,
      origin.lat,
      origin.lon
    );

    const y = state.current.armed ? (state.current.agl || 0) / 2 : 0;
    const newPosition = new Vector3(x, y, -z);

    // Smooth position
    currentPosition.current.lerp(newPosition, 0.1);
    sceneRef.current.position.copy(currentPosition.current);

    // Rotation smoothing
    const roll = -degToRad(state.current.roll_deg ?? 0) / 4;
    const pitch = degToRad(state.current.pitch_deg ?? 0) / 4;
    const yaw = -degToRad(state.current.yaw_deg ?? 0);

    const newRotation = new Euler(pitch, yaw, roll, "YXZ");
    currentRotation.current.x +=
      (newRotation.x - currentRotation.current.x) * 0.1;
    currentRotation.current.y +=
      (newRotation.y - currentRotation.current.y) * 0.1;
    currentRotation.current.z +=
      (newRotation.z - currentRotation.current.z) * 0.1;

    sceneRef.current.rotation.copy(currentRotation.current);

    // Camera follows smoothly
    const cameraTarget = sceneRef.current.localToWorld(new Vector3(0, 2, 5));
    camera.position.lerp(cameraTarget, 0.1);
    camera.lookAt(sceneRef.current.position);
  });

  return <primitive object={gltf} {...props} ref={sceneRef} />;
};

const MemoisedThreeDWorld = memo(ThreeDWorld);
export default MemoisedThreeDWorld;

const Ground = () => {
  const texture = useTexture("/ground.png");
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(25, 25);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[200, 200]} />
      <meshStandardMaterial map={texture} />
    </mesh>
  );
};
