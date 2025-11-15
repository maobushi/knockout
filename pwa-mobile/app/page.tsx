/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useWallet } from "@suiet/wallet-kit";
import { useRouter } from "next/navigation";
import SuietConnectButton from "./components/SuietConnectButton";

const PACKAGE_ID = "0x1e701597cd0a438700a4bef1f8d63fea1917beed78a59353769e01e790fb83f3";

function shortenAddress(address: string, startLength = 6, endLength = 4): string {
  if (address.length <= startLength + endLength) return address;
  return `${address.slice(0, startLength)}...${address.slice(-endLength)}`;
}

export default function Home() {
  const wallet = useWallet();
  const router = useRouter();
  const connected = !!wallet?.connected;

  const handleBetClick = (packageId: string) => {
    router.push(`/bet/${packageId}`);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-black via-zinc-900 to-black font-sans">
      <main className="flex min-h-screen w-full max-w-4xl flex-col items-center justify-center gap-12 py-10 px-6">
        {/* アプリ説明セクション */}
        <div className="w-full max-w-3xl">
          <div className="relative rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900/50 to-black/50 p-8 md:p-12 backdrop-blur-xl shadow-2xl overflow-hidden">
            {/* 背景エフェクト */}
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-pink-500/5 to-red-500/5"></div>
            <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
            
            <div className="relative z-10">
              <div className="text-center mb-8">
                <h1 className="text-5xl md:text-7xl font-black text-white mb-6 tracking-tighter leading-none">
                  KNOCKOUT
                </h1>
                <p className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-red-400 mb-6">
                  TAP. WIN. DOMINATE.
                </p>
                <p className="text-zinc-300 text-base md:text-lg max-w-2xl mx-auto leading-relaxed mb-4">
                  The ultimate on-chain tapping battle. Every tap counts. Every second matters. Prove your speed, claim your victory.
                </p>
                <p className="text-zinc-400 text-sm md:text-base max-w-xl mx-auto leading-relaxed">
                  Connect your wallet, create your registry, and unleash the power of relentless tapping. The fastest wins. Are you ready?
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ウォレット接続セクション */}
        {!connected && (
          <div className="w-full max-w-2xl relative z-50">
            <div className="relative rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900/50 to-black/50 p-8 backdrop-blur-xl shadow-2xl">
              {/* 背景エフェクト */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5 rounded-2xl"></div>
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
              
              <div className="relative z-10">
                <div className="text-center mb-8">
                  <h2 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight">
                    CONNECT WALLET
                  </h2>
                  <p className="text-zinc-400 text-sm md:text-base max-w-md mx-auto leading-relaxed">
                    Connect your Sui wallet to enter the arena.
                  </p>
                </div>

                <div className="flex flex-col items-center gap-6 relative z-50">
                  <div className="w-full max-w-md relative z-50">
                    <SuietConnectButton />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ネットワーク確認メッセージ */}
        {connected && wallet?.chain?.name && 
         !wallet.chain.name.toLowerCase().includes("testnet") && 
         wallet.chain.name.toLowerCase() !== "testnet" && (
          <div className="w-full rounded-xl bg-yellow-500/10 border border-yellow-500/30 p-6 text-yellow-400 backdrop-blur-sm">
            <p className="mb-2 text-lg font-semibold">
              ⚠️ Warning: Wallet connected to <strong>{wallet.chain.name}</strong>
            </p>
            <p className="text-sm text-yellow-300/80">
              Please switch to <strong>testnet</strong> to interact with the contract.
            </p>
          </div>
        )}

        {/* マーケット一覧 */}
        {connected && (
          <div className="w-full max-w-2xl">
            <div className="relative rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900/50 to-black/50 p-8 backdrop-blur-xl shadow-2xl overflow-hidden">
              {/* 背景エフェクト */}
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 via-red-500/5 to-pink-500/5"></div>
              <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-red-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
              
              <div className="relative z-10">
                <div className="text-center mb-8">
                  <h2 className="text-3xl md:text-4xl font-black text-white mb-4 tracking-tight">
                    MARKETS
                  </h2>
                  <p className="text-zinc-400 text-sm md:text-base max-w-md mx-auto leading-relaxed">
                    Choose your battleground. Enter the fight.
                  </p>
                </div>

                <div className="flex flex-col gap-4">
                  <button
                    onClick={() => handleBetClick(PACKAGE_ID)}
                    className="relative group w-full flex h-16 items-center justify-between rounded-xl border border-white/10 bg-gradient-to-r from-orange-600/20 to-red-600/20 px-6 text-white font-bold text-lg transition-all hover:from-orange-600/30 hover:to-red-600/30 hover:scale-[1.02] hover:shadow-2xl hover:shadow-orange-500/20 overflow-hidden"
                  >
                    <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000"></span>
                    <span className="relative z-10 flex items-center gap-3">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Bet {shortenAddress(PACKAGE_ID)}</span>
                    </span>
                    <svg className="relative z-10 w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
