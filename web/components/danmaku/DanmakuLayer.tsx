"use client";
import { Text } from "@react-three/drei";
import { useEffect, useRef, useState } from "react";
import type { EventMessage } from "@/types/events";
import { seatAddressToWorld, SEAT_SIZE } from "@/components/Stands";
import { useControlsStore } from "@/lib/controlsStore";
import { useSeatHighlightStore } from "@/lib/seatHighlightStore";
import { useDanmakuEventStore } from "@/lib/danmakuEventStore";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

const TEXT_COLOR_DEFAULT = "#01FFFF"; // 既存の青系（シアン）
const TEXT_COLOR_ALT = "#B50087";     // 追加カラー
const COLOR_BOX = "#0C0403";
const MIN_HEIGHT_P = 1.0; // 直方体の最低高さ p（ワールド単位）
const LINE_HEIGHT = 1.1; // Text の lineHeight と一致させる
const EPS = 0.001; // Z-fighting 回避のための微小オフセット
const SPEED_MULTIPLIER = 8; // 現在の8倍
const START_MARGIN_UNDER_SEAT = 0.2; // 立方体が完全に座面下から始まるための余裕
const FADE_IN_ABOVE_SEAT = 0.3; // 座面より少し上までフェードイン継続
const VISIBLE_HEIGHT = 6.0; // この高さまでは不透明
const FADE_OUT_DISTANCE = 1.2; // この距離でフェードアウト
const MIN_VERTICAL_GAP = 0.1; // 直方体同士の最小縦方向間隔
const DEFAULT_TEXT =
  "0xe720ea5255a0964193f2566cfd22679f6a75cd82631d54756b0f09c2e6f2879c";

function isMagentaish(raw: string | undefined | null): boolean {
  if (!raw) return false;
  const s = raw.trim().toLowerCase();
  if (s === "#b50087" || s === "#ff00ff" || s === "#f0f" || s === "magenta" || s === "fuchsia") return true;
  if ((s.startsWith("#") && s.length === 9) && (s.startsWith("#b50087") || s.startsWith("#ff00ff"))) return true;
  // rgb/rgba 255,0,255 を許容
  if (/^rgba?\(\s*255\s*,\s*0\s*,\s*255(\s*,\s*(0?\.?\d+|1(\.0+)?))?\s*\)$/.test(s)) return true;
  return false;
}

function pickThemeColor(raw: string | undefined | null): string {
  return isMagentaish(raw) ? TEXT_COLOR_ALT : TEXT_COLOR_DEFAULT;
}

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
  seatKey: string;
  seatTopY: number;
  boxHeight: number;
  fadeInStartY: number;
  fadeInEndY: number;
  fadeOutStartY: number;
  fadeOutEndY: number;
  hasTriggered: boolean; // 座席ボックス通過時の波及を一度だけ発火
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

function estimateTextWidth(text: string, fontSize: number): number {
  // ざっくり推定：ASCII系は 0.6em、CJK系は 1.0em とみなす
  // 改行は無視（単行横書き前提）。必要なら将来的に実測へ置換（onSync + boundingBox）。
  let units = 0;
  for (const ch of text) {
    if (ch === "\n") continue;
    // ASCII可視文字
    if (/[\u0020-\u007E]/.test(ch)) {
      units += 0.6;
    } else if (/[\uFF61-\uFF9F]/.test(ch)) {
      // 半角カナ
      units += 0.6;
    } else {
      // それ以外は全角相当
      units += 1.0;
    }
  }
  // 左右の余白を少し持たせる
  const paddingEm = 0.4; // 両側合計（0.2emずつ）
  return fontSize * (units + paddingEm);
}

