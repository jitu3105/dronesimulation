import React, { memo, Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, useTexture } from "@react-three/drei";
import {
  Group,
  Object3D,
  Vector3,
  Euler,
  Quaternion,
  InstancedMesh,
  MirroredRepeatWrapping,
  SRGBColorSpace,
} from "three";
useGLTF.preload("/drone.glb");
useTexture.preload("/terrain-range-v2.png");
const ThreeDWorld: React.FC<{ state: any }> = ({ state }) => {
  return (
    <Canvas
      style={{ background: "linear-gradient(180deg, #58778f 0%, #91a8b3 42%, #b1bbb4 55%, #758070 100%)" }}
      shadows={false}
      gl={{ antialias: false, powerPreference: "high-performance" }}
      dpr={1}
      camera={{ fov: 60 }}
    >
      <fog attach="fog" args={["#9aa9a4", 160, 680]} />

      <Suspense fallback={null}>
        <DroneModel state={state} />
        <Ground />
      </Suspense>

      <ambientLight intensity={0.34} />
      <hemisphereLight args={["#b9d1dd", "#4d554b", 0.58]} />
      <directionalLight
        position={[100, 100, 100]}
        intensity={1}
      />

      <RepeatingLandmarks />
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

  const targetRotation = useRef(new Euler());

  const smoothThrottle = useRef(0);

  const droneWorldPos = useRef(new Vector3());
  const facingDirection = useRef(new Vector3());
  const idealCameraPosition = useRef(new Vector3());
  const cameraLookTarget = useRef(new Vector3());
  const targetQuaternion = useRef(new Quaternion());

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
    const damping = 1 - Math.exp(-delta * 7);
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

    currentPosition.current.lerp(targetPosition.current, damping);
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
    targetQuaternion.current.setFromEuler(targetRotation.current);
    sceneRef.current.quaternion.slerp(targetQuaternion.current, damping);

    // GTA CHASE CAMERA
    sceneRef.current.getWorldPosition(droneWorldPos.current);

    const distance = 12;
    const height = 5;

    // Yaw-only facing direction
    const facingDir = facingDirection.current
      .set(0, 0, 1)
      .applyQuaternion(sceneRef.current.quaternion);
    facingDir.y = 0;
    facingDir.normalize();

    // Ideal position: behind and above
    const idealPos = idealCameraPosition.current.set(
      droneWorldPos.current.x - facingDir.x * distance,
      droneWorldPos.current.y + height,
      droneWorldPos.current.z - facingDir.z * distance,
    );

    camera.position.lerp(idealPos, damping);

    // Always look at the drone
    const lookTarget = cameraLookTarget.current.copy(droneWorldPos.current);
    lookTarget.y += 1.5;
    camera.lookAt(lookTarget);
  });

  return (
    <group ref={sceneRef} scale={1.85}>
      <primitive object={scene} rotation={[0, Math.PI, 0]} />
    </group>
  );
};

const MemoisedThreeDWorld = memo(ThreeDWorld);
export default MemoisedThreeDWorld;

const Ground = () => {
  const terrain = useTexture("/terrain-range-v2.png");
  terrain.wrapS = MirroredRepeatWrapping;
  terrain.wrapT = MirroredRepeatWrapping;
  terrain.repeat.set(72, 72);
  terrain.colorSpace = SRGBColorSpace;
  terrain.anisotropy = 4;
  terrain.needsUpdate = true;

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[10000, 10000]} />
        <meshStandardMaterial map={terrain} color="#aeb3a7" roughness={.98} metalness={0} />
      </mesh>
      <gridHelper args={[10000, 250, "#81917d", "#556256"]} position={[0,.018,0]} />
      <mesh position={[0,.035,-120]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[18,220]} /><meshStandardMaterial color="#31383a" roughness={.94} /></mesh>
      <mesh position={[0,.045,-120]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[.35,184]} /><meshBasicMaterial color="#d0c59b" /></mesh>
      <mesh position={[-78,.03,12]} rotation={[-Math.PI/2,0,.42]}><planeGeometry args={[7,290]} /><meshStandardMaterial color="#5f625b" roughness={1} /></mesh>
      <mesh position={[35,.045,-15]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[12,48]} /><meshStandardMaterial color="#30383a" /></mesh>
      <mesh position={[35,.07,-15]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[9.5,10,48]} /><meshBasicMaterial color="#d7e098" /></mesh>
      {[[45,45],[-45,45],[45,-45],[-45,-45]].map(([x,z],i) => <mesh key={i} position={[x,1.5,z]}><cylinderGeometry args={[.18,.18,3,8]} /><meshBasicMaterial color="#ffb84d" /></mesh>)}
    </group>
  );
};

