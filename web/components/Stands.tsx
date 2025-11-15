"use client";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Direction } from "@/types/events";
import { useSeatHighlightStore, DEFAULT_SEAT_COLOR } from "@/lib/seatHighlightStore";
import { useFrame } from "@react-three/fiber";

const HALF = 5; // リング半径
const GAP = 2;
const P = 1.0; // 座席ピッチ
const H = 0.3; // 段差

export const SEAT_SIZE: [number, number, number] = [0.8, 0.5, 0.8];

export function seatAddressToWorld(dir: Direction, row: number, col: number): THREE.Vector3 {
  // +Z が North (N)
  const xCol = (col - 4.5) * P;
  const y = row * H;
  switch (dir) {
    case "N":
      return new THREE.Vector3(xCol, y, + (HALF + GAP) + row * P);
    case "S":
      return new THREE.Vector3(xCol, y, - (HALF + GAP) - row * P);
    case "E":
      return new THREE.Vector3(+ (HALF + GAP) + row * P, y, xCol);
    case "W":
      return new THREE.Vector3(- (HALF + GAP) - row * P, y, xCol);
    default:
      return new THREE.Vector3(0, 0, 0);
  }
}

function StandsSide({ dir }: { dir: Direction }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = 100; // 10x10
  const geom = useMemo(() => new THREE.BoxGeometry(...SEAT_SIZE), []);
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        // ベースは白（インスタンスカラーをそのまま出す）
        color: "#ffffff",
        roughness: 0.9,
        metalness: 0.0
      }),
    []
  );
  const version = useSeatHighlightStore((s) => s.version);
  const getColorForSeat = useSeatHighlightStore((s) => s.getColorForSeat);
  const lastVersionRef = useRef<number>(-1);

  useEffect(() => {
    if (!ref.current) return;
    const temp = new THREE.Object3D();
    let i = 0;
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 10; col++) {
        const pos = seatAddressToWorld(dir, row, col);
        temp.position.set(pos.x, pos.y, pos.z);
        temp.updateMatrix();
        ref.current.setMatrixAt(i++, temp.matrix);
      }
    }
    ref.current.instanceMatrix.needsUpdate = true;
    // 初期色を全席に適用（即時に見えるようにする）
    const c = new THREE.Color(DEFAULT_SEAT_COLOR);
    for (let idx = 0; idx < count; idx++) {
      ref.current.setColorAt(idx, c);
    }
    const instColor = (ref.current as unknown as { instanceColor?: { needsUpdate: boolean } }).instanceColor;
    if (instColor) instColor.needsUpdate = true;
  }, [dir]);

  // ハイライト色を反映する共通関数
  const applyColors = () => {
    if (!ref.current) return;
    const c = new THREE.Color();
    let i = 0;
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 10; col++) {
        const colorHex = getColorForSeat({ dir, row, col });
        c.set(colorHex);
        ref.current.setColorAt(i++, c);
      }
    }
    const instColor = (ref.current as unknown as { instanceColor?: { needsUpdate: boolean } }).instanceColor;
    if (instColor) instColor.needsUpdate = true;
  };

  // ハイライト色を反映（store の version が変わった瞬間に更新）
  useEffect(() => {
    applyColors();
    lastVersionRef.current = version;
  }, [dir, version, getColorForSeat]);

  // 万が一の取りこぼし防止（フレーム境界で version 変化を検知して反映）
  useFrame(() => {
    if (lastVersionRef.current !== version) {
      applyColors();
      lastVersionRef.current = version;
    }
  });

  return <instancedMesh ref={ref} args={[geom, mat, count]} />;
}

export function Stands() {
  // 期限切れのハイライトを定期的に掃除
  const cleanupExpired = useSeatHighlightStore((s) => s.cleanupExpired);
  useFrame(() => {
    cleanupExpired();
  });
  return (
    <group>
      <StandsSide dir="N" />
      <StandsSide dir="E" />
      <StandsSide dir="S" />
      <StandsSide dir="W" />
    </group>
  );
}


