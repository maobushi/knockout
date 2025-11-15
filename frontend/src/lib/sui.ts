import { SuiClient } from '@mysten/sui.js/client';

// Sui TestnetのRPC URL（HTTP RPCエンドポイントを明示的に指定）
// JSON RPCのみを使用（ポーリングベース）
const TESTNET_RPC_URL = 'https://fullnode.testnet.sui.io:443';

// Suiクライアントのインスタンスを作成
// TestnetのHTTP RPCエンドポイントを明示的に指定
// 注意: すべての監視機能はJSON RPCポーリングベースで実装されています
export const suiClient = new SuiClient({
  url: TESTNET_RPC_URL,
});

// パッケージID（デプロイしたコントラクトのID）
export const PACKAGE_ID = '0x5fa6754acdef054ffa26ae6b5f336d1bb98111dacb98ad105b04f86abcce977e';

// レジストリオブジェクトの型
export const REGISTRY_TYPE = `${PACKAGE_ID}::knockout_contract::CounterRegistry`;

// カウンターオブジェクトの型
export const COUNTER_TYPE = `${PACKAGE_ID}::knockout_contract::Counter`;

// カウンターオブジェクトのインターフェース
export interface CounterObject {
  objectId: string;
  value: number;
  version: string;
  digest: string;
}

// 既知のカウンターオブジェクトID（ローカルストレージから取得）
const STORAGE_KEY = 'knockout_counters';
const LAST_EVENT_CURSOR_KEY = 'knockout_last_event_cursor';
const LAST_INCREMENT_EVENT_CURSOR_KEY = 'knockout_last_increment_event_cursor';
const REGISTRY_POLL_INTERVAL_MS = 15000;
const COUNTER_EVENT_POLL_INTERVAL_MS = 12000;

// ローカルストレージからカウンターIDのリストを取得
export function getStoredCounterIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// カウンターIDをローカルストレージに保存
export function saveCounterId(objectId: string) {
  if (typeof window === 'undefined') return;
  try {
    const ids = getStoredCounterIds();
    if (!ids.includes(objectId)) {
      ids.push(objectId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    }
  } catch (error) {
    console.error('Error saving counter ID:', error);
  }
}

// 最後にチェックしたカーソル位置を取得
function getLastEventCursor(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(LAST_EVENT_CURSOR_KEY);
  } catch {
    return null;
  }
}

// 最後にチェックしたカーソル位置を保存
function saveLastEventCursor(cursor: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (cursor) {
      localStorage.setItem(LAST_EVENT_CURSOR_KEY, cursor);
    } else {
      localStorage.removeItem(LAST_EVENT_CURSOR_KEY);
    }
  } catch (error) {
    console.error('Error saving last event cursor:', error);
  }
}

function getLastIncrementEventCursor(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(LAST_INCREMENT_EVENT_CURSOR_KEY);
  } catch {
    return null;
  }
}

function saveLastIncrementEventCursor(cursor: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (cursor) {
      localStorage.setItem(LAST_INCREMENT_EVENT_CURSOR_KEY, cursor);
    } else {
      localStorage.removeItem(LAST_INCREMENT_EVENT_CURSOR_KEY);
    }
  } catch (error) {
    console.error('Error saving last increment event cursor:', error);
  }
}

// 新しいイベントのみを取得（リアルタイム検出用）
export async function getNewCounterEvents(): Promise<string[]> {
  try {
    const counterIds: string[] = [];
    const lastCursor = getLastEventCursor();

    // 最新のイベントから取得（時系列順、カーソル位置から続きを取得）
    const events = await suiClient.queryEvents({
      query: {
        MoveEventType: `${PACKAGE_ID}::knockout_contract::CounterCreated`,
      },
      limit: 100,
      order: 'ascending', // 古い順から新しい順へ
      cursor: lastCursor || undefined,
    });

    for (const event of events.data) {
      if (event.type === `${PACKAGE_ID}::knockout_contract::CounterCreated`) {
        const parsedJson = event.parsedJson as { counter_id?: string };
        if (parsedJson.counter_id) {
          counterIds.push(parsedJson.counter_id);
        }
      }
    }

    // カーソル位置を更新（次のポーリングで続きから取得）
    if (events.nextCursor) {
      saveLastEventCursor(events.nextCursor);
    } else if (events.data.length > 0) {
      // イベントがあるがnextCursorがない場合、最後のイベントのIDを使用
      const lastEvent = events.data[events.data.length - 1];
      // event.idはEventId型で、txDigestとeventSeqを含む
      if (lastEvent.id) {
        // カーソルとして使用できる形式に変換
        const cursorString = `${lastEvent.id.txDigest}_${lastEvent.id.eventSeq}`;
        saveLastEventCursor(cursorString);
      }
    }

    if (counterIds.length > 0) {
      console.log(`Found ${counterIds.length} new counter events`);
    }
    return counterIds;
  } catch (error) {
    console.error('Error fetching new counter events:', error);
    return [];
  }
}

