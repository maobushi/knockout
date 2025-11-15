import { create } from "zustand";
import type { Direction, SeatAddress } from "@/types/events";

export const DEFAULT_SEAT_COLOR = "#666666";

export type SeatKey = `${Direction}:${number}:${number}`;

export function toSeatKey(seat: SeatAddress): SeatKey {
  return `${seat.dir}:${seat.row}:${seat.col}`;
}

interface SeatColorEntry {
  color: string;
  until?: number; // epoch ms; undefined = permanent
}

interface SeatHighlightState {
  version: number;
  entries: Record<SeatKey, SeatColorEntry[]>;
  highlightSeat: (seat: SeatAddress, color: string, ttlSec?: number) => void;
  getColorForSeat: (seat: SeatAddress) => string;
  cleanupExpired: (nowMs?: number) => void;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.trim().toLowerCase();
  let s = h.startsWith("#") ? h.slice(1) : h;
  if (s.length === 3) {
    s = s.split("").map((c) => c + c).join("");
  }
  const num = parseInt(s, 16);
  const r = ((num >> 16) & 0xff) / 255;
  const g = ((num >> 8) & 0xff) / 255;
  const b = (num & 0xff) / 255;
  return [r, g, b];
}

function rgbToHex(rgb: [number, number, number]): string {
  const [r, g, b] = rgb.map((v) => clamp01(v));
  const ri = Math.round(r * 255);
  const gi = Math.round(g * 255);
  const bi = Math.round(b * 255);
  const to2 = (n: number) => n.toString(16).padStart(2, "0");
  return `#${to2(ri)}${to2(gi)}${to2(bi)}`;
}

function screenCombine(colors: Array<[number, number, number]>): [number, number, number] {
  // 画面合成: out = 1 - Π(1 - c_k)
  let rMul = 1, gMul = 1, bMul = 1;
  for (const [r, g, b] of colors) {
    rMul *= (1 - clamp01(r));
    gMul *= (1 - clamp01(g));
    bMul *= (1 - clamp01(b));
  }
  return [1 - rMul, 1 - gMul, 1 - bMul];
}

export const useSeatHighlightStore = create<SeatHighlightState>((set, get) => ({
  version: 0,
  entries: {},
  highlightSeat: (seat, color, ttlSec) => {
    const key = toSeatKey(seat);
    const until = ttlSec ? Date.now() + ttlSec * 1000 : undefined;
    const curr = get().entries;
    const list = curr[key] ? [...curr[key]] : [];
    list.push({ color, until });
    set({ entries: { ...curr, [key]: list }, version: get().version + 1 });
  },
  getColorForSeat: (seat) => {
    const key = toSeatKey(seat);
    const list = get().entries[key];
    if (!list || list.length === 0) return DEFAULT_SEAT_COLOR;
    const now = Date.now();
    const active = list.filter((p) => !p.until || p.until > now);
    if (active.length === 0) return DEFAULT_SEAT_COLOR;
    // 同色の重なりは累乗で強調、異色は screen 合成
    const colorCounts = new Map<string, number>();
    for (const p of active) {
      const key = p.color.trim().toLowerCase();
      colorCounts.set(key, (colorCounts.get(key) ?? 0) + 1);
    }
    const expanded: Array<[number, number, number]> = [];
    for (const [hex, count] of colorCounts.entries()) {
      const c = hexToRgb(hex);
      // 同色の重なり: out = 1 - (1 - c)^count を1色分の結果として扱う
      const r = 1 - Math.pow(1 - c[0], count);
      const g = 1 - Math.pow(1 - c[1], count);
      const b = 1 - Math.pow(1 - c[2], count);
      expanded.push([r, g, b]);
    }
    const out = screenCombine(expanded);
    return rgbToHex(out);
  },
  cleanupExpired: (nowMs) => {
    const now = nowMs ?? Date.now();
    const curr = get().entries;
    let changed = false;
    const next: Record<SeatKey, SeatColorEntry[]> = {};
    for (const [k, arr] of Object.entries(curr)) {
      const filtered = (arr as SeatColorEntry[]).filter((p) => !p.until || p.until > now);
      if (filtered.length > 0) {
        next[k as SeatKey] = filtered;
      }
      if (filtered.length !== (arr as SeatColorEntry[]).length) {
        changed = true;
      }
    }
    if (changed) {
      set({ entries: next, version: get().version + 1 });
    }
  }
}));


