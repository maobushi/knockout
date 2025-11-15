"use client"

import React from "react"
import { WalletProvider } from "@suiet/wallet-kit"
import { AllDefaultWallets } from "@suiet/wallet-sdk"

export default function WalletKitProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <WalletProvider
      defaultWallets={AllDefaultWallets}
      // モバイル対応のための設定
      autoConnect={false}
      // ストレージの設定（モバイルで確実に動作するように）
      storage={{
        getItem: (key: string) => {
          if (typeof window === "undefined") return null;
          try {
            return localStorage.getItem(key);
          } catch {
            return null;
          }
        },
        setItem: (key: string, value: string) => {
          if (typeof window === "undefined") return;
          try {
            localStorage.setItem(key, value);
          } catch {
            // ストレージエラーを無視
          }
        },
        removeItem: (key: string) => {
          if (typeof window === "undefined") return;
          try {
            localStorage.removeItem(key);
          } catch {
            // ストレージエラーを無視
          }
        },
      }}
    >
      {children}
    </WalletProvider>
  );
}


