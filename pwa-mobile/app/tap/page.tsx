/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useWallet } from "@suiet/wallet-kit";
import { useHaptic } from "use-haptic";

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

function TapPageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const wallet = useWallet();
  const connected = !!wallet?.connected;
  const [isRed, setIsRed] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const { triggerHaptic } = useHaptic();

  const seat = useMemo(() => {
    const raw = params.get("seat");
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n >= 1 && n <= 100 ? n : null;
  }, [params]);

  const team = useMemo<"A" | "B" | null>(() => {
    const raw = (params.get("team") || "").toUpperCase();
    return raw === "A" || raw === "B" ? (raw as "A" | "B") : null;
  }, [params]);

  useEffect(() => {
    if (!connected) {
      router.replace("/");
      return;
    }
    if (seat == null) {
      router.replace("/seat");
      return;
    }
    if (team == null) {
      router.replace(`/team?seat=${seat ?? ""}`);
      return;
    }
  }, [connected, seat, team]);

  const vibratePattern1 = useCallback(() => {
    try {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        // Vibration pattern 1: short-pause-short
        // Reference: Progressier Vibration API patterns
        navigator.vibrate?.([50, 30, 50]);
        return;
      }
    } catch {
      // fall through to audio fallback
    }
    // Try library-based haptic (Safari 18+ input[switch] trick)
    try {
      triggerHaptic();
      return;
    } catch {
      // fall through to audio fallback
    }
    // iOS Safari fallback: use a very short, low-volume audio buzz to emulate haptic
    try {
      if (typeof window === "undefined") return;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new Ctx();
      }
      const ctx = audioCtxRef.current!;
      if (ctx.state === "suspended") {
        // resume on user gesture
        void ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      // low frequency square to mimic a buzz
      osc.type = "square";
      osc.frequency.value = 100;
      gain.gain.value = 0.0001; // start almost silent
      osc.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;
      osc.start(now);
      // Envelope ~60-80ms total, quick rise/fall
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.02, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
      osc.stop(now + 0.08);
      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch {
          // noop
        }
      };
    } catch {
      // noop
    }
  }, [triggerHaptic]);

  const onTap = useCallback(() => {
    vibratePattern1();
    setIsRed(true);
    setTimeout(() => {
      setIsRed(false);
    }, 600);
  }, [vibratePattern1]);

  return (
    <div
      className={`flex min-h-screen items-center justify-center font-sans ${
        isRed ? "bg-red-600" : "bg-black"
      }`}
      style={{
        transition: isRed 
          ? 'background-color 0ms cubic-bezier(1, 0, 0, 1)' 
          : 'background-color 1000ms cubic-bezier(0.05, 0, 0.05, 1)',
      }}
      onClick={onTap}
      onTouchStart={onTap}
      role="button"
      aria-label="tap-area"
      tabIndex={0}
    >
      <main className="flex min-h-screen w-full flex-col items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-40 w-40 rounded-full border-4 border-white/10 animate-pulse"></div>
              <div className="absolute h-48 w-48 rounded-full border-2 border-white/5 animate-pulse" style={{ animationDelay: "0.5s" }}></div>
            </div>
            <div className="relative z-10">
              <div className={`text-9xl font-black text-white tracking-tighter drop-shadow-2xl transition-all duration-300 ${
                isRed ? "scale-110 text-red-50" : "scale-100"
              }`}>
                TAP
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function TapPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <TapPageContent />
    </Suspense>
  );
}

