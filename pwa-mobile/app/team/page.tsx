/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { Suspense, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useWallet } from "@suiet/wallet-kit";
import { useHaptic } from "use-haptic";

function TeamPageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const wallet = useWallet();
  const connected = !!wallet?.connected;
  const { triggerHaptic } = useHaptic();

  const seat = useMemo(() => {
    const raw = params.get("seat");
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n >= 1 && n <= 100 ? n : null;
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
  }, [connected, seat]);

  const choose = (team: "A" | "B") => {
    if (seat == null) return;
    try {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.([50, 30, 50]);
      else triggerHaptic();
    } catch {
      try {
        triggerHaptic();
      } catch {}
    }
    router.push(`/tap?seat=${seat}&team=${team}`);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center gap-8 py-10 px-6 bg-white dark:bg-black">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
          応援するチームを選択してください
        </h1>
        <div className="flex w-full max-w-md flex-col gap-4">
          <button
            onClick={() => choose("A")}
            className="h-14 rounded-full bg-black text-white transition-colors hover:bg-[#383838] dark:bg-white dark:text-black dark:hover:bg-[#e5e5e5]"
          >
            Team A を応援する
          </button>
          <button
            onClick={() => choose("B")}
            className="h-14 rounded-full bg-black text-white transition-colors hover:bg-[#383838] dark:bg-white dark:text-black dark:hover:bg-[#e5e5e5]"
          >
            Team B を応援する
          </button>
        </div>
      </main>
    </div>
  );
}

export default function TeamPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <TeamPageContent />
    </Suspense>
  );
}
