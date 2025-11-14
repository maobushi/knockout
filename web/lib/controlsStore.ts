import { create } from "zustand";

interface ControlsState {
  lineWidth: number;
  cameraAngularSpeed: number;
  danmakuSpeed: number;
  danmakuTTL: number;
  danmakuFontSize: number;
  danmakuColor: string;
  danmakuMaxCount: number;
  setLineWidth: (v: number) => void;
  setCameraAngularSpeed: (v: number) => void;
  setDanmakuSpeed: (v: number) => void;
  setDanmakuTTL: (v: number) => void;
  setDanmakuFontSize: (v: number) => void;
  setDanmakuColor: (v: string) => void;
  setDanmakuMaxCount: (v: number) => void;
}

export const useControlsStore = create<ControlsState>((set) => ({
  lineWidth: 2.0,
  cameraAngularSpeed: 0.08,
  danmakuSpeed: 1.2,
  danmakuTTL: 8,
  danmakuFontSize: 0.6,
  danmakuColor: "#ffffff",
  danmakuMaxCount: 500,
  setLineWidth: (v) => set({ lineWidth: v }),
  setCameraAngularSpeed: (v) => set({ cameraAngularSpeed: v }),
  setDanmakuSpeed: (v) => set({ danmakuSpeed: v }),
  setDanmakuTTL: (v) => set({ danmakuTTL: v }),
  setDanmakuFontSize: (v) => set({ danmakuFontSize: v }),
  setDanmakuColor: (v) => set({ danmakuColor: v }),
  setDanmakuMaxCount: (v) => set({ danmakuMaxCount: v })
}));


