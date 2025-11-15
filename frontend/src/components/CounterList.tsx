'use client';

import { useEffect, useState, useRef } from 'react';
import { CounterObject, saveCounterId, saveRegistryId, getRegistryId, PACKAGE_ID } from '@/lib/sui';

export default function CounterList() {
  const [counters, setCounters] = useState<CounterObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCounterId, setNewCounterId] = useState('');
  const [showRegistryForm, setShowRegistryForm] = useState(false);
  const [newRegistryId, setNewRegistryId] = useState('');

  // レジストリIDを監視
  const [registryId, setRegistryIdState] = useState<string | null>(null);

  useEffect(() => {
    const currentRegistryId = getRegistryId();
    setRegistryIdState(currentRegistryId);
  }, []);

  // 初回のfetchは削除（JSON RPCポーリングのみ使用）

  // 最新のカウンターIDセットを保持するref
  const countersRef = useRef<Set<string>>(new Set());

  // カウンターが更新されたらrefも更新
  useEffect(() => {
    countersRef.current = new Set(counters.map(c => c.objectId));
  }, [counters]);

  // JSON RPCポーリングでレジストリの変更を監視（リアルタイム）
  useEffect(() => {
    let unsubscribeRegistry: (() => void) | null = null;
    let isMounted = true;

    if (!registryId) return;

    const setupRegistrySubscription = async () => {
      try {
        const { subscribeToRegistryChanges, getCounterIdsFromRegistry, getCounterById } = await import('@/lib/sui');
        
        // レジストリオブジェクトの変更をJSON RPCポーリングで監視
        unsubscribeRegistry = subscribeToRegistryChanges(registryId, async () => {
          if (!isMounted) return;
          console.log('Registry changed detected via JSON RPC polling, fetching new counters...');
          
          // レジストリから新しいカウンターIDを取得
          const newIds = await getCounterIdsFromRegistry(registryId);
          
          // 新しいカウンターを取得して追加
          for (const counterId of newIds) {
            const counter = await getCounterById(counterId);
            if (counter) {
              setCounters(prev => {
                if (prev.some(c => c.objectId === counterId)) {
                  // 既に存在する場合は更新
                  return prev.map(c => c.objectId === counterId ? counter : c);
                }
                // 新規追加
                const updated = [...prev, counter];
                return updated.sort((a, b) => parseInt(b.version) - parseInt(a.version));
              });
            }
          }
        });
      } catch (error) {
        console.error('Error setting up registry subscription:', error);
        console.error('Error details:', error);
        setError(`JSON RPC polling setup failed: ${error instanceof Error ? error.message : String(error)}`);
        setLoading(false);
      }
    };

    setupRegistrySubscription();

    return () => {
      isMounted = false;
      if (unsubscribeRegistry) {
        unsubscribeRegistry();
      }
    };
  }, [registryId]);

  // JSON RPCポーリングでリアルタイム更新（ポーリングのみで状態を取得）
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let isMounted = true;

    const setupSubscription = async () => {
      try {
        setLoading(true);
        const { subscribeToCounterEvents, getCounterById } = await import('@/lib/sui');

        // カウンター作成時のコールバック
        const handleCounterCreated = async (counterId: string) => {
          if (!isMounted) return;
          console.log('New counter created:', counterId);
          
          // 新しいカウンターだけを取得して追加（全カウンターを再取得しない）
          const newCounter = await getCounterById(counterId);
          if (newCounter) {
            setCounters(prev => {
              // 既に存在する場合はスキップ
              if (prev.some(c => c.objectId === counterId)) {
                return prev;
              }
              const updated = [...prev, newCounter];
              return updated.sort((a, b) => parseInt(b.version) - parseInt(a.version));
            });
          }
          setLoading(false);
        };

        // カウンター増加時のコールバック
        const handleCounterIncremented = async (counterId: string) => {
          if (!isMounted) return;
          console.log('Counter incremented:', counterId);
          
          // カウンターの最新値を取得して更新
          const updatedCounter = await getCounterById(counterId);
          if (updatedCounter) {
            setCounters(prev => {
              return prev.map(counter => 
                counter.objectId === counterId ? updatedCounter : counter
              );
            });
          }
        };

        // JSON RPCポーリングでイベントを購読
        unsubscribe = subscribeToCounterEvents(
          handleCounterCreated,
          handleCounterIncremented
        );
        
        // ポーリングが開始されたらloadingをfalseに
        setLoading(false);
      } catch (error) {
        console.error('Error setting up event subscription:', error);
        setError(`JSON RPC polling setup failed: ${error instanceof Error ? error.message : String(error)}`);
        setLoading(false);
      }
    };

    setupSubscription();

    return () => {
      isMounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []); // マウント時のみ実行

  if (loading && counters.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg text-gray-600">カウンターを読み込み中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800">エラー: {error}</p>
      </div>
    );
  }

  if (counters.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-600 mb-4">カウンターオブジェクトが見つかりませんでした</p>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-500 mb-2">
              カウンターを作成するには、以下のコマンドを実行してください:
            </p>
            <code className="block mt-2 p-2 bg-gray-100 rounded text-sm break-all">
              sui client call --package {PACKAGE_ID} --module knockout_contract --function create_and_share --gas-budget 10000000
            </code>
            <p className="text-sm text-gray-500 mt-2">
              または、レジストリを使用する場合:
            </p>
            <code className="block mt-2 p-2 bg-gray-100 rounded text-sm break-all">
              sui client call --package {PACKAGE_ID} --module knockout_contract --function create_and_share_registry --gas-budget 10000000
            </code>
            <p className="text-sm text-gray-500 mt-2">
              その後、レジストリIDを上記の「レジストリを設定」ボタンから設定してください。
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-2">
              または、既存のカウンターオブジェクトIDを上記の「カウンターを追加」ボタンから追加してください。
            </p>
            <p className="text-xs text-gray-400 mt-2">
              最新のカウンターID: 0x3734edcfdb267450fb19d498c2677b61fd6a0822bd5d16348db0777cb6ba79b6
            </p>
            <button
              onClick={async () => {
                try {
                  const { getCounterById } = await import('@/lib/sui');
                  const counterId = '0x3734edcfdb267450fb19d498c2677b61fd6a0822bd5d16348db0777cb6ba79b6';
                  const counter = await getCounterById(counterId);
                  if (counter) {
                    setCounters(prev => {
                      if (prev.some(c => c.objectId === counterId)) {
                        return prev;
                      }
                      const updated = [...prev, counter];
                      return updated.sort((a, b) => parseInt(b.version) - parseInt(a.version));
                    });
                    saveCounterId(counterId);
                  }
                } catch (error) {
                  setError(`カウンターの取得に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
                }
              }}
              className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
            >
              最新のカウンターを追加
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleAddCounter = async () => {
    if (newCounterId.trim()) {
      try {
        const { getCounterById } = await import('@/lib/sui');
        const counter = await getCounterById(newCounterId.trim());
        if (counter) {
          setCounters(prev => {
            if (prev.some(c => c.objectId === counter.objectId)) {
              return prev;
            }
            const updated = [...prev, counter];
            return updated.sort((a, b) => parseInt(b.version) - parseInt(a.version));
          });
          saveCounterId(newCounterId.trim());
          setNewCounterId('');
          setShowAddForm(false);
        } else {
          setError('カウンターが見つかりませんでした');
        }
      } catch (error) {
        setError(`カウンターの取得に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  };

  const handleAddRegistry = () => {
    if (newRegistryId.trim()) {
      saveRegistryId(newRegistryId.trim());
      setRegistryIdState(newRegistryId.trim());
      setNewRegistryId('');
      setShowRegistryForm(false);
      // fetchCounters()は削除（JSON RPCポーリングで監視するため）
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">カウンター一覧</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowRegistryForm(!showRegistryForm)}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
          >
            {showRegistryForm ? 'キャンセル' : 'レジストリを設定'}
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            {showAddForm ? 'キャンセル' : 'カウンターを追加'}
          </button>
        </div>
      </div>

      {showRegistryForm && (
        <div className="p-4 bg-white border border-gray-200 rounded-lg mb-4">
          <h3 className="font-semibold mb-2">レジストリオブジェクトIDを設定</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={newRegistryId}
              onChange={(e) => setNewRegistryId(e.target.value)}
              placeholder="0x..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              onClick={handleAddRegistry}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              設定
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            レジストリを作成するには: <code className="bg-gray-100 px-2 py-1 rounded text-xs">sui client call --package {PACKAGE_ID} --module knockout_contract --function create_and_share_registry --gas-budget 10000000</code>
          </p>
          {getRegistryId() && (
            <p className="text-sm text-green-600 mt-2">
              現在のレジストリID: {getRegistryId()}
            </p>
          )}
        </div>
      )}

      {showAddForm && (
        <div className="p-4 bg-white border border-gray-200 rounded-lg mb-4">
          <h3 className="font-semibold mb-2">カウンターオブジェクトIDを追加</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={newCounterId}
              onChange={(e) => setNewCounterId(e.target.value)}
              placeholder="0x..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleAddCounter}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              追加
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            例: 0x6c19c49cc830f186fa41f4052cf062538d168eb1a05e5a6065e33effa634dd28
          </p>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {counters.map((counter) => (
          <div
            key={counter.objectId}
            className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-2">カウンター</h3>
              <div className="text-4xl font-bold text-blue-600 mb-2">{counter.value}</div>
            </div>
            <div className="space-y-2 text-sm text-gray-600">
              <div>
                <span className="font-medium">オブジェクトID:</span>
                <div className="break-all font-mono text-xs mt-1">{counter.objectId}</div>
              </div>
              <div>
                <span className="font-medium">バージョン:</span> {counter.version}
              </div>
              <div>
                <a
                  href={`https://suiscan.xyz/testnet/object/${counter.objectId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  SuiScanで確認
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

