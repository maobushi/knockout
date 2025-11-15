"use client"

import { useMemo, useState } from "react"
import { useWallet } from "@suiet/wallet-kit"
import { AllDefaultWallets, PresetWallet } from "@suiet/wallet-sdk"
import { useHaptic } from "use-haptic"

export default function SuietConnectButton() {
  const { connected, account, select, disconnect } = useWallet()!
  const [open, setOpen] = useState(false)
  const { triggerHaptic } = useHaptic()
  const haptic = () => {
    try {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.([50, 30, 50])
      else triggerHaptic()
    } catch {
      try {
        triggerHaptic()
      } catch {}
    }
  }
  const walletOptions = useMemo(() => {
    // Use default wallet presets from SDK
    const seen = new Set<string>()
    return (AllDefaultWallets || []).filter((w) => {
      if (!w?.name || seen.has(w.name)) return false
      seen.add(w.name)
      return true
    })
  }, [])

  const trySelect = async (namesOrExact?: string[] | string) => {
    try {
      const names = Array.isArray(namesOrExact)
        ? namesOrExact
        : typeof namesOrExact === "string"
        ? [namesOrExact]
        : []
      const candidates = names.length
        ? names
        : [
            // prefer common Sui wallets first
            PresetWallet.SLUSH_WALLET,
            PresetWallet.SLUSH_WEB_WALLET,
            PresetWallet.SUIET_WALLET,
            // fall back to all presets
            ...walletOptions.map((w) => w.name),
          ]
      
      // モバイル環境の検出
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      
      for (const n of candidates) {
        try {
          // select関数を呼び出す前に少し待機（モバイルでのDeep Link処理を確実にするため）
          if (isMobile) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
          await select?.(n)
          setOpen(false)
          return
        } catch (error) {
          console.warn(`Failed to select wallet ${n}:`, error);
          // try next
        }
      }
      console.warn("No matching wallet adapter found for: ", names)
      setOpen(false)
    } catch (error) {
      console.error("Error in trySelect:", error);
    }
  }

  if (connected) {
    return null
  }

  return (
    <div className="relative z-50">
      <button
        onClick={() => {
          haptic()
          setOpen((v) => !v)
        }}
        className="flex h-12 items-center justify-center gap-2 rounded-full bg-black px-5 text-white transition-colors hover:bg-[#383838] dark:bg-white dark:text-black dark:hover:bg-[#e5e5e5]"
      >
        Select Wallet
      </button>
      {open ? (
        <div className="absolute z-[100] mt-2 w-64 rounded-2xl border border-black/10 bg-white p-2 shadow-2xl dark:border-white/15 dark:bg-black">
          <ul className="max-h-80 overflow-auto">
            {walletOptions.map((w) => (
              <li key={w.name}>
                <button
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    haptic();
                    // モバイル環境では、ユーザーインタラクションから直接Deep Linkを開く
                    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                    if (isMobile) {
                      // モバイルでは、少し待機してからselectを呼び出す（Deep Link処理を確実にするため）
                      setTimeout(() => {
                        trySelect(w.name);
                      }, 50);
                    } else {
                      await trySelect(w.name);
                    }
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-black/[.04] dark:hover:bg-[#1a1a1a]"
                >
                  <span className="text-sm">{w.label || w.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}


