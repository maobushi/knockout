/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@suiet/wallet-kit";
import { useHaptic } from "use-haptic";

export default function SeatPage() {
  const router = useRouter();
  const wallet = useWallet();
  const connected = !!wallet?.connected;
  const { triggerHaptic } = useHaptic();

  useEffect(() => {
    if (!connected) {
      router.replace("/");
    }
  }, [connected]);

  const seats = useMemo<number[]>(() => {
    return Array.from({ length: 100 }, (_, i) => i + 1);
  }, []);

  const handleSelect = (seat: number) => {
    try {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.([50, 30, 50]);
      else triggerHaptic();
    } catch {
      try {
        triggerHaptic();
      } catch {}
    }
    router.push(`/team?seat=${seat}`);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center gap-8 py-10 px-6 bg-white dark:bg-black">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
          座席を選択してください
        </h1>
        <div
          className="grid w-full"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(10, minmax(0, 1fr))",
            gap: "10px",
          }}
        >
          {seats.map((n) => (
            <button
              key={n}
              onClick={() => handleSelect(n)}
              className="aspect-square rounded-lg border border-black/[.12] text-sm text-black hover:bg-black/[.05] dark:border-white/[.2] dark:text-zinc-200 dark:hover:bg-[#1a1a1a]"
            >
              {n}
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}

