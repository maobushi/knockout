"use client";
import { Line } from "@react-three/drei";
import { useMemo } from "react";
import { useControlsStore } from "@/lib/controlsStore";

const HALF = 5;
const Y = 4;

export function Ring() {
  const lineWidth = useControlsStore((s) => s.lineWidth);

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

  return (
    <group>
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


