import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { rt } from "../game/runtime";
import { tick } from "../game/flow/session";
import { Landmarks, Ocean, SkyAndLights, Terrain, Vegetation, useSeaMaterial } from "./Environment";
import { Beacons, Crate, ResourceNodes } from "./Nodes";
import { Kai, Player } from "./Characters";
import { Buildings } from "./Buildings";
import { Celebration } from "./Effects";
import { CameraRig } from "./CameraRig";
import { useGame } from "../game/store";
import { Phase3World } from "./Phase3World";

/** Renderer stats for the test hook (draw calls / triangles per frame). */
export const perf = { calls: 0, triangles: 0, fps: 0 };

function Clock() {
  const frames = useRef({ n: 0, t: 0 });
  // Runs before everything else each frame.
  useFrame((state, dt) => {
    const d = Math.min(dt, 0.1);
    rt.time += d;
    tick(d);
    perf.calls = state.gl.info.render.calls;
    perf.triangles = state.gl.info.render.triangles;
    const f = frames.current;
    f.n++;
    f.t += dt;
    if (f.t > 1) {
      perf.fps = Math.round(f.n / f.t);
      f.n = 0;
      f.t = 0;
    }
  }, -10);
  return null;
}

function World() {
  const seaMat = useSeaMaterial();
  const inCave = useGame((s) => s.inCave);
  return (
    <>
      <Clock />
      <SkyAndLights seaMat={seaMat} />
      <group visible={!inCave}>
        <Terrain />
        <Ocean seaMat={seaMat} />
        <Vegetation />
        <Landmarks />
        <Crate />
      </group>
      <Phase3World />
      <ResourceNodes />
      <Beacons />
      <Buildings />
      <Player />
      <Kai />
      <Celebration />
      <CameraRig />
    </>
  );
}

export function GameScene() {
  return (
    <Canvas
      className="scene"
      dpr={[1, 1.5]}
      gl={{ antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: false }}
      camera={{ fov: 55, near: 0.1, far: 900, position: [0, 6, 24] }}
      flat
    >
      <World />
    </Canvas>
  );
}