const RepeatingLandmarks = () => {
  const groupRef = useRef<Group>(null);
  const towerRef = useRef<InstancedMesh>(null);
  const markerRef = useRef<InstancedMesh>(null);
  const trunkRef = useRef<InstancedMesh>(null);
  const crownRef = useRef<InstancedMesh>(null);

  useEffect(() => {
    if (!towerRef.current || !markerRef.current || !trunkRef.current || !crownRef.current) return;
    const transform = new Object3D();
    let index = 0;
    for (let x = -2; x <= 2; x += 1) {
      for (let z = -2; z <= 2; z += 1) {
        const height = 3 + ((Math.abs(x * 7 + z * 11) % 5) * 1.8);
        transform.position.set(x * 130 + 55, height / 2, z * 130 + 35);
        transform.scale.set(1, height, 1);
        transform.updateMatrix();
        towerRef.current.setMatrixAt(index, transform.matrix);
        transform.position.set(x * 130 - 28, .08, z * 130 - 44);
        transform.scale.set(1, 1, 1);
        transform.updateMatrix();
        markerRef.current.setMatrixAt(index, transform.matrix);
        index += 1;
      }
    }
    towerRef.current.instanceMatrix.needsUpdate = true;
    markerRef.current.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < 36; i += 1) {
      const x = ((i * 83) % 880) - 440;
      const z = ((i * 151) % 880) - 440;
      const height = 3.5 + ((i * 17) % 5);
      transform.position.set(x, height / 2, z);
      transform.scale.set(.8, height, .8);
      transform.updateMatrix();
      trunkRef.current.setMatrixAt(i, transform.matrix);
      transform.position.set(x, height + 2.2, z);
      transform.scale.set(2.4 + (i % 3) * .4, 3.4 + (i % 4) * .35, 2.4 + (i % 3) * .4);
      transform.updateMatrix();
      crownRef.current.setMatrixAt(i, transform.matrix);
    }
    trunkRef.current.instanceMatrix.needsUpdate = true;
    crownRef.current.instanceMatrix.needsUpdate = true;
  }, []);

  useFrame(({ camera }) => {
    if (!groupRef.current) return;
    groupRef.current.position.x = Math.round(camera.position.x / 910) * 910;
    groupRef.current.position.z = Math.round(camera.position.z / 910) * 910;
  });

  return (
    <group ref={groupRef}>
      <instancedMesh ref={towerRef} args={[undefined, undefined, 25]}>
        <boxGeometry args={[5, 1, 5]} />
        <meshStandardMaterial color="#506673" roughness={.82} />
      </instancedMesh>
      <instancedMesh ref={markerRef} args={[undefined, undefined, 25]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[5, 6, 20]} />
        <meshBasicMaterial color="#c8a75a" />
      </instancedMesh>
      <instancedMesh ref={trunkRef} args={[undefined, undefined, 36]}>
        <cylinderGeometry args={[.35,.5,1,6]} />
        <meshStandardMaterial color="#594b36" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={crownRef} args={[undefined, undefined, 36]}>
        <coneGeometry args={[1,1,7]} />
        <meshStandardMaterial color="#315f48" roughness={.96} />
      </instancedMesh>
    </group>
  );
};
