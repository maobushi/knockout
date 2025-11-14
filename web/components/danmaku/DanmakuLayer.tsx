"use client";
import { Billboard, Text } from "@react-three/drei";
import { useEffect, useRef, useState } from "react";
import { getSocket } from "@/lib/socket-client";
import type { EventMessage } from "@/types/events";
import { seatAddressToWorld } from "@/components/Stands";
import { useControlsStore } from "@/lib/controlsStore";
import { useSeatHighlightStore } from "@/lib/seatHighlightStore";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

type DanmakuItem = {
  id: string;
  text: string; // レンダリング用（縦書きに加工済み）
  color: string;
  fontSize: number;
  pos: THREE.Vector3;
  drift: THREE.Vector3;
  speed: number;
  ttl: number;
  age: number;
};

let ID_SEQ = 1;
function makeId(): string {
  // 可能ならUUIDを使い、無ければ時間+カウンタで一意化
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return (crypto as { randomUUID: () => string }).randomUUID();
    }
  } catch {
    // noop
  }
  return `${Date.now()}-${ID_SEQ++}`;
}

function segmentGraphemes(input: string): string[] {
  try {
    // Intl.Segmenter があれば結合文字も崩さず分割
    type SegmenterGranularity = "grapheme" | "word" | "sentence";
    interface IntlSegment {
      segment: string;
    }
    interface IntlSegmenter {
      segment(str: string): Iterable<IntlSegment>;
    }
    type IntlWithSegmenter = typeof Intl & {
      Segmenter?: new (locale: string, opts: { granularity: SegmenterGranularity }) => IntlSegmenter;
    };
    const I = Intl as IntlWithSegmenter;
    if (typeof I !== "undefined" && I.Segmenter) {
      const seg = new I.Segmenter!("ja", { granularity: "grapheme" });
      return Array.from(seg.segment(input), (s) => s.segment);
    }
  } catch {
    // noop
  }
  // Fallback: Array.from はサロゲートペアを考慮
  return Array.from(input);
}

function toVerticalText(input: string): string {
  const segments = segmentGraphemes(input);
  return segments.join("\n");
}

export function DanmakuLayer() {
  const defaultSpeed = useControlsStore((s) => s.danmakuSpeed);
  const defaultTTL = useControlsStore((s) => s.danmakuTTL);
  const defaultFont = useControlsStore((s) => s.danmakuFontSize);
  const defaultColor = useControlsStore((s) => s.danmakuColor);
  const maxCount = useControlsStore((s) => s.danmakuMaxCount);
  const highlightSeat = useSeatHighlightStore((s) => s.highlightSeat);

  const [items, setItems] = useState<DanmakuItem[]>([]);
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    const socket = getSocket();
    const onEvent = (msg: EventMessage) => {
      const origin = seatAddressToWorld(msg.seat.dir, msg.seat.row, msg.seat.col);
      const headOffset = 1.6;
      origin.y += headOffset;
      // y軸（上方向）のみに移動するため、ドリフトは0に固定
      const drift = new THREE.Vector3(0, 0, 0);
      const item: DanmakuItem = {
        id: makeId(),
        text: toVerticalText(msg.text),
        color: msg.color ?? defaultColor,
        fontSize: msg.fontSize ?? defaultFont,
        pos: origin,
        drift,
        speed: msg.speed ?? defaultSpeed,
        ttl: msg.ttl ?? defaultTTL,
        age: 0
      };
      // 座席のカラーを弾幕色でハイライト（TTL 期間）
      try {
        highlightSeat(msg.seat, item.color, item.ttl);
      } catch {
        // noop
      }
      setItems((prev) => {
        const next = [...prev, item];
        if (next.length > maxCount) next.shift();
        return next;
      });
    };
    socket.on("event", onEvent);
    return () => {
      socket.off("event", onEvent);
    };
  }, [defaultColor, defaultFont, defaultSpeed, defaultTTL, maxCount, highlightSeat]);

  useFrame((_, delta) => {
    if (itemsRef.current.length === 0) return;
    const updated = itemsRef.current
      .map((it) => {
        const n = { ...it };
        n.age += delta;
        n.pos = n.pos
          .clone()
          .add(new THREE.Vector3(0, n.speed * delta, 0))
          .add(n.drift.clone().multiplyScalar(delta));
        return n;
      })
      .filter((it) => it.age <= it.ttl);
    if (updated.length !== itemsRef.current.length) {
      setItems(updated);
    } else {
      // 位置の差分があれば更新
      for (let i = 0; i < updated.length; i++) {
        if (!updated[i].pos.equals(itemsRef.current[i].pos)) {
          setItems(updated);
          break;
        }
      }
    }
  });

  return (
    <group>
      {items.map((it) => {
        const opacity = Math.max(0, 1 - it.age / it.ttl);
        return (
          <Billboard key={it.id} position={it.pos.toArray()} follow>
            <Text
              color={it.color}
              fontSize={it.fontSize}
              anchorX="center"
              anchorY="middle"
              lineHeight={1.1}
              outlineWidth={0}
              material-opacity={opacity}
              material-transparent
              material-depthTest={false}
            >
              {it.text}
            </Text>
          </Billboard>
        );
      })}
    </group>
  );
}