export async function getNewCounterIncrementEvents(): Promise<string[]> {
  try {
    const counterIds: string[] = [];
    const lastCursor = getLastIncrementEventCursor();

    const events = await suiClient.queryEvents({
      query: {
        MoveEventType: `${PACKAGE_ID}::knockout_contract::CounterIncremented`,
      },
      limit: 100,
      order: 'ascending',
      cursor: lastCursor || undefined,
    });

    for (const event of events.data) {
      if (event.type === `${PACKAGE_ID}::knockout_contract::CounterIncremented`) {
        const parsedJson = event.parsedJson as { counter_id?: string };
        if (parsedJson.counter_id) {
          counterIds.push(parsedJson.counter_id);
        }
      }
    }

    if (events.nextCursor) {
      saveLastIncrementEventCursor(events.nextCursor);
    } else if (events.data.length > 0) {
      const lastEvent = events.data[events.data.length - 1];
      if (lastEvent.id) {
        const cursorString = `${lastEvent.id.txDigest}_${lastEvent.id.eventSeq}`;
        saveLastIncrementEventCursor(cursorString);
      }
    }

    if (counterIds.length > 0) {
      console.log(`Found ${counterIds.length} new counter increment events`);
    }

    return counterIds;
  } catch (error) {
    console.error('Error fetching counter increment events:', error);
    return [];
  }
}

// イベントからカウンターオブジェクトIDを検出（すべてのイベントを取得）
export async function discoverCounterIds(): Promise<string[]> {
  try {
    const counterIds = new Set<string>();
    let cursor: string | null = null;
    let hasNextPage = true;

    // ページネーションを使用してすべてのイベントを取得
    while (hasNextPage) {
      const events = await suiClient.queryEvents({
        query: {
          MoveEventType: `${PACKAGE_ID}::knockout_contract::CounterCreated`,
        },
        limit: 50,
        order: 'descending',
        cursor: cursor || undefined,
      });

      for (const event of events.data) {
        if (event.type === `${PACKAGE_ID}::knockout_contract::CounterCreated`) {
          const parsedJson = event.parsedJson as { counter_id?: string };
          if (parsedJson.counter_id) {
            counterIds.add(parsedJson.counter_id);
          }
        }
      }

      hasNextPage = events.hasNextPage;
      cursor = events.nextCursor || null;

      // 安全のため、最大1000件まで取得
      if (counterIds.size >= 1000) {
        break;
      }
    }

    console.log(`Discovered ${counterIds.size} counter IDs from events`);
    return Array.from(counterIds);
  } catch (error) {
    console.error('Error discovering counter IDs:', error);
    return [];
  }
}

// レジストリからカウンターIDを取得
export async function getCounterIdsFromRegistry(registryId: string): Promise<string[]> {
  try {
    // SuiのTableは動的フィールドとして保存されるため、getDynamicFieldsを使用
    const dynamicFields = await suiClient.getDynamicFields({
      parentId: registryId,
    });

    const counterIds: string[] = [];

    console.log(`Found ${dynamicFields.data.length} dynamic fields in registry`);

    for (const field of dynamicFields.data) {
      try {
        console.log(`Processing dynamic field:`, field);
        // フィールド名が数値（インデックス）の場合、その値を取得
        const fieldObject = await suiClient.getObject({
          id: field.objectId,
          options: {
            showContent: true,
            showType: true,
          },
        });

        console.log(`Field object:`, fieldObject);

        if (fieldObject.data && 'content' in fieldObject.data && fieldObject.data.content) {
          const fieldContent = fieldObject.data.content;
          console.log(`Field content:`, fieldContent);
          
          if ('fields' in fieldContent) {
            const fieldFields = fieldContent.fields as Record<string, unknown>;
            console.log(`Field fields:`, fieldFields);
            
            // valueフィールドからIDを取得
            if ('value' in fieldFields && fieldFields.value) {
              const idValue = fieldFields.value;
              console.log(`ID value:`, idValue, typeof idValue);
              
              // IDオブジェクトから実際のID文字列を取得
              if (typeof idValue === 'string') {
                counterIds.push(idValue);
                console.log(`Added counter ID (string):`, idValue);
              } else if (idValue && typeof idValue === 'object') {
                if ('id' in idValue) {
                  const idStr = String(idValue.id);
                  counterIds.push(idStr);
                  console.log(`Added counter ID (id field):`, idStr);
                } else if ('inner' in idValue) {
                  const idStr = String(idValue.inner);
                  counterIds.push(idStr);
                  console.log(`Added counter ID (inner field):`, idStr);
                } else {
                  // オブジェクト全体をログに出力して構造を確認
                  console.log(`ID value object structure:`, JSON.stringify(idValue, null, 2));
                  // オブジェクトの最初の値を試す
                  const firstValue = Object.values(idValue)[0];
                  if (typeof firstValue === 'string') {
                    counterIds.push(firstValue);
                    console.log(`Added counter ID (first value):`, firstValue);
                  }
                }
              }
            } else {
              console.warn(`No 'value' field found in:`, fieldFields);
            }
          }
        }
      } catch (fieldError) {
        console.error(`Error fetching field ${field.objectId}:`, fieldError);
        continue;
      }
    }

    console.log(`Found ${counterIds.length} counters in registry`);
    return counterIds;
  } catch (error) {
    console.error('Error fetching counter IDs from registry:', error);
    return [];
  }
}

