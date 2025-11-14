# Knockout Counter Project

Suiブロックチェーン上で動作するカウンターアプリケーションの実装ドキュメントです。

## プロジェクト概要

このプロジェクトは、Suiブロックチェーン上でカウンターオブジェクトを管理するアプリケーションです。以下の特徴があります：

- **オブジェクト指向アーキテクチャ**: 各カウンターは独立したSuiオブジェクトとして存在
- **レジストリ機能**: すべてのカウンターを一元管理するレジストリシステム
- **リアルタイム更新**: gRPCストリーミングによるリアルタイムな状態更新
- **フロントエンド統合**: Next.jsとReactを使用したWebインターフェース

## プロジェクト構造

```
knockout/
├── sui/
│   └── knockout-contract/          # Sui Moveコントラクト
│       ├── Move.toml                # パッケージ設定
│       ├── sources/
│       │   └── knockout-contract.move  # メインコントラクト
│       ├── tests/
│       │   └── knockout-contract_tests.move  # ユニットテスト
│       └── deploy.sh               # デプロイスクリプト
└── frontend/                        # Next.jsフロントエンド
    ├── src/
    │   ├── app/
    │   │   └── page.tsx            # メインページ
    │   ├── components/
    │   │   └── CounterList.tsx    # カウンターリストコンポーネント
    │   └── lib/
    │       └── sui.ts              # Sui SDK統合ロジック
    └── package.json
```

## Sui Moveコントラクト

### パッケージ情報

- **パッケージID**: `0x5fa6754acdef054ffa26ae6b5f336d1bb98111dacb98ad105b04f86abcce977e`
- **モジュール名**: `knockout_contract`
- **ネットワーク**: Sui Testnet

### データ構造

#### Counter構造体

```move
struct Counter has key {
    id: UID,
    value: u64,
}
```

各カウンターは独立したSuiオブジェクトとして存在し、`value`フィールドで現在のカウント値を保持します。

#### CounterRegistry構造体

```move
struct CounterRegistry has key {
    id: UID,
    counters: Table<u64, ID>,  // インデックス -> カウンターID
    next_index: u64,
}
```

すべてのカウンターを一元管理するレジストリです。`Table`を使用して動的フィールドとしてカウンターIDを保存します。

### イベント

#### CounterCreated

```move
struct CounterCreated has copy, drop {
    counter_id: ID,
    value: u64,
    index: u64,
}
```

カウンターが作成されたときに発行されるイベントです。

#### CounterIncremented

```move
struct CounterIncremented has copy, drop {
    counter_id: ID,
    new_value: u64,
}
```

カウンターがインクリメントされたときに発行されるイベントです。

### 主要な関数

#### レジストリ関連

1. **`create_registry(ctx: &mut TxContext): CounterRegistry`**
   - 新しいレジストリを作成します（内部関数）

2. **`create_and_share_registry(ctx: &mut TxContext)`** (entry)
   - レジストリを作成して共有オブジェクトとして公開します

3. **`create_and_register(registry: &mut CounterRegistry, ctx: &mut TxContext)`** (entry)
   - 新しいカウンターを作成してレジストリに登録します
   - カウンターは共有オブジェクトとして作成されます

4. **`registry_size(registry: &CounterRegistry): u64`**
   - レジストリに登録されているカウンターの数を返します

5. **`get_counter_id(registry: &CounterRegistry, index: u64): ID`**
   - 指定されたインデックスのカウンターIDを取得します

#### カウンター操作

1. **`create(ctx: &mut TxContext): Counter`**
   - レジストリなしでカウンターを作成します（後方互換性のため）

2. **`create_and_share(ctx: &mut TxContext)`** (entry)
   - カウンターを作成して共有オブジェクトとして公開します（レジストリなし）

3. **`increment(counter: &mut Counter)`** (entry)
   - カウンターの値を1増やします
   - `CounterIncremented`イベントを発行します

4. **`value(counter: &Counter): u64`**
   - カウンターの現在の値を取得します

### デプロイ方法

```bash
cd sui/knockout-contract
./deploy.sh
```

または手動で：

```bash
sui client publish --gas-budget 100000000
```

### 使用例

#### レジストリの作成

```bash
sui client call \
  --package 0x5fa6754acdef054ffa26ae6b5f336d1bb98111dacb98ad105b04f86abcce977e \
  --module knockout_contract \
  --function create_and_share_registry \
  --gas-budget 10000000
```

#### カウンターの作成と登録

```bash
sui client call \
  --package 0x5fa6754acdef054ffa26ae6b5f336d1bb98111dacb98ad105b04f86abcce977e \
  --module knockout_contract \
  --function create_and_register \
  --args <REGISTRY_ID> \
  --gas-budget 10000000
```

