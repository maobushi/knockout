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
  entries: Record<SeatKey, SeatColorEntry>;
  highlightSeat: (seat: SeatAddress, color: string, ttlSec?: number) => void;
  getColorForSeat: (seat: SeatAddress) => string;
  cleanupExpired: (nowMs?: number) => void;
}

export const useSeatHighlightStore = create<SeatHighlightState>((set, get) => ({
  version: 0,
  entries: {},
  highlightSeat: (seat, color, ttlSec) => {
    const key = toSeatKey(seat);
    const until = ttlSec ? Date.now() + ttlSec * 1000 : undefined;
    const next = { ...get().entries, [key]: { color, until } };
    set({ entries: next, version: get().version + 1 });
  },
  getColorForSeat: (seat) => {
    const key = toSeatKey(seat);
    const e = get().entries[key];
    if (!e) return DEFAULT_SEAT_COLOR;
    if (e.until && e.until < Date.now()) return DEFAULT_SEAT_COLOR;
    return e.color;
  },
  cleanupExpired: (nowMs) => {
    const now = nowMs ?? Date.now();
    const curr = get().entries;
    let changed = false;
    const next: Record<SeatKey, SeatColorEntry> = {};
    for (const [k, v] of Object.entries(curr)) {
      if (v.until && v.until < now) {
        changed = true;
        continue;
      }
      next[k as SeatKey] = v;
    }
    if (changed) {
      set({ entries: next, version: get().version + 1 });
    }
  }
}));


