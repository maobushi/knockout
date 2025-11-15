import { create } from "zustand";

interface ControlsState {
  lineWidth: number;
  cameraAngularSpeed: number;
  cameraHeight: number;
  isCameraDragging: boolean;
  cameraRadius: number;
  cameraAngle: number;
  afterimageEnabled: boolean;
  afterimageDamp: number;
  danmakuSpeed: number;
  danmakuTTL: number;
  danmakuFontSize: number;
  danmakuColor: string;
  danmakuMaxCount: number;
  setLineWidth: (v: number) => void;
  setCameraAngularSpeed: (v: number) => void;
  setCameraHeight: (v: number) => void;
  setIsCameraDragging: (v: boolean) => void;
  setCameraRadius: (v: number) => void;
  setCameraAngle: (v: number) => void;
  setAfterimageEnabled: (v: boolean) => void;
  setAfterimageDamp: (v: number) => void;
  setDanmakuSpeed: (v: number) => void;
  setDanmakuTTL: (v: number) => void;
  setDanmakuFontSize: (v: number) => void;
  setDanmakuColor: (v: string) => void;
  setDanmakuMaxCount: (v: number) => void;
}

export const useControlsStore = create<ControlsState>((set) => ({
  lineWidth: 2.0,
  cameraAngularSpeed: 0.08,
  cameraHeight: 10,
  isCameraDragging: false,
  cameraRadius: 22,
  cameraAngle: 0,
  afterimageEnabled: false,
  afterimageDamp: 0.94,
  danmakuSpeed: 1.2,
  danmakuTTL: 8,
  danmakuFontSize: 0.6,
  danmakuColor: "#ffffff",
  danmakuMaxCount: 500,
  setLineWidth: (v) => set({ lineWidth: v }),
  setCameraAngularSpeed: (v) => set({ cameraAngularSpeed: v }),
  setCameraHeight: (v) => set({ cameraHeight: v }),
  setIsCameraDragging: (v) => set({ isCameraDragging: v }),
  setCameraRadius: (v) => set({ cameraRadius: v }),
  setCameraAngle: (v) => set({ cameraAngle: v }),
  setAfterimageEnabled: (v) => set({ afterimageEnabled: v }),
  setAfterimageDamp: (v) => set({ afterimageDamp: v }),
  setDanmakuSpeed: (v) => set({ danmakuSpeed: v }),
  setDanmakuTTL: (v) => set({ danmakuTTL: v }),
  setDanmakuFontSize: (v) => set({ danmakuFontSize: v }),
  setDanmakuColor: (v) => set({ danmakuColor: v }),
  setDanmakuMaxCount: (v) => set({ danmakuMaxCount: v })
}));