// レジストリIDを保存するキー
const REGISTRY_ID_KEY = 'knockout_registry_id';

// レジストリIDを取得
export function getRegistryId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(REGISTRY_ID_KEY);
  } catch {
    return null;
  }
}

// レジストリIDを保存
export function saveRegistryId(registryId: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(REGISTRY_ID_KEY, registryId);
  } catch (error) {
    console.error('Error saving registry ID:', error);
  }
}

// カウンターオブジェクトを取得（レジストリ優先、フォールバックはイベント）
export async function getCounterObjects(): Promise<CounterObject[]> {
  try {
    let allIds: string[] = [];

    // まずレジストリから取得を試みる
    const registryId = getRegistryId();
    console.log('Registry ID:', registryId);
    
    if (registryId) {
      try {
        console.log('Fetching counters from registry...');
        const registryIds = await getCounterIdsFromRegistry(registryId);
        console.log(`Found ${registryIds.length} counters from registry:`, registryIds);
        if (registryIds.length > 0) {
          allIds = registryIds;
        } else {
          console.warn('Registry returned empty, falling back to events');
        }
      } catch (error) {
        console.error('Failed to fetch from registry, falling back to events:', error);
      }
    }

    // レジストリがない、または空の場合はイベントから取得
    if (allIds.length === 0) {
      console.log('Fetching counters from events...');
      const discoveredIds = await discoverCounterIds();
      console.log(`Found ${discoveredIds.length} counters from events:`, discoveredIds);
      allIds = discoveredIds;
    }

    // ローカルストレージに保存されたIDも含める（フォールバック）
    const storedIds = getStoredCounterIds();
    console.log(`Stored IDs:`, storedIds);
    allIds = Array.from(new Set([...allIds, ...storedIds]));

    console.log(`Total counter IDs to fetch: ${allIds.length}`, allIds);

    // 並列でカウンターオブジェクトを取得（パフォーマンス向上）
    const counterPromises = allIds.map(async (objectId) => {
      try {
        const counter = await getCounterById(objectId);
        if (counter) {
          saveCounterId(objectId); // 見つかったIDを保存
          return counter;
        }
        return null;
      } catch (error) {
        console.error(`Error fetching counter ${objectId}:`, error);
        return null;
      }
    });

    const counters = (await Promise.all(counterPromises)).filter(
      (counter): counter is CounterObject => counter !== null
    );

    console.log(`Successfully fetched ${counters.length} counter objects`);
    // バージョンでソート（新しい順）
    return counters.sort((a, b) => parseInt(b.version) - parseInt(a.version));
  } catch (error) {
    console.error('Error fetching counter objects:', error);
    return [];
  }
}

// 新しいカウンターイベントをチェックして、既存のリストに追加
export async function checkForNewCounters(existingIds: Set<string>): Promise<string[]> {
  try {
    const newEventIds = await getNewCounterEvents();
    const newIds = newEventIds.filter(id => !existingIds.has(id));
    
    if (newIds.length > 0) {
      console.log(`Found ${newIds.length} new counter(s):`, newIds);
      // 新しいIDをローカルストレージに保存
      newIds.forEach(id => saveCounterId(id));
    }
    
    return newIds;
  } catch (error) {
    console.error('Error checking for new counters:', error);
    return [];
  }
}

