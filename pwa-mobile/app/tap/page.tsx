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

const DEFAULT_BASE = 1.05;
const LEVERAGE_BASE =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_LEVERAGE_BASE
    ? Number(process.env.NEXT_PUBLIC_LEVERAGE_BASE)
    : DEFAULT_BASE;

function TapPageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const wallet = useWallet();
  const connected = !!wallet?.connected;
  const [taps, setTaps] = useState(0);
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
    setTaps((t) => t + 1);
    vibratePattern1();
  }, []);

  const multiplier = useMemo(() => {
    const base = Number.isFinite(LEVERAGE_BASE) ? LEVERAGE_BASE : DEFAULT_BASE;
    return Math.pow(base, taps);
  }, [taps]);

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black"
      onClick={onTap}
      onTouchStart={onTap}
      role="button"
      aria-label="tap-area"
      tabIndex={0}
    >
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-center gap-8 py-10 px-6 bg-white dark:bg-black">
        <div className="text-center">
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            Seat: {seat ?? "-"} | Team: {team ?? "-"}
          </div>
          <h1 className="mt-4 text-6xl font-bold text-black dark:text-zinc-50">
            {multiplier.toFixed(3)}x
          </h1>
          <div className="mt-2 text-lg text-zinc-700 dark:text-zinc-300">
            taps: {taps}
          </div>
        </div>
        <p className="mt-6 text-center text-zinc-600 dark:text-zinc-400">
          画面のどこでもタップすると倍率が上昇します（対応端末では振動）
        </p>
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

