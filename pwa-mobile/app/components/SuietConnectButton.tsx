"use client"

import { useMemo, useState } from "react"
import { useWallet } from "@suiet/wallet-kit"
import { AllDefaultWallets, PresetWallet } from "@suiet/wallet-sdk"

export default function SuietConnectButton() {
  const { connected, account, select, disconnect } = useWallet() as any
  const [open, setOpen] = useState(false)
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
      for (const n of candidates) {
        try {
          await select?.(n)
          setOpen(false)
          return
        } catch (e) {
          // try next
        }
      }
      console.warn("No matching wallet adapter found for: ", names)
      setOpen(false)
    } catch (e) {}
  }

  if (connected) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-zinc-700 dark:text-zinc-300">
          {account?.address
            ? `${account.address.slice(0, 6)}...${account.address.slice(-4)}`
            : "Connected"}
        </span>
        <button
          onClick={() => disconnect?.()}
          className="flex h-12 items-center justify-center rounded-full border border-solid border-black/[.12] px-5 transition-colors hover:border-transparent hover:bg-black/[.05] dark:border-white/[.2] dark:hover:bg-[#1a1a1a]"
        >
          Disconnect
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-12 items-center justify-center gap-2 rounded-full bg-black px-5 text-white transition-colors hover:bg-[#383838] dark:bg-white dark:text-black dark:hover:bg-[#e5e5e5]"
      >
        Select Wallet
      </button>
      {open ? (
        <div className="absolute z-10 mt-2 w-64 rounded-2xl border border-black/10 bg-white p-2 shadow-lg dark:border-white/15 dark:bg-black">
          <ul className="max-h-80 overflow-auto">
            {walletOptions.map((w) => (
              <li key={w.name}>
                <button
                  onClick={() => trySelect(w.name)}
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