// JSON RPCポーリングでレジストリオブジェクトの変更を監視
export function subscribeToRegistryChanges(
  registryId: string,
  onRegistryChanged: () => void
): () => void {
  let pollingTimer: ReturnType<typeof setInterval> | null = null;
  let stopped = false;
  let hasTriggeredInitialRefresh = false;
  let lastRegistryVersion: string | null = null;

  const stopPolling = () => {
    if (pollingTimer) {
      clearInterval(pollingTimer);
      pollingTimer = null;
    }
  };

  const triggerInitialRefresh = () => {
    if (!hasTriggeredInitialRefresh) {
      hasTriggeredInitialRefresh = true;
      try {
        onRegistryChanged();
      } catch (error) {
        console.error('Error executing registry change callback:', error);
      }
    }
  };

  const startPolling = () => {
    if (pollingTimer) return;
    console.log('Starting JSON RPC polling for registry changes:', registryId);

    const poll = async () => {
      if (stopped) return;
      try {
        const registryObject = await suiClient.getObject({
          id: registryId,
          options: {
            showContent: false,
            showDisplay: false,
            showOwner: false,
            showPreviousTransaction: false,
            showStorageRebate: false,
            showType: false,
          },
        });

        const currentVersion = registryObject.data?.version ?? null;

        if (!hasTriggeredInitialRefresh) {
          lastRegistryVersion = currentVersion;
          triggerInitialRefresh();
          return;
        }

        if (currentVersion && currentVersion !== lastRegistryVersion) {
          console.log('Registry version changed:', {
            lastVersion: lastRegistryVersion,
            currentVersion,
          });
          lastRegistryVersion = currentVersion;
          onRegistryChanged();
        }
      } catch (error) {
        console.error('Error polling registry changes:', error);
        // 初回リフレッシュがまだ実行されていない場合は実行
        if (!hasTriggeredInitialRefresh) {
          triggerInitialRefresh();
        }
      }
    };

    // 初回実行
    poll();
    // ポーリングを開始
    pollingTimer = setInterval(poll, REGISTRY_POLL_INTERVAL_MS);
  };

  // ポーリングを開始
  startPolling();

  return () => {
    stopped = true;
    stopPolling();
    console.log('Stopped polling registry changes');
  };
}

// JSON RPCポーリングでイベントを購読（リアルタイム取得）
export function subscribeToCounterEvents(
  onCounterCreated: (counterId: string) => void,
  onCounterIncremented: (counterId: string) => void
): () => void {
  let pollingTimer: ReturnType<typeof setInterval> | null = null;
  let stopped = false;

  const stopPolling = () => {
    if (pollingTimer) {
      clearInterval(pollingTimer);
      pollingTimer = null;
    }
  };

  const startPolling = () => {
    if (pollingTimer) return;
    console.log('Starting JSON RPC polling for counter events');

    const poll = async () => {
      if (stopped) return;
      try {
        const newCounters = await getNewCounterEvents();
        newCounters.forEach((counterId) => {
          saveCounterId(counterId);
          try {
            onCounterCreated(counterId);
          } catch (error) {
            console.error('Error handling polled CounterCreated event:', error);
          }
        });
      } catch (error) {
        console.error('Error polling counter creation events:', error);
      }

      try {
        const incrementedCounters = await getNewCounterIncrementEvents();
        incrementedCounters.forEach((counterId) => {
          try {
            onCounterIncremented(counterId);
          } catch (error) {
            console.error('Error handling polled CounterIncremented event:', error);
          }
        });
      } catch (error) {
        console.error('Error polling counter increment events:', error);
      }
    };

    // 初回実行
    poll();
    // ポーリングを開始
    pollingTimer = setInterval(poll, COUNTER_EVENT_POLL_INTERVAL_MS);
  };

  // ポーリングを開始
  startPolling();

  return () => {
    stopped = true;
    stopPolling();
    console.log('Stopped polling counter events');
  };
}

// 特定のオブジェクトIDでカウンターを取得
export async function getCounterById(objectId: string): Promise<CounterObject | null> {
  try {
    const object = await suiClient.getObject({
      id: objectId,
      options: {
        showContent: true,
        showType: true,
      },
    });

    if (object.data && 'content' in object.data && object.data.content && 'fields' in object.data.content) {
      const fields = object.data.content.fields as { value: string; id: { id: string } };
      return {
        objectId: object.data.objectId,
        value: parseInt(fields.value || '0', 10),
        version: object.data.version,
        digest: object.data.digest,
      };
    }

    return null;
  } catch (error) {
    console.error('Error fetching counter:', error);
    return null;
  }
}