#### カウンターのインクリメント

```bash
sui client call \
  --package 0x5fa6754acdef054ffa26ae6b5f336d1bb98111dacb98ad105b04f86abcce977e \
  --module knockout_contract \
  --function increment \
  --args <COUNTER_ID> \
  --gas-budget 10000000
```

## フロントエンド実装

### 技術スタック

- **フレームワーク**: Next.js 16.0.3
- **UIライブラリ**: React 19.2.0
- **Sui SDK**: @mysten/sui.js 0.54.1
- **言語**: TypeScript

### 主要な機能

#### 1. Suiクライアント設定 (`src/lib/sui.ts`)

```typescript
import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';

const TESTNET_RPC_URL = getFullnodeUrl('testnet');
export const suiClient = new SuiClient({
  url: TESTNET_RPC_URL,
});

export const PACKAGE_ID = '0x5fa6754acdef054ffa26ae6b5f336d1bb98111dacb98ad105b04f86abcce977e';
```

#### 2. カウンターオブジェクトの取得

##### レジストリから取得（推奨）

```typescript
export async function getCounterIdsFromRegistry(registryId: string): Promise<string[]> {
  const dynamicFields = await suiClient.getDynamicFields({
    parentId: registryId,
  });
  
  return dynamicFields.data.map(field => {
    const value = field.objectType.includes('ID') 
      ? field.objectId 
      : (field as any).value;
    return typeof value === 'string' ? value : value.toString();
  });
}
```

##### イベントから取得（フォールバック）

```typescript
export async function discoverCounterIds(): Promise<string[]> {
  const events = await suiClient.queryEvents({
    query: {
      MoveEventType: `${PACKAGE_ID}::knockout_contract::CounterCreated`,
    },
    limit: 100,
  });
  
  return events.data.map(event => {
    const parsed = event.parsedJson as { counter_id?: string };
    return parsed.counter_id || '';
  }).filter(Boolean);
}
```

#### 3. リアルタイム更新（gRPCストリーミング）

##### イベント購読

```typescript
export function subscribeToCounterEvents(
  onCounterCreated: (counterId: string) => void,
  onCounterIncremented: (counterId: string) => void
): () => void {
  // CounterCreatedイベントを購読
  const createdSubscription = await suiClient.subscribeEvent({
    filter: {
      MoveEventType: `${PACKAGE_ID}::knockout_contract::CounterCreated`,
    },
    onMessage: (event) => {
      const parsedJson = event.parsedJson as { counter_id?: string };
      if (parsedJson.counter_id) {
        onCounterCreated(parsedJson.counter_id);
      }
    },
  });

  // CounterIncrementedイベントを購読
  const incrementedSubscription = await suiClient.subscribeEvent({
    filter: {
      MoveEventType: `${PACKAGE_ID}::knockout_contract::CounterIncremented`,
    },
    onMessage: (event) => {
      const parsedJson = event.parsedJson as { counter_id?: string };
      if (parsedJson.counter_id) {
        onCounterIncremented(parsedJson.counter_id);
      }
    },
  });

  return () => {
    createdSubscription.unsubscribe();
    incrementedSubscription.unsubscribe();
  };
}
```

##### レジストリ変更の監視

```typescript
export function subscribeToRegistryChanges(
  registryId: string,
  onRegistryChanged: () => void
): () => void {
  const subscription = await suiClient.subscribeTransaction({
    filter: {
      ChangedObject: registryId,
    },
    onMessage: (transaction) => {
      onRegistryChanged();
    },
  });

  return () => {
    subscription.unsubscribe();
  };
}
```

#### 4. ローカルストレージ管理

カウンターIDとレジストリIDをブラウザのローカルストレージに保存：

```typescript
const COUNTER_IDS_KEY = 'knockout_counter_ids';
const REGISTRY_ID_KEY = 'knockout_registry_id';

export function saveCounterId(counterId: string): void {
  const ids = getStoredCounterIds();
  if (!ids.includes(counterId)) {
    ids.push(counterId);
    localStorage.setItem(COUNTER_IDS_KEY, JSON.stringify(ids));
  }
}

export function saveRegistryId(registryId: string): void {
  localStorage.setItem(REGISTRY_ID_KEY, registryId);
}
```

### CounterListコンポーネント

#### 主要な機能

1. **カウンターリストの表示**: レジストリまたはイベントから取得したカウンターを表示
2. **リアルタイム更新**: gRPCストリーミングでカウンターの作成・更新を監視
3. **レジストリ管理**: レジストリIDの設定と管理
4. **手動追加**: カウンターIDを手動で追加可能

