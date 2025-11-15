"use client";
import { Line } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useControlsStore } from "@/lib/controlsStore";

const HALF = 5;
const Y = 0;

export function Ring() {
  const lineWidth = useControlsStore((s) => s.lineWidth);
  const setCameraHeight = useControlsStore((s) => s.setCameraHeight);
  const setIsCameraDragging = useControlsStore((s) => s.setIsCameraDragging);
  const setCameraRadius = useControlsStore((s) => s.setCameraRadius);
  const setCameraAngle = useControlsStore((s) => s.setCameraAngle);

  const dragState = useRef<{ isDragging: boolean }>({
    isDragging: false
  });

  const lines = useMemo(() => {
    const l: { start: [number, number, number]; end: [number, number, number] }[] =
      [];
    // 外枠（四辺）
    l.push({ start: [-HALF, Y, -HALF], end: [HALF, Y, -HALF] });
    l.push({ start: [-HALF, Y, HALF], end: [HALF, Y, HALF] });
    l.push({ start: [-HALF, Y, -HALF], end: [-HALF, Y, HALF] });
    l.push({ start: [HALF, Y, -HALF], end: [HALF, Y, HALF] });
    // 内部グリッド（10×10）→ 線は11本ずつ
    for (let i = -HALF; i <= HALF; i++) {
      l.push({ start: [-HALF, Y, i], end: [HALF, Y, i] });
      l.push({ start: [i, Y, -HALF], end: [i, Y, HALF] });
    }
    return l;
  }, []);

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    dragState.current.isDragging = true;
    setIsCameraDragging(true);
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!dragState.current.isDragging) return;
    e.stopPropagation();
    const state = useControlsStore.getState();
    const deltaY = -e.movementY; // 上方向で高さアップ
    const deltaX = e.movementX; // 右方向のドラッグ

    // 高さを常に縦ドラッグで調整
    const heightSensitivity = 0.05;
    const nextHeight = Math.min(30, Math.max(2, state.cameraHeight + deltaY * heightSensitivity));
    setCameraHeight(nextHeight);

    if (e.shiftKey) {
      // シフト + 横ドラッグ: 半径
      const radiusSensitivity = 0.08;
      const nextRadius = Math.min(80, Math.max(6, state.cameraRadius + deltaX * radiusSensitivity));
      setCameraRadius(nextRadius);
    } else {
      // 横ドラッグ: 角度スクラブ（ラジアン）
      const angleSensitivity = 0.01;
      setCameraAngle(state.cameraAngle + deltaX * angleSensitivity);
    }
  };

  const endDrag = (e?: ThreeEvent<PointerEvent>) => {
    if (e) e.stopPropagation();
    if (!dragState.current.isDragging) return;
    dragState.current.isDragging = false;
    setIsCameraDragging(false);
  };

  const handleWheel = (e: ThreeEvent<WheelEvent>) => {
    e.stopPropagation();
    const state = useControlsStore.getState();

    if (e.ctrlKey) {
      // ピンチ相当: 半径を強めに
      const pinchSensitivity = 0.12;
      const next = Math.min(80, Math.max(6, state.cameraRadius + e.deltaY * pinchSensitivity));
      setCameraRadius(next);
      return;
    }

    // 2本指スクロール: 縦=高さ, 横=角度
    const heightWheelSensitivity = 0.01;
    const angleWheelSensitivity = 0.005;

    const nextHeight = Math.min(30, Math.max(2, state.cameraHeight + -e.deltaY * heightWheelSensitivity));
    setCameraHeight(nextHeight);
    setCameraAngle(state.cameraAngle + e.deltaX * angleWheelSensitivity);
  };

  return (
    <group>
      {/* ドラッグしやすい透明プレーン */}
      <mesh
        position={[0, Y + 0.01, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerOut={endDrag}
        onPointerLeave={endDrag}
        onWheel={handleWheel}
      >
        <planeGeometry args={[HALF * 2.4, HALF * 2.4]} />
        <meshBasicMaterial
          transparent
          opacity={0}
          color="#ffffff"
          side={THREE.DoubleSide}
        />
      </mesh>

      {lines.map((seg, idx) => (
        <Line
          key={idx}
          points={[seg.start, seg.end]}
          color="#ffffff"
          lineWidth={lineWidth}
          dashed={false}
          transparent
        />
      ))}
    </group>
  );
}


