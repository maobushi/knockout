"use client";
import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import { useControlsStore } from "@/lib/controlsStore";
import * as THREE from "three";

const CENTER = new THREE.Vector3(0, 4, 0);
const RADIUS = 22;

export function CameraRig() {
  const { camera } = useThree();
  const angleRef = useRef(0);
  const speed = useControlsStore((s) => s.cameraAngularSpeed);

  useFrame((_, delta) => {
    angleRef.current += speed * delta; // 時計回り
    const x = Math.cos(angleRef.current) * RADIUS;
    const z = Math.sin(angleRef.current) * RADIUS;
    const y = 10;
    camera.position.set(x, y, z);
    camera.lookAt(CENTER);
  });
  return null;
}