#### リアルタイム更新の仕組み

```typescript
// レジストリ変更の監視
useEffect(() => {
  if (!registryId) return;
  
  const unsubscribe = subscribeToRegistryChanges(registryId, async () => {
    await fetchCounters(); // レジストリから全カウンターを再取得
  });
  
  return () => unsubscribe();
}, [registryId]);

// イベント購読
useEffect(() => {
  const unsubscribe = subscribeToCounterEvents(
    async (counterId) => {
      // 新しいカウンターが作成された
      if (registryId) {
        await fetchCounters(); // レジストリから再取得
      } else {
        // 個別にカウンターを取得
        const counter = await getCounterById(counterId);
        if (counter) {
          setCounters(prev => [...prev, counter]);
        }
      }
    },
    async (counterId) => {
      // カウンターがインクリメントされた
      const counter = await getCounterById(counterId);
      if (counter) {
        setCounters(prev => 
          prev.map(c => c.objectId === counterId ? counter : c)
        );
      }
    }
  );
  
  return () => unsubscribe();
}, [registryId]);
```

## リアルタイム更新のアーキテクチャ

### gRPCストリーミング

Sui SDKの`subscribeEvent`と`subscribeTransaction`を使用して、WebSocketベースのgRPCストリーミングでリアルタイム更新を実現しています。

#### イベント購読の流れ

1. **CounterCreatedイベント**: 新しいカウンターが作成されたときに通知
2. **CounterIncrementedイベント**: カウンターがインクリメントされたときに通知
3. **レジストリ変更**: レジストリオブジェクトが変更されたときに通知

#### フォールバック機構

gRPCストリーミングが失敗した場合、自動的にポーリングにフォールバック：

- レジストリ監視: 2秒ごとにレジストリのバージョンをチェック
- イベント監視: 3秒ごとに新しいイベントをポーリング

## デプロイ済みオブジェクト

### レジストリ

- **レジストリID**: `0xb58625fa39c57e1973cabace998dd2a59277059b5e33a3bd313eb1de321a3cb3`
- **タイプ**: `0x5fa6754acdef054ffa26ae6b5f336d1bb98111dacb98ad105b04f86abcce977e::knockout_contract::CounterRegistry`
- **状態**: Shared Object

### カウンター例

最新のカウンター:
- **カウンターID**: `0xd98b73f8f17b4d5192fce6b0411ca2ccb5659d98c98dc7abe404987e6649aa58`
- **インデックス**: 5
- **タイプ**: `0x5fa6754acdef054ffa26ae6b5f336d1bb98111dacb98ad105b04f86abcce977e::knockout_contract::Counter`

## 開発手順

### 1. Suiコントラクトのビルドとテスト

```bash
cd sui/knockout-contract
sui move build
sui move test
```

### 2. コントラクトのデプロイ

```bash
./deploy.sh
```

### 3. フロントエンドの起動

```bash
cd frontend
npm install
npm run dev
```

### 4. ブラウザで確認

http://localhost:3000 にアクセスして、カウンターリストを確認します。

## トラブルシューティング

### gRPCストリーミングが動作しない場合

1. ブラウザのコンソールでエラーを確認
2. フォールバックのポーリングが動作しているか確認
3. Sui TestnetのRPCエンドポイントが利用可能か確認

### カウンターが表示されない場合

1. レジストリIDが正しく設定されているか確認
2. ブラウザのローカルストレージを確認
3. ネットワークタブでAPIリクエストが成功しているか確認

### リアルタイム更新が反映されない場合

1. ブラウザのコンソールでイベント受信ログを確認
2. `subscribeToCounterEvents`と`subscribeToRegistryChanges`が正常に動作しているか確認
3. 必要に応じてページをリロード

## 今後の改善点

1. **エラーハンドリングの強化**: より詳細なエラーメッセージとリトライ機構
2. **パフォーマンス最適化**: 大量のカウンターがある場合の効率的な取得
3. **UI改善**: カウンターのインクリメント機能をUIから実行可能に
4. **認証機能**: ウォレット接続によるトランザクション署名
5. **履歴表示**: カウンターの変更履歴の表示

## 参考資料

- [Sui Documentation](https://docs.sui.io/)
- [Sui Move Language](https://docs.sui.io/build/move)
- [Sui TypeScript SDK](https://docs.sui.io/build/typescript-sdk)
- [Sui Events API](https://docs.sui.io/build/event_api)

## ライセンス

このプロジェクトはMITライセンスの下で公開されています。

