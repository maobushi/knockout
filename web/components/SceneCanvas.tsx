"use client";
import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { CameraRig } from "@/components/CameraRig";
import { Ring } from "@/components/Ring";
import { Stands } from "@/components/Stands";
import { DanmakuLayer } from "@/components/danmaku/DanmakuLayer";

export default function SceneCanvas() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#000"
      }}
    >
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true }}
        onCreated={({ gl, scene }) => {
          gl.setClearColor("#000", 1);
          scene.matrixAutoUpdate = true;
        }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 15, 10]} intensity={0.8} />
        <Suspense fallback={null}>
          <CameraRig />
          <Ring />
          <Stands />
          <DanmakuLayer />
        </Suspense>
      </Canvas>
    </div>
  );
}