export function DanmakuLayer() {
  const defaultSpeed = useControlsStore((s) => s.danmakuSpeed);
  const defaultTTL = useControlsStore((s) => s.danmakuTTL);
  const defaultFont = useControlsStore((s) => s.danmakuFontSize);
  const defaultColor = useControlsStore((s) => s.danmakuColor);
  const maxCount = useControlsStore((s) => s.danmakuMaxCount);
  const highlightSeat = useSeatHighlightStore((s) => s.highlightSeat);
  const { events, clearEvents } = useDanmakuEventStore();

  const [items, setItems] = useState<DanmakuItem[]>([]);
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // 座席ごとのアクティブ要素とキュー
  const activeBySeatRef = useRef<Map<string, DanmakuItem[]>>(new Map());
  const queueBySeatRef = useRef<Map<string, EventMessage[]>>(new Map());

  function seatKeyOf(s: EventMessage["seat"]): string {
    return `${s.dir}-${s.row}-${s.col}`;
  }

  function spawnFromMessage(msg: EventMessage): DanmakuItem {
    const origin = seatAddressToWorld(msg.seat.dir, msg.seat.row, msg.seat.col);
    const seatTopY = origin.y + SEAT_SIZE[1] / 2;
    const color = msg.color ?? defaultColor;
    const fontSize = msg.fontSize ?? defaultFont;
    const textRaw = (msg.text ?? "").trim();
    const text = textRaw.length > 0 ? textRaw : DEFAULT_TEXT;

    const textWidth = estimateTextWidth(text, fontSize);
    const boxHeight = Math.max(MIN_HEIGHT_P, textWidth);

    // 立方体の中心Yが座面トップより下（立方体が完全に隠れる位置）から開始
    const startCenterY = seatTopY - boxHeight / 2 - START_MARGIN_UNDER_SEAT;
    // フェードインは開始位置から座面少し上まで
    const fadeInStartY = startCenterY;
    const fadeInEndY = seatTopY + FADE_IN_ABOVE_SEAT;
    // 可視区間の終端とフェードアウト区間
    const fadeOutStartY = seatTopY + VISIBLE_HEIGHT;
    const fadeOutEndY = fadeOutStartY + FADE_OUT_DISTANCE;

    const speed = (msg.speed ?? defaultSpeed) * SPEED_MULTIPLIER;
    // トラベル総距離に応じてTTLを決定（高さ基準）
    const totalDistance = fadeOutEndY - startCenterY;
    const ttl = Math.max(0.1, totalDistance / Math.max(0.001, speed));

    return {
      id: makeId(),
      text,
      color,
      fontSize,
      pos: new THREE.Vector3(origin.x, startCenterY, origin.z),
      drift: new THREE.Vector3(0, 0, 0),
      speed,
      ttl,
      age: 0,
      seatKey: seatKeyOf(msg.seat),
      seatTopY,
      boxHeight,
      fadeInStartY,
      fadeInEndY,
      fadeOutStartY,
    fadeOutEndY,
    hasTriggered: false
    };
  }

  // Zustandストアからイベントを読み取る（WebSocketの代わり）
  useEffect(() => {
    if (events.length === 0) return;

    // 新しいイベントを処理
    for (const msg of events) {
      const key = seatKeyOf(msg.seat);
      // すでに当該席で稼働中の直方体があればキューへ
      const actives = activeBySeatRef.current.get(key);
      if (actives && actives.length > 0) {
        const q = queueBySeatRef.current.get(key) ?? [];
        q.push(msg);
        queueBySeatRef.current.set(key, q);
        continue;
      }
      // アクティブが無ければ即スポーン
      const item = spawnFromMessage(msg);
      activeBySeatRef.current.set(key, [item]);
      setItems((prev) => {
        const next = [...prev, item];
        if (next.length > maxCount) next.shift();
        return next;
      });
    }

    // 処理したイベントをクリア
    clearEvents();
  }, [events, defaultColor, defaultFont, defaultSpeed, defaultTTL, maxCount, highlightSeat, clearEvents]);

  // 近傍波及を生成（関数宣言でホイスティング可能に）
  function triggerWaveFromSeat(seatKey: string, colorHex: string) {
    // "N-3-5"
    const [dirStr, rowStr, colStr] = seatKey.split("-");
    const dir = dirStr as EventMessage["seat"]["dir"];
    const row0 = parseInt(rowStr, 10);
    const col0 = parseInt(colStr, 10);
    // 4近傍 BFS を段階的に
    const MAX_STEPS = 5;
    const STEP_DELAY_MS = 80;
    const TTL_SEC = 0.8;
    const visited = new Set<string>();
    let currentLayer: Array<{ row: number; col: number }> = [{ row: row0, col: col0 }];
    visited.add(`${row0},${col0}`);
    const inBounds = (r: number, c: number) => r >= 0 && r < 10 && c >= 0 && c < 10;
    const pushIf = (arr: Array<{ row: number; col: number }>, r: number, c: number) => {
      const k = `${r},${c}`;
      if (!visited.has(k) && inBounds(r, c)) {
        visited.add(k);
        arr.push({ row: r, col: c });
      }
    };
    for (let step = 0; step <= MAX_STEPS; step++) {
      const seatsThisStep = currentLayer.slice();
      // delay 実行
      setTimeout(() => {
        for (const s of seatsThisStep) {
          try {
            highlightSeat({ dir, row: s.row, col: s.col }, colorHex, TTL_SEC);
          } catch {
            // noop
          }
        }
      }, step * STEP_DELAY_MS);
      // 次の層を生成
      const nextLayer: Array<{ row: number; col: number }> = [];
      for (const s of seatsThisStep) {
        pushIf(nextLayer, s.row - 1, s.col);
        pushIf(nextLayer, s.row + 1, s.col);
        pushIf(nextLayer, s.row, s.col - 1);
        pushIf(nextLayer, s.row, s.col + 1);
      }
      if (nextLayer.length === 0) break;
      currentLayer = nextLayer;
    }
  }

  useFrame((_, delta) => {
    if (itemsRef.current.length === 0) return;
    const prev = itemsRef.current;
    const updated = prev.map((it) => {
      const n = { ...it };
      n.age += delta;
      const prevY = it.pos.y;
      const nextPos = it.pos
        .clone()
        .add(new THREE.Vector3(0, n.speed * delta, 0))
        .add(n.drift.clone().multiplyScalar(delta));
      // 座席トップYの通過判定（このフレームで跨いだら波及）
      if (!n.hasTriggered && prevY < n.seatTopY && nextPos.y >= n.seatTopY) {
        const waveColor = pickThemeColor(n.color);
        triggerWaveFromSeat(n.seatKey, waveColor);
        n.hasTriggered = true;
      }
      n.pos = nextPos;
      return n;
    });
    // TTL 経過で削除（高さから算出済み）
    const alive = updated.filter((it) => it.age <= it.ttl);

    // 現在のアクティブを席ごとに再構築（下から上への流れを維持するため spawn 順序のまま）
    const nextActive = new Map<string, DanmakuItem[]>();
    for (const it of alive) {
      const arr = nextActive.get(it.seatKey) ?? [];
      arr.push(it);
      nextActive.set(it.seatKey, arr);
    }

    // 各席のキューから「連続」になるよう必要に応じて次をスポーン
    for (const [key, q] of queueBySeatRef.current.entries()) {
      if (!q || q.length === 0) continue;
      const arr = nextActive.get(key) ?? [];
      const last = arr[arr.length - 1];
      const canSpawn =
        !last ||
        last.pos.y >= last.seatTopY + last.boxHeight + MIN_VERTICAL_GAP;
      if (canSpawn) {
        const nextMsg = q.shift()!;
        if (q.length === 0) {
          queueBySeatRef.current.delete(key);
        } else {
          queueBySeatRef.current.set(key, q);
        }
        const newItem = spawnFromMessage(nextMsg);
        arr.push(newItem);
        nextActive.set(key, arr);
        alive.push(newItem);
      }
    }
    activeBySeatRef.current = nextActive;
    // 個数制限
    while (alive.length > maxCount) {
      alive.shift();
    }
    if (alive.length !== itemsRef.current.length) {
      setItems(alive);
    } else {
      // 位置の差分があれば更新
      for (let i = 0; i < alive.length; i++) {
        if (!alive[i].pos.equals(itemsRef.current[i].pos)) {
          setItems(alive);
          break;
        }
      }
    }
  });

  // 余分な二重更新ループは削除（上記 useFrame 内で通過検知を実施）

  return (
    <group>
      {items.map((it) => {
        // 表示用テキスト色（2パターンに限定）
        const renderColor = pickThemeColor(it.color);

        // 高さベースのフェード
        const y = it.pos.y;
        let opacity = 1.0;
        if (y <= it.fadeInStartY) {
          opacity = 0;
        } else if (y < it.fadeInEndY) {
          opacity = (y - it.fadeInStartY) / (it.fadeInEndY - it.fadeInStartY);
        } else if (y < it.fadeOutStartY) {
          opacity = 1;
        } else if (y < it.fadeOutEndY) {
          opacity = 1 - (y - it.fadeOutStartY) / (it.fadeOutEndY - it.fadeOutStartY);
        } else {
          opacity = 0;
        }
        opacity = Math.max(0, Math.min(1, opacity));

        const estimatedHeight = it.boxHeight;
        // 底面（XZ）は座席の正方形サイズに固定
        const boxWidth = SEAT_SIZE[0];
        const boxDepth = SEAT_SIZE[2];

        // 端からのリビール/クローズ用の可視範囲（[0..1] で高さの下端→上端）
        let revealMin = 0;
        let revealMax = 1;
        if (y <= it.fadeInStartY) {
          revealMin = 0;
          revealMax = 0;
        } else if (y < it.fadeInEndY) {
          const tIn = (y - it.fadeInStartY) / (it.fadeInEndY - it.fadeInStartY);
          revealMin = 0;
          revealMax = Math.max(0, Math.min(1, tIn));
        } else if (y < it.fadeOutStartY) {
          revealMin = 0;
          revealMax = 1;
        } else if (y < it.fadeOutEndY) {
          const tOut = (y - it.fadeOutStartY) / (it.fadeOutEndY - it.fadeOutStartY);
          // フェードアウトは上端から閉じる（上端が下がる）
          revealMin = 0;
          revealMax = Math.max(0, Math.min(1, 1 - tOut));
        } else {
          revealMin = 0;
          revealMax = 0;
        }
        // Text のクリッピング矩形を可視範囲に合わせて更新（ローカルX軸が縦方向相当）
        const x0Full = -estimatedHeight / 2;
        const x1Full = estimatedHeight / 2;
        const clipX0 = x0Full + (x1Full - x0Full) * revealMin;
        const clipX1 = x0Full + (x1Full - x0Full) * revealMax;
        const textClipRect: [number, number, number, number] = [
          clipX0,
          -boxWidth / 2,
          clipX1,
          boxWidth / 2
        ];
        // 背景直方体も同じ進行で下端固定のリビール/クローズ
        const visibleFraction = Math.max(0, Math.min(1, revealMax - revealMin));
        const boxYOffset = -estimatedHeight / 2 + (estimatedHeight * visibleFraction) / 2;

        return (
          <group key={it.id} position={it.pos.toArray()}>
            {/* 直方体（最低高さ p 以上） */}
            <mesh position={[0, boxYOffset, 0]} scale={[1, visibleFraction, 1]}>
              <boxGeometry args={[boxWidth, estimatedHeight, boxDepth]} />
              <meshStandardMaterial
                color={COLOR_BOX}
                roughness={1.0}
                metalness={0.0}
                transparent
                opacity={opacity}
              />
            </mesh>

            {/* 各側面に同一テキストを配置 */}
            {/* 前面（+Z） */}
            <group position={[0, 0, boxDepth / 2 + EPS]}>
              <Text
                color={renderColor}
                outlineColor={renderColor}
                outlineWidth={0.03}
                outlineOpacity={opacity}
                rotation={[0, 0, Math.PI / 2]}
                fontSize={it.fontSize}
                anchorX="center"
                anchorY="middle"
                lineHeight={1.0}
                material-opacity={opacity}
                material-transparent
                material-depthTest
                clipRect={textClipRect}
              >
                {it.text}
              </Text>
            </group>

            {/* 背面（-Z） */}
            <group position={[0, 0, -boxDepth / 2 - EPS]} rotation={[0, Math.PI, 0]}>
              <Text
                color={renderColor}
                outlineColor={renderColor}
                outlineWidth={0.03}
                outlineOpacity={opacity}
                rotation={[0, 0, Math.PI / 2]}
                fontSize={it.fontSize}
                anchorX="center"
                anchorY="middle"
                lineHeight={1.0}
                material-opacity={opacity}
                material-transparent
                material-depthTest
                clipRect={textClipRect}
              >
                {it.text}
              </Text>
            </group>

            {/* 左面（-X） */}
            <group position={[-boxWidth / 2 - EPS, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
              <Text
                color={renderColor}
                outlineColor={renderColor}
                outlineWidth={0.03}
                outlineOpacity={opacity}
                rotation={[0, 0, Math.PI / 2]}
                fontSize={it.fontSize}
                anchorX="center"
                anchorY="middle"
                lineHeight={1.0}
                material-opacity={opacity}
                material-transparent
                material-depthTest
                clipRect={textClipRect}
              >
                {it.text}
              </Text>
            </group>

            {/* 右面（+X） */}
            <group position={[boxWidth / 2 + EPS, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
              <Text
                color={renderColor}
                outlineColor={renderColor}
                outlineWidth={0.03}
                outlineOpacity={opacity}
                rotation={[0, 0, Math.PI / 2]}
                fontSize={it.fontSize}
                anchorX="center"
                anchorY="middle"
                lineHeight={1.0}
                material-opacity={opacity}
                material-transparent
                material-depthTest
                clipRect={textClipRect}
              >
                {it.text}
              </Text>
            </group>
          </group>
        );
      })}
    </group>
  );
}


