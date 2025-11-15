"use client";

import { useEffect, useState, useMemo, use, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@suiet/wallet-kit";
import { Transaction } from "@mysten/sui/transactions";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { useHaptic } from "use-haptic";
import SuietConnectButton from "../../components/SuietConnectButton";

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

// TapUIコンポーネント
function TapUI({
  counterId,
  sessionAddress,
  packageId,
  onIncrement,
  vibratePattern1,
}: {
  counterId: string;
  sessionAddress: string;
  packageId: string;
  onIncrement: (counterId: string, sessionAddress: string, packageId: string) => Promise<void>;
  vibratePattern1: () => void;
}) {
  const [isRed, setIsRed] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const onTap = useCallback(() => {
    vibratePattern1();
    setIsRed(true);
    
    // 既存のタイマーをクリア
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // 新しいタイマーを設定
    timeoutRef.current = setTimeout(() => {
      setIsRed(false);
      timeoutRef.current = null;
    }, 600);
    
    // APIを呼び出し
    void onIncrement(counterId, sessionAddress, packageId);
  }, [counterId, sessionAddress, packageId, onIncrement, vibratePattern1]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

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
      <div className="flex min-h-screen w-full flex-col items-center justify-center">
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
      </div>
    </div>
  );
}

export default function SessionPage({ params }: { params: Promise<{ packageId: string }> }) {
  const { packageId } = use(params);
  const router = useRouter();
  const wallet = useWallet();
  const connected = !!wallet?.connected;
  const [sessionKeypair, setSessionKeypair] = useState<Ed25519Keypair | null>(null);
  const [sessionAddress, setSessionAddress] = useState<string>("");
  const [registryId, setRegistryId] = useState<string>("");
  const [counterId, setCounterId] = useState<string>("");
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const audioCtxRef = useRef<AudioContext | null>(null);
  const { triggerHaptic } = useHaptic();

  // Suiクライアントを初期化（testnetに固定 - パッケージがtestnetにデプロイされているため）
  const suiClient = useMemo(() => {
    return new SuiClient({
      url: getFullnodeUrl("testnet"),
    });
  }, []);

  // ウォレット未接続でもページを表示する（接続を促すメッセージを表示）

  // 初回マウント時にセッションキーを自動生成し、cookieに保存
  useEffect(() => {
    // セッションキーを自動生成（初回マウント時）
    try {
      // 既にセッションキーが生成されている場合はスキップ
      if (sessionKeypair) return;
      
      const keypair = new Ed25519Keypair();
      const address = keypair.getPublicKey().toSuiAddress();
      setSessionKeypair(keypair);
      setSessionAddress(address);
      
      // 秘密鍵をcookieに保存（脆弱性を理解した上での実装）
      // Ed25519Keypair#getSecretKey は "suiprivkey" で始まる文字列を返す
      const secretKeyString = keypair.getSecretKey();

      // デバッグ: getSecretKey() の返り値を簡易出力
      console.log("getSecretKey() の返り値:", {
        type: typeof secretKeyString,
        length: secretKeyString.length,
        preview: secretKeyString.slice(0, 20),
      });

      // cookieに保存（HttpOnlyはfalseにして、JavaScriptからアクセス可能にする）
      // クライアント → API でそのまま round-trip できるよう、URLエンコードのみ行う
      const encodedValue = encodeURIComponent(secretKeyString);
      document.cookie = `session_secret_key=${encodedValue}; path=/; max-age=86400; SameSite=Lax`;

      console.log("cookie保存完了:", {
        encodedValueLength: encodedValue.length,
        cookieValue: document.cookie.substring(0, 100),
      });

      console.log("セッションキーを自動生成し、cookieに保存しました:", address);
    } catch (err) {
      setError(`セッションキー生成エラー: ${err}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 初回マウント時のみ実行

  // レジストリとカウンターを同時に作成
  const createRegistry = async () => {
    if (!wallet || !connected) {
      setError("ウォレットが接続されていません");
      return;
    }

    if (!sessionAddress) {
      setError("まずセッションキーを生成してください");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      console.log("レジストリ + カウンター作成開始...", { sessionAddress });
      const tx = new Transaction();
      
      tx.moveCall({
        target: `${packageId}::knockout_contract::create_and_share_registry`,
        arguments: [tx.pure.address(sessionAddress)],
      });

      // 同一トランザクション内でセッションキーへガスを少額転送（0.1 SUI）
      const [coin] = tx.splitCoins(tx.gas, [100_000_000]); // 100_000_000 MIST = 0.1 SUI
      tx.transferObjects([coin], sessionAddress);

      const result = await wallet.signAndExecuteTransactionBlock({
        transactionBlock: tx as any,
        options: {
          showEffects: true,
          showObjectChanges: true,
          showEvents: true,
        },
      });

      console.log("レジストリ作成トランザクション結果:", result);

      let foundRegistryId: string | null = null;
      let foundCounterId: string | null = null;

      const extractFromChanges = (changes?: any[]) => {
        if (!changes) return;
        for (const change of changes) {
          if (change.type !== "created" || !change.objectType) continue;
          const objectType = change.objectType as string;
          if (objectType.includes("CounterRegistry") && change.objectId) {
            foundRegistryId = change.objectId;
          } else if (objectType.includes("knockout_contract::Counter") && !objectType.includes("CounterRegistry") && change.objectId) {
            foundCounterId = change.objectId;
          }
        }
      };

      if (result.digest) {
        try {
          const txDetails = await suiClient.getTransactionBlock({
            digest: result.digest,
            options: {
              showEffects: true,
              showObjectChanges: true,
              showEvents: true,
              showInput: false,
            },
          });

          console.log("レジストリ作成トランザクション詳細:", txDetails);
          extractFromChanges(txDetails.objectChanges || []);

          if (!foundCounterId && txDetails.events) {
            for (const event of txDetails.events) {
              if (event.type?.includes("CounterCreated") && event.parsedJson) {
                const json = event.parsedJson as any;
                if (!foundCounterId && json.counter_id) {
                  foundCounterId = typeof json.counter_id === "string"
                    ? json.counter_id
                    : json.counter_id?.id ?? null;
                }
              }
            }
          }
        } catch (err) {
          console.error("トランザクション詳細の取得エラー:", err);
        }
      }

      if (!foundRegistryId || !foundCounterId) {
        extractFromChanges(result.objectChanges || []);
      }

      if (foundRegistryId) {
        setRegistryId(foundRegistryId);
      }

      if (foundCounterId) {
        setCounterId(foundCounterId);
        setCount(0);
        await fetchCounter(foundCounterId);
      } else {
        console.warn("カウンターIDが見つからなかったため、レジストリからの再取得を試みます");
        setTimeout(async () => {
          const id = await fetchCounterIdFromRegistry();
          if (id) {
            setCounterId(id);
            await fetchCounter(id);
          }
        }, 1200);
      }

      if (foundRegistryId) {
        setSuccess(`レジストリとカウンターを作成しました: ${foundRegistryId}`);
      } else {
        setError("レジストリIDの取得に失敗しました。トランザクション詳細を確認してください。");
      }
    } catch (err: any) {
      console.error("レジストリ作成エラー:", err);
      setError(`レジストリ作成エラー: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  // 振動パターン（tapページと同様の実装）
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

  // カウントアップ（セッションキーで署名）- API経由で実行（連打可能）
  const increment = async (counterIdToUse: string, sessionAddressToUse: string, packageIdToUse: string) => {
    // 連打可能にするため、ローディング状態は設定せず、非同期で処理
    try {
      // APIエンドポイントを呼び出してセッションキーで署名
      const response = await fetch("/api/increment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          counterId: counterIdToUse,
          sessionAddress: sessionAddressToUse,
          packageId: packageIdToUse,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "カウントアップに失敗しました");
      }

      console.log("カウントアップ成功:", data);
    } catch (err: any) {
      console.error("カウントアップ処理エラー:", err);
      // エラーは表示するが、連打を妨げない
      const errorMessage = err.message || err.error || "トランザクションの実行に失敗しました";
      if (errorMessage.includes("Object") && errorMessage.includes("locked")) {
        setError("オブジェクトロックで失敗しました。少し待って再度お試しください。");
      } else {
        setError(`カウントアップエラー: ${errorMessage}`);
      }
    }
  };

  // レジストリからカウンターIDを取得（完全オンチェーンデータベース）
  // 注: devInspectTransactionBlockはget_counter_idを直接呼び出せないため、
  // 作成時のトランザクション結果から取得したIDを使用する
  const fetchCounterIdFromRegistry = async () => {
    if (!registryId || !wallet?.account?.address) return null;

    // 既にカウンターIDが設定されている場合は、それを使用
    if (counterId) {
      console.log("既存のカウンターIDを使用:", counterId);
      return counterId;
    }

    // まずTableから直接取得を試みる（最も信頼できるソース）
    const directId = await getCounterIdFromRegistryTable();
    if (directId) {
      console.log("テーブルからカウンターIDを取得:", directId);
      return directId;
    }

    // カウンターIDがまだ取得されていない場合は、イベントから取得を試みる
    // または、レジストリのdynamic fieldから直接取得を試みる
    try {
      console.log("カウンターIDを検索中...");
      
      // 最近のトランザクションからCounterCreatedイベントを検索
      const events = await suiClient.queryEvents({
        query: {
          MoveEventType: `${packageId}::knockout_contract::CounterCreated`,
        },
        limit: 10,
        order: "descending",
      });

      for (const event of events.data) {
        try {
            if (event.parsedJson) {
            const parsed = event.parsedJson as { counter_id?: string | { id?: string | number }; main_owner?: string };
            if (parsed.counter_id && parsed.main_owner === wallet.account.address) {
              // IDを文字列に変換
              let id: string;
              if (typeof parsed.counter_id === 'string') {
                id = parsed.counter_id;
              } else if (parsed.counter_id && typeof parsed.counter_id === 'object' && 'id' in parsed.counter_id) {
                id = String((parsed.counter_id as { id?: string | number }).id ?? '');
              } else {
                continue;
              }
              
              console.log("イベントからカウンターIDを取得:", id);
              return id;
            }
          }
        } catch (err) {
          console.error("イベント解析エラー:", err);
        }
      }
      
      console.log("カウンターIDが見つかりませんでした");
      return null;
    } catch (err: any) {
      console.error("カウンターID検索エラー:", err);
      return null;
    }
  };


  // カウンターの状態を取得（カウンターIDから）
  const fetchCounter = async (counterIdToFetch?: string) => {
    const id = counterIdToFetch || counterId;
    if (!id) {
      console.log("カウンターIDが設定されていないため、カウンターを取得できません");
      return;
    }

    try {
      console.log("カウンターを取得中:", id);
      const object = await suiClient.getObject({
        id: id,
        options: {
          showContent: true,
        },
      });

      console.log("カウンターオブジェクト:", object);

      if (object.data?.content && "fields" in object.data.content) {
        const fields = object.data.content.fields as any;
        console.log("カウンターフィールド:", fields);
        // カウンターオブジェクトのvalueフィールドを使用
        if (fields.value !== undefined) {
          const newCount = Number(fields.value);
          console.log("カウントを更新:", newCount, "（以前の値:", count, "）");
          setCount(newCount);
        } else if (fields.count !== undefined) {
          // フォールバック: countフィールドも確認
          const newCount = Number(fields.count);
          console.log("カウントを更新（countフィールド）:", newCount, "（以前の値:", count, "）");
          setCount(newCount);
        } else {
          console.warn("カウンターフィールドにvalueもcountも見つかりません:", fields);
        }
      }
    } catch (err: any) {
      console.error(`カウンター取得エラー: ${err.message || err}`);
      // エラーが発生した場合でも、カウンターIDが無効になったわけではないので、エラーを表示しない
    }
  };

  // レジストリのTable(dynamic field)から現在のカウンターIDを直接取得
  const getCounterIdFromRegistryTable = async (): Promise<string | null> => {
    if (!registryId || !wallet?.account?.address) return null;

    try {
      const registryObject = await suiClient.getObject({
        id: registryId,
        options: {
          showContent: true,
        },
      });

      const registryContent = registryObject.data?.content;
      if (!registryContent || !("fields" in registryContent)) return null;

      const countersField = (registryContent as any).fields?.counters;
      const tableId = countersField?.fields?.id?.id;
      if (!tableId) {
        console.warn("テーブルIDが取得できませんでした", countersField);
        return null;
      }

      const dynamicFieldObject = await suiClient.getDynamicFieldObject({
        parentId: tableId,
        name: {
          type: "address",
          value: wallet.account.address,
        },
      });

      const valueField = dynamicFieldObject.data?.content;
      if (!valueField || !("fields" in valueField)) return null;
      const storedValue = (valueField as any).fields?.value;

      if (typeof storedValue === "string") {
        return storedValue;
      }

      if (storedValue && typeof storedValue === "object" && "fields" in storedValue && storedValue.fields?.id) {
        return storedValue.fields.id;
      }

      return null;
    } catch (err) {
      console.error("レジストリdynamic field取得エラー:", err);
      return null;
    }
  };

  // レジストリIDに対してJSON RPCポーリングで監視
  useEffect(() => {
    if (!registryId || !connected || !wallet?.account?.address) return;

    let lastVersion: string | null = null;
    let pollInterval: NodeJS.Timeout | null = null;

    // レジストリの変更をチェックする関数
    const checkRegistryChanges = async () => {
      try {
        const registryObject = await suiClient.getObject({
          id: registryId,
          options: {
            showContent: true,
            showOwner: true,
          },
        });

        const currentVersion = registryObject.data?.version;
        
        // バージョンが変わった場合、カウンターIDを再取得
        if (currentVersion && currentVersion !== lastVersion) {
          if (lastVersion !== null) {
            console.log('レジストリオブジェクト変更を検出:', {
              lastVersion,
              currentVersion,
            });
            // レジストリが変更されたら、カウンターIDを再取得
            const id = await fetchCounterIdFromRegistry();
            if (id) {
              console.log("カウンターIDを再取得:", id);
              setCounterId(id);
              await fetchCounter(id);
            }
          }
          lastVersion = currentVersion;
        }
      } catch (error) {
        console.error('レジストリ変更チェックエラー:', error);
        // エラーが発生してもポーリングを継続（一時的なネットワークエラーなどの可能性）
      }
    };

    // 初回のカウンターID取得とバージョンの初期化
    const initialize = async () => {
      try {
        // 初回のカウンターID取得
        console.log("レジストリからカウンターIDを取得中...");
        const id = await fetchCounterIdFromRegistry();
        if (id) {
          console.log("カウンターIDを取得しました:", id);
          setCounterId(id);
          await fetchCounter(id);
        } else {
          console.log("カウンターIDが見つかりませんでした（まだ作成されていない可能性があります）");
        }

        // 現在のバージョンを取得
        const registryObject = await suiClient.getObject({
          id: registryId,
          options: {
            showContent: true,
            showOwner: true,
          },
        });
        lastVersion = registryObject.data?.version || null;

        // ポーリングを開始（3秒間隔）
        console.log("レジストリIDのポーリング監視開始:", registryId);
        pollInterval = setInterval(checkRegistryChanges, 3000);
      } catch (error) {
        console.error('レジストリ初期化エラー:', error);
      }
    };

    // 少し遅延してから初期化
    const timeout = setTimeout(initialize, 1000);

    return () => {
      clearTimeout(timeout);
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
      console.log("レジストリIDのポーリング監視を停止");
    };
  }, [registryId, connected, wallet?.account?.address, suiClient]);

  // カウンターIDが取得できたら、カウンターの状態を取得
  useEffect(() => {
    if (counterId) {
      fetchCounter(counterId);
      
      // 連打時の最新状態を反映するため、定期的にカウンターの状態を更新
      const interval = setInterval(() => {
        fetchCounter(counterId);
      }, 2000); // 2秒ごとに更新
      
      return () => clearInterval(interval);
    }
  }, [counterId]);

  // レジストリとカウンターが作成されたら、tap UIを全画面表示
  if (registryId && counterId && sessionAddress) {
    return (
      <TapUI
        counterId={counterId}
        sessionAddress={sessionAddress}
        packageId={packageId}
        onIncrement={increment}
        vibratePattern1={vibratePattern1}
      />
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-black via-zinc-900 to-black font-sans">
      <main className="flex min-h-screen w-full max-w-4xl flex-col items-center justify-center gap-12 py-10 px-6">
        {/* ウォレット接続ボタン */}
        {!connected && (
          <div className="w-full flex justify-center mb-8">
            <SuietConnectButton />
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

        {/* エラー表示 */}
        {error && (
          <div className="w-full rounded-xl bg-red-500/10 border border-red-500/30 p-6 text-red-400 backdrop-blur-sm animate-pulse">
            <p className="text-lg font-semibold">{error}</p>
          </div>
        )}

        {/* 成功表示 */}
        {success && (
          <div className="w-full rounded-xl bg-green-500/10 border border-green-500/30 p-6 text-green-400 backdrop-blur-sm">
            <p className="text-lg font-semibold">{success}</p>
          </div>
        )}

        {/* メインコンテンツ */}
        <div className="w-full max-w-2xl">
          {/* レジストリ作成セクション */}
          <div className="relative rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900/50 to-black/50 p-8 backdrop-blur-xl shadow-2xl overflow-hidden">
            {/* 背景エフェクト */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5"></div>
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
            
            <div className="relative z-10">
              <div className="text-center mb-8">
                <h1 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight">
                  CREATE REGISTRY
                </h1>
                <p className="text-zinc-400 text-sm md:text-base max-w-md mx-auto leading-relaxed">
                  Sign with your main wallet to create a registry and counter on-chain. This will enable tap-to-increment functionality.
                </p>
              </div>

              <div className="flex flex-col items-center gap-6">
                <button
                  onClick={() => {
                    console.log("レジストリ作成ボタンがクリックされました");
                    createRegistry();
                  }}
                  disabled={loading || !sessionAddress}
                  className="relative group w-full max-w-md flex h-16 items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-purple-600 px-8 text-white font-bold text-lg transition-all hover:from-blue-500 hover:to-purple-500 hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none overflow-hidden"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000"></span>
                  <span className="relative z-10 flex items-center gap-3">
                    {loading ? (
                      <>
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>CREATING...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span>CREATE REGISTRY & COUNTER</span>
                      </>
                    )}
                  </span>
                </button>

                {!sessionAddress && (
                  <p className="text-xs text-zinc-500 text-center">
                    Session key not found. Please wait...
                  </p>
                )}
              </div>

              {/* 説明 */}
              <div className="mt-8 pt-8 border-t border-white/10">
                <div className="grid md:grid-cols-2 gap-4 text-sm text-zinc-400">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold">1</div>
                    <div>
                      <p className="font-semibold text-zinc-300 mb-1">Registry Creation</p>
                      <p className="text-zinc-500">Creates an on-chain registry to store your counter.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold">2</div>
                    <div>
                      <p className="font-semibold text-zinc-300 mb-1">Counter Initialization</p>
                      <p className="text-zinc-500">Initializes a counter linked to your session key.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
