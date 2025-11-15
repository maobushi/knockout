"use client";
import { useFrame, useThree } from "@react-three/fiber";
import { useControlsStore } from "@/lib/controlsStore";
import * as THREE from "three";

const CENTER = new THREE.Vector3(0, 0, 0);

export function CameraRig() {
  const { camera } = useThree();

  useFrame((_, delta) => {
    const state = useControlsStore.getState();
    let angle = state.cameraAngle;
    if (!state.isCameraDragging) {
      angle += state.cameraAngularSpeed * delta;
      state.setCameraAngle(angle);
    }
    const x = Math.cos(angle) * state.cameraRadius;
    const z = Math.sin(angle) * state.cameraRadius;
    const y = state.cameraHeight;
    camera.position.set(x, y, z);
    camera.lookAt(CENTER);
  });
  return null;
}


