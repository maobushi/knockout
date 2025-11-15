"use client";

import { useEffect, useState, useMemo, use, useCallback, useRef } from "react";
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

export default function SessionPage({ params }: { params: Promise<{ packageId: string }> }) {
  const { packageId } = use(params);
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

      // 同一トランザクション内でセッションキーへガスを少額転送（0.01 SUI）
      const [coin] = tx.splitCoins(tx.gas, [10_000_000]); // 10_000_000 MIST = 0.01 SUI
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
  const increment = async () => {
    if (!sessionAddress) {
      setError("セッションキーが生成されていません");
      return;
    }

    if (!counterId) {
      setError("レジストリとカウンターを作成してください");
      return;
    }

    // 振動をトリガー
    vibratePattern1();

    // 連打可能にするため、ローディング状態は設定せず、非同期で処理
    (async () => {
      try {
        // APIエンドポイントを呼び出してセッションキーで署名
        const response = await fetch("/api/increment", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            counterId,
            sessionAddress,
            packageId,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "カウントアップに失敗しました");
        }

        console.log("カウントアップ成功:", data);
        
        // カウンターの状態を更新（少し遅延させて確実に反映）
        setTimeout(async () => {
          await fetchCounter(counterId);
        }, 500);
      } catch (err: any) {
        console.error("カウントアップ処理エラー:", err);
        const errorMessage = err.message || err.error || "トランザクションの実行に失敗しました";
        // エラーは表示するが、連打を妨げない
        if (errorMessage.includes("Object") && errorMessage.includes("locked")) {
          setError("オブジェクトロックで失敗しました。少し待って再度お試しください。");
        } else {
          setError(`カウントアップエラー: ${errorMessage}`);
        }
      }
    })();
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center gap-8 py-10 px-6 bg-white dark:bg-black">
        {/* ウォレット接続ボタン */}
        <div className="w-full flex justify-center">
          <SuietConnectButton />
        </div>

        {/* ネットワーク確認メッセージ */}
        {connected && wallet?.chain?.name && 
         !wallet.chain.name.toLowerCase().includes("testnet") && 
         wallet.chain.name.toLowerCase() !== "testnet" && (
          <div className="w-full rounded-lg bg-yellow-50 border border-yellow-200 p-4 text-yellow-700 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-400">
            <p className="mb-2">
              ⚠️ 警告: ウォレットは <strong>{wallet.chain.name}</strong> に接続されていますが、
              コントラクトは <strong>testnet</strong> にデプロイされています。
            </p>
            <p className="text-sm">
              ウォレットを <strong>testnet</strong> に切り替えてください。
            </p>
          </div>
        )}

        {/* エラー表示 */}
        {error && (
          <div className="w-full rounded-lg bg-red-50 border border-red-200 p-4 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
            {error}
          </div>
        )}

        {/* 成功表示 */}
        {success && (
          <div className="w-full rounded-lg bg-green-50 border border-green-200 p-4 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400">
            {success}
          </div>
        )}

        {/* セッションキーセクション */}
        <div className="w-full space-y-4">
          {/* レジストリセクション */}
          <div className="rounded-lg border border-black/[.12] p-4 dark:border-white/[.2]">
            <h2 className="text-lg font-semibold mb-4 text-black dark:text-zinc-50">
              1. レジストリ作成（メインウォレットで署名）
            </h2>
            {registryId ? (
              <div className="space-y-1 mb-2">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  レジストリID: <code className="bg-zinc-100 dark:bg-zinc-900 px-2 py-1 rounded">{registryId}</code>
                </p>
                {counterId && (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    カウンターID: <code className="bg-zinc-100 dark:bg-zinc-900 px-2 py-1 rounded">{counterId}</code>
                  </p>
                )}
              </div>
            ) : null}
            <button
              onClick={() => {
                console.log("レジストリ作成ボタンがクリックされました");
                createRegistry();
              }}
              disabled={loading || !sessionAddress}
              className="flex h-10 items-center justify-center rounded-full bg-green-500 px-4 text-white transition-colors hover:bg-green-600 disabled:opacity-50"
            >
              {loading
                ? "作成中..."
                : registryId
                ? "レジストリを再作成"
                : "レジストリとカウンターを作成"}
            </button>
            {/* デバッグ情報 */}
            {(!sessionAddress) && (
              <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-2">
                ボタンが無効な理由: セッションキーなし
              </p>
            )}
          </div>

          {/* ガス送金セクションは不要（メインウォレットでガスを支払う運用に変更） */}

          {/* カウントアップセクション */}
          <div className="rounded-lg border border-black/[.12] p-4 dark:border-white/[.2]">
            <h2 className="text-lg font-semibold mb-4 text-black dark:text-zinc-50">
              2. カウントアップ（セッションキーで署名）
            </h2>
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-4xl font-bold text-black dark:text-zinc-50 mb-2">{count}</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">現在のカウント</p>
              </div>
              <button
                onClick={increment}
                disabled={!sessionAddress || !counterId}
                className="w-full flex h-12 items-center justify-center rounded-full bg-orange-500 px-4 text-white transition-colors hover:bg-orange-600 disabled:opacity-50 text-lg font-semibold"
              >
                カウントアップ
              </button>
              {/* デバッグ情報 */}
              {(!sessionAddress || !counterId) && (
                <div className="text-xs text-zinc-500 dark:text-zinc-500 mt-2 space-y-1">
                  <p>
                    ボタンが無効な理由: {!sessionAddress ? "セッションキーなし " : ""} {!counterId ? "カウンターIDなし" : ""}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
