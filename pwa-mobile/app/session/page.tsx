"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@suiet/wallet-kit";
import { Transaction } from "@mysten/sui/transactions";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { toSerializedSignature } from "@mysten/sui/cryptography";
import { CONTRACT_CONFIG } from "../config/contract";
import SuietConnectButton from "../components/SuietConnectButton";

export default function SessionPage() {
  const router = useRouter();
  const wallet = useWallet();
  const connected = !!wallet?.connected;
  const [sessionKeypair, setSessionKeypair] = useState<Ed25519Keypair | null>(null);
  const [sessionAddress, setSessionAddress] = useState<string>("");
  const [registryId, setRegistryId] = useState<string>("");
  const [counterId, setCounterId] = useState<string>("");
  const [counterSessionAddress, setCounterSessionAddress] = useState<string>(""); // レジストリに登録されているセッションアドレス
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  // Suiクライアントを初期化（testnetに固定 - パッケージがtestnetにデプロイされているため）
  const suiClient = useMemo(() => {
    return new SuiClient({
      url: getFullnodeUrl("testnet"),
    });
  }, []);

  // ウォレット未接続でもページを表示する（接続を促すメッセージを表示）

  // 初回マウント時に古いlocalStorageデータをクリーンアップし、セッションキーを自動生成
  useEffect(() => {
    if (typeof window !== "undefined") {
      // 古いセッションキーのデータが残っている場合は削除
      const oldSessionKey = localStorage.getItem("sessionSecretKey");
      if (oldSessionKey) {
        console.log("古いセッションキーのデータをクリーンアップします（セキュリティのため）");
        localStorage.removeItem("sessionSecretKey");
      }
      // 古いcounterSessionAddressデータも削除
      const oldCounterSessionAddress = localStorage.getItem("counterSessionAddress");
      if (oldCounterSessionAddress) {
        console.log("古いcounterSessionAddressデータをクリーンアップします");
        localStorage.removeItem("counterSessionAddress");
      }
    }

    // セッションキーを自動生成（初回マウント時）
    try {
      // 既にセッションキーが生成されている場合はスキップ
      if (sessionKeypair) return;
      
      const keypair = new Ed25519Keypair();
      const address = keypair.getPublicKey().toSuiAddress();
      setSessionKeypair(keypair);
      setSessionAddress(address);
      
      // セキュリティのため、セッションキーはメモリにのみ保存（localStorageには保存しない）
      // ページをリロードすると新しいセッションキーが自動生成される
      
      console.log("セッションキーを自動生成しました:", address);
    } catch (err) {
      setError(`セッションキー生成エラー: ${err}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 初回マウント時のみ実行

  // メインウォレットからセッションキーにSUIを送金（テスト用）
  const sendGasToSessionKey = async () => {
    if (!wallet || !connected || !sessionAddress) {
      setError("ウォレットが接続されていないか、セッションキーが生成されていません");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const tx = new Transaction();
      
      // セッションキーに0.01 SUIを送金（テスト用、ガス代として十分）
      const [coin] = tx.splitCoins(tx.gas, [10_000_000]); // 0.01 SUI (10_000_000 MIST)
      tx.transferObjects([coin], sessionAddress);

      const result = await wallet.signAndExecuteTransactionBlock({
        transactionBlock: tx,
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
      });

      console.log("ガス送金トランザクション結果:", result);
      setSuccess(`セッションキーに0.01 SUIを送金しました`);
    } catch (err: any) {
      setError(`ガス送金エラー: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

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
        target: `${CONTRACT_CONFIG.PACKAGE_ID}::knockout_contract::create_and_share_registry`,
        arguments: [tx.pure.address(sessionAddress)],
      });

      const result = await wallet.signAndExecuteTransactionBlock({
        transactionBlock: tx,
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
        // レジストリに登録されているセッションアドレスをメモリに保存
        setCounterSessionAddress(sessionAddress);
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

  // カウントアップ（セッションキーで署名）
  const increment = async () => {
    if (!sessionKeypair) {
      setError("セッションキーを生成してください");
      return;
    }

    if (!counterId) {
      setError("レジストリとカウンターを作成してください");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      console.log("カウントアップ開始:", { counterId, sessionAddress });
      
      // まずカウンターオブジェクトを取得して、session_ownerを確認
      let expectedSessionOwner: string | null = null;
      try {
        const counterObject = await suiClient.getObject({
          id: counterId,
          options: { showContent: true },
        });
        
        if (counterObject.data?.content && "fields" in counterObject.data.content) {
          const fields = counterObject.data.content.fields as any;
          expectedSessionOwner = fields.session_owner;
          console.log("カウンターのsession_owner:", expectedSessionOwner);
          console.log("現在のセッションアドレス:", sessionAddress);
          
          if (expectedSessionOwner !== sessionAddress) {
            // セッションキーが一致しない場合、警告を表示して、カウンターに登録されているセッションキーを使用するように促す
            setError(
              `⚠️ セッションキーのアドレスが一致しません。\n` +
              `レジストリに登録されているセッションキー: ${expectedSessionOwner}\n` +
              `現在のセッションキー: ${sessionAddress}\n` +
              `\n解決方法:\n` +
              `「2. レジストリ作成（再作成）」を実行して、新しいセッションキーを登録してください。`
            );
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        console.error("カウンターオブジェクトの取得エラー:", err);
      }

      const tx = new Transaction();
      
      // セッションキーのアドレスをsenderとして設定
      tx.setSender(sessionAddress);
      
      tx.moveCall({
        target: `${CONTRACT_CONFIG.PACKAGE_ID}::knockout_contract::increment`,
        arguments: [
          tx.object(counterId), // sharedオブジェクトとして参照
        ],
      });

      // 署名者のアドレスを確認
      const signerAddress = sessionKeypair.getPublicKey().toSuiAddress();
      console.log("署名開始:", { 
        signerAddress, 
        sessionAddress, 
        match: signerAddress === sessionAddress
      });
      
      if (signerAddress !== sessionAddress) {
        setError(`セッションキーのアドレスが一致しません。署名者: ${signerAddress}, 期待: ${sessionAddress}`);
        return;
      }
      
      // トランザクションに署名して実行
      // @mysten/suiの新しいAPIでは、Transaction.sign()メソッドを使用
      // クライアントサイドから秘密鍵で署名することは可能です
      const signedTransaction = await tx.sign({ signer: sessionKeypair, client: suiClient });
      
      console.log("トランザクションに署名しました:", {
        sender: sessionAddress,
        signedTransactionType: typeof signedTransaction,
        hasBytes: 'bytes' in signedTransaction,
        hasSignature: 'signature' in signedTransaction,
      });
      
      // 署名済みトランザクションを実行
      // signedTransactionはSignatureWithBytes型で、bytesプロパティを持つ
      const result = await suiClient.executeTransactionBlock({
        transactionBlock: signedTransaction.bytes, // bytesプロパティを使用
        signature: signedTransaction.signature, // signatureプロパティを使用
        options: {
          showEffects: true,
          showObjectChanges: true,
          showEvents: true,
        },
      });
      
      console.log("カウントアップトランザクション結果:", result);
      
      // カウントを更新（少し待ってから取得）
      setTimeout(async () => {
        await fetchCounter(counterId);
        console.log("カウントアップ後のカウンター状態を取得しました");
      }, 1000);
      setSuccess(`カウントアップしました`);
    } catch (err: any) {
      // ガス不足エラーの場合、メインウォレットからセッションキーにSUIを送金することを提案
      if (err.message?.includes("No valid gas coins") || err.message?.includes("gas")) {
        setError(
          `ガス不足エラー: セッションキーのアドレス（${sessionAddress}）にSUIがありません。\n` +
          `上記の「セッションキーに0.01 SUIを送金」ボタンを押して、メインウォレットからセッションキーにガスを送金してください。\n` +
          `（本番環境では、スポンサードトランザクションを実装してください）`
        );
      } else {
        setError(`カウントアップエラー: ${err.message || err}`);
      }
    } finally {
      setLoading(false);
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
          MoveEventType: `${CONTRACT_CONFIG.PACKAGE_ID}::knockout_contract::CounterCreated`,
        },
        limit: 10,
        order: "descending",
      });

      for (const event of events.data) {
        try {
          if (event.parsedJson) {
            const parsed = event.parsedJson as { counter_id?: string; main_owner?: string };
            if (parsed.counter_id && parsed.main_owner === wallet.account.address) {
              // IDを文字列に変換
              let id: string;
              if (typeof parsed.counter_id === 'string') {
                id = parsed.counter_id;
              } else if (parsed.counter_id && typeof parsed.counter_id === 'object' && 'id' in parsed.counter_id) {
                id = String(parsed.counter_id.id);
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
    }
  }, [counterId]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center gap-8 py-10 px-6 bg-white dark:bg-black">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
          セッションキーテスト
        </h1>

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

        {/* セッションアドレス表示 */}
        {sessionAddress && (
          <div className="w-full rounded-lg border border-black/[.12] p-4 dark:border-white/[.2]">
            <h2 className="text-lg font-semibold mb-2 text-black dark:text-zinc-50">
              セッションアドレス
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              <code className="bg-zinc-100 dark:bg-zinc-900 px-2 py-1 rounded">{sessionAddress}</code>
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-2">
              セッションキーは自動生成されました（ページをリロードすると新しいキーが生成されます）
            </p>
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

          {/* ガス送金セクション（テスト用） */}
          {sessionAddress && (
            <div className="rounded-lg border border-yellow-300 dark:border-yellow-700 p-4 bg-yellow-50 dark:bg-yellow-900/20">
              <h2 className="text-lg font-semibold mb-2 text-black dark:text-zinc-50">
                2. ⚠️ テスト用: セッションキーにガスを送金
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                セッションキーでトランザクションを実行するには、ガス用のSUIが必要です。
                メインウォレットからセッションキーに0.01 SUIを送金します。
              </p>
              <button
                onClick={sendGasToSessionKey}
                disabled={loading || !connected || !sessionAddress}
                className="flex h-10 items-center justify-center rounded-full bg-yellow-500 px-4 text-white transition-colors hover:bg-yellow-600 disabled:opacity-50"
              >
                {loading ? "送金中..." : "セッションキーに0.01 SUIを送金"}
              </button>
            </div>
          )}

          {/* カウントアップセクション */}
          <div className="rounded-lg border border-black/[.12] p-4 dark:border-white/[.2]">
            <h2 className="text-lg font-semibold mb-4 text-black dark:text-zinc-50">
              3. カウントアップ（セッションキーで署名）
            </h2>
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-4xl font-bold text-black dark:text-zinc-50 mb-2">{count}</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">現在のカウント</p>
              </div>
              <button
                onClick={increment}
                disabled={loading || !sessionKeypair || !counterId}
                className="w-full flex h-12 items-center justify-center rounded-full bg-orange-500 px-4 text-white transition-colors hover:bg-orange-600 disabled:opacity-50 text-lg font-semibold"
              >
                {loading ? "処理中..." : "カウントアップ"}
              </button>
              {/* デバッグ情報 */}
              {(!sessionKeypair || !counterId) && (
                <div className="text-xs text-zinc-500 dark:text-zinc-500 mt-2 space-y-1">
                  <p>
                    ボタンが無効な理由: {!sessionKeypair ? "セッションキーなし " : ""} {!counterId ? "カウンターIDなし" : ""}
                  </p>
                  {sessionKeypair && (
                    <p>
                      セッションキー: <code className="bg-zinc-100 dark:bg-zinc-900 px-2 py-1 rounded">{sessionAddress}</code>
                    </p>
                  )}
                  {counterId && (
                    <p>
                      カウンターID: <code className="bg-zinc-100 dark:bg-zinc-900 px-2 py-1 rounded">{counterId}</code>
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 設定情報 */}
        <div className="w-full rounded-lg border border-black/[.12] p-4 dark:border-white/[.2]">
          <h2 className="text-lg font-semibold mb-2 text-black dark:text-zinc-50">
            設定情報
          </h2>
          <div className="space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
            <p>パッケージID: <code className="bg-zinc-100 dark:bg-zinc-900 px-2 py-1 rounded">{CONTRACT_CONFIG.PACKAGE_ID}</code></p>
            <p>メインアドレス: <code className="bg-zinc-100 dark:bg-zinc-900 px-2 py-1 rounded">{wallet?.account?.address || "未接続"}</code></p>
          </div>
        </div>
      </main>
    </div>
  );
}
