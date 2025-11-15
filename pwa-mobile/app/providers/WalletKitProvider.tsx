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
    >
      {children}
    </WalletProvider>
  );
}


