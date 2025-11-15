import { create } from "zustand";
import type { EventMessage } from "@/types/events";

interface DanmakuEventState {
  events: EventMessage[];
  addEvent: (event: EventMessage) => void;
  clearEvents: () => void;
}

export const useDanmakuEventStore = create<DanmakuEventState>((set) => ({
  events: [],
  addEvent: (event) => {
    set((state) => ({
      events: [...state.events, event],
    }));
  },
  clearEvents: () => {
    set({ events: [] });
  },
}));

