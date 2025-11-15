# Knockout Contract ドキュメント

## 1. 概要

`knockout-contract` は、Sui Move で実装されたカウンター管理のメタコントラクトです。
メインウォレットとセッションキーを組み合わせた認証システムにより、
ユーザー体験を向上させたカウンター機能を提供します。

### 主な特徴

* **セッションキー対応**: メインウォレットで一度初期化後、セッションキーで継続的な操作が可能
* **レジストリ管理**: メインオーナーごとのカウンターを一元管理
* **イベント発行**: カウンター作成・更新時にイベントを発行し、フロントエンドでの状態同期を支援
* **共有オブジェクト**: カウンターとレジストリは共有オブジェクトとして設計され、複数のユーザーがアクセス可能

---

## 2. 目的

このコントラクトは、以下の目的で設計されています：

1. **UX向上**: メインウォレットでの署名は初期化時のみとし、以降の操作はセッションキーで自動実行
2. **状態管理**: 各ユーザーのカウンターをレジストリで一元管理
3. **拡張性**: 将来的なゲームロジックやベッティング機能の基盤として使用

---

## 3. 構造体

### 3.1 Counter

カウンターオブジェクト。メインウォレットとセッションキーの両方のアドレスを保持します。

```move
struct Counter has key {
    id: UID,
    main_owner: address,      // メインウォレットのアドレス
    session_owner: address,   // セッションキーのアドレス
    value: u64,
}
```

**フィールド説明**:
* `id`: オブジェクトの一意識別子（UID）
* `main_owner`: カウンターの所有者であるメインウォレットのアドレス
* `session_owner`: セッションキーのアドレス（操作に使用）
* `value`: カウンターの現在の値

### 3.2 CounterRegistry

カウンターレジストリ。メインオーナーのアドレスをキーとしてカウンターIDを管理します。

```move
struct CounterRegistry has key {
    id: UID,
    counters: Table<address, ID>, // main_owner -> カウンターID
}
```

**フィールド説明**:
* `id`: レジストリの一意識別子（UID）
* `counters`: メインオーナーのアドレスをキー、カウンターIDを値とするテーブル

---

## 4. イベント

### 4.1 CounterCreated

カウンターが作成された際に発行されるイベント。

```move
struct CounterCreated has copy, drop {
    counter_id: ID,
    main_owner: address,
    session_owner: address,
    value: u64,
}
```

### 4.2 CounterIncremented

カウンターがインクリメントされた際に発行されるイベント。

```move
struct CounterIncremented has copy, drop {
    counter_id: ID,
    old_value: u64,
    new_value: u64,
}
```

---

## 5. エラーコード

| エラーコード | 定数名 | 説明 |
|------------|--------|------|
| 1 | `E_NOT_AUTHORIZED` | 権限エラー（セッションキーで署名されていない） |
| 2 | `E_COUNTER_NOT_FOUND` | カウンターが存在しない |

---

## 6. 関数一覧

### 6.1 create_registry

レジストリを作成する（一度だけ実行）。

```move
public fun create_registry(ctx: &mut TxContext): CounterRegistry
```

**説明**:
* 新しい `CounterRegistry` を作成して返します
* 内部関数として使用され、直接呼び出すことは通常ありません

### 6.2 create_and_share_registry

レジストリを共有オブジェクトとして作成し、即時にカウンターを発行。

```move
public entry fun create_and_share_registry(
    session_owner: address,
    ctx: &mut TxContext
)
```

**説明**:
* レジストリを作成し、同時に呼び出し元のメインウォレット用のカウンターを初期化
* レジストリを共有オブジェクトとして公開
* `session_owner` パラメータでセッションキーのアドレスを登録

**パラメータ**:
* `session_owner`: セッションキーのアドレス
* `ctx`: トランザクションコンテキスト

### 6.3 initialize_counter

カウンターを初期化（メインウォレットで実行）。

```move
public entry fun initialize_counter(
    registry: &mut CounterRegistry,
    session_owner: address,
    ctx: &mut TxContext
)
```

**説明**:
* メインウォレットで署名して実行
* セッションキーのアドレスを紐づけてカウンターを発行
* 既存のカウンターが存在する場合は、レジストリから削除してから新しいカウンターを作成

**パラメータ**:
* `registry`: カウンターレジストリへの参照
* `session_owner`: セッションキーのアドレス
* `ctx`: トランザクションコンテキスト

### 6.4 increment

カウンターの値を増やす（セッションキーで署名して実行）。

```move
public entry fun increment(
    counter: &mut Counter,
    ctx: &mut TxContext
)
```

**説明**:
* セッションキーで署名されたトランザクションでのみ実行可能
* カウンターの値を1増やします
* `CounterIncremented` イベントを発行

**パラメータ**:
* `counter`: カウンターオブジェクトへの参照
* `ctx`: トランザクションコンテキスト

**エラー**:
* `E_NOT_AUTHORIZED`: セッションキーで署名されていない場合

### 6.5 value

カウンターの現在の値を取得する。

```move
public fun value(counter: &Counter): u64
```

**説明**:
* カウンターの現在の値を返します
* view関数として使用可能

### 6.6 get_counter_id

カウンターIDを取得（main_ownerで検索）。

```move
public fun get_counter_id(
    registry: &CounterRegistry,
    main_owner: address
): ID
```

**説明**:
* レジストリからメインオーナーのアドレスに対応するカウンターIDを取得
* view関数として使用可能

**エラー**:
* `E_COUNTER_NOT_FOUND`: カウンターが存在しない場合

### 6.7 main_owner

メインオーナーのアドレスを取得。

```move
public fun main_owner(counter: &Counter): address
```

### 6.8 session_owner

セッションオーナーのアドレスを取得。

```move
public fun session_owner(counter: &Counter): address
```

---

## 7. 使用フロー

### 7.1 初期セットアップ

1. **レジストリの作成**:
   ```
   create_and_share_registry(session_owner_address)
   ```
   * メインウォレットで署名
   * レジストリが共有オブジェクトとして作成される
   * 同時にカウンターが初期化される

2. **または、既存レジストリにカウンターを追加**:
   ```
   initialize_counter(registry, session_owner_address)
   ```
   * メインウォレットで署名
   * レジストリにカウンターが登録される

### 7.2 カウンター操作

1. **カウンターIDの取得**:
   ```
   counter_id = get_counter_id(registry, main_owner_address)
   ```

2. **カウンターのインクリメント**:
   ```
   increment(counter)
   ```
   * セッションキーで署名
   * ユーザーは署名ポップアップなしで操作可能（Sponsored Transaction使用時）

3. **値の確認**:
   ```
   current_value = value(counter)
   ```

---

## 8. セッションキーとの連携

このコントラクトは、セッションキー機能と組み合わせて使用することを想定しています。

### 8.1 セッションキーの生成（フロントエンド側）

```typescript
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';

const keypair = new Ed25519Keypair();
const sessionAddress = keypair.getPublicKey().toSuiAddress();
// secretKey はメモリ or localStorage に保存
```

### 8.2 初期化（メインウォレットで1回のみ）

```typescript
// メインウォレットで署名
await signAndExecuteTransaction({
  transaction: {
    kind: 'moveCall',
    data: {
      packageObjectId: PACKAGE_ID,
      module: 'knockout_contract',
      function: 'initialize_counter',
      arguments: [registryId, sessionAddress],
    },
  },
});
```

### 8.3 継続的な操作（セッションキーで自動実行）

```typescript
// セッションキーで署名（自動）
await signAndExecuteTransaction({
  transaction: {
    kind: 'moveCall',
    data: {
      packageObjectId: PACKAGE_ID,
      module: 'knockout_contract',
      function: 'increment',
      arguments: [counterId],
    },
  },
  signer: sessionKeypair, // セッションキーで署名
});
```

---

## 9. イベント監視

フロントエンドでは、以下のイベントを監視して状態を更新できます。

### 9.1 CounterCreated イベント

```typescript
// カウンター作成時の処理
eventEmitter.on('CounterCreated', (event) => {
  console.log('Counter created:', event.counter_id);
  console.log('Main owner:', event.main_owner);
  console.log('Session owner:', event.session_owner);
});
```

### 9.2 CounterIncremented イベント

```typescript
// カウンター更新時の処理
eventEmitter.on('CounterIncremented', (event) => {
  console.log('Counter incremented:', event.counter_id);
  console.log('Old value:', event.old_value);
  console.log('New value:', event.new_value);
});
```

---

## 10. ガススポンサー（Sponsored Transaction）

セッションキーにはガス用のSUIがないため、Sponsored Transactionを使用することを推奨します。

* ユーザー: セッションキーで署名
* ガス: スポンサーアカウントが負担

これにより、ユーザーはガスを気にせずに操作できます。

---

## 11. セキュリティ考慮事項

1. **権限チェック**: `increment` 関数は、セッションキーのアドレスで署名されたトランザクションのみを受け付けます
2. **メインオーナー管理**: カウンターの所有権はメインオーナーが管理し、セッションキーの変更はメインウォレットでのみ可能
3. **共有オブジェクト**: カウンターとレジストリは共有オブジェクトとして設計されており、複数のユーザーが安全にアクセスできます

---

## 12. 今後の拡張

このコントラクトは、以下の機能拡張が可能です：

* カウンターのリセット機能
* カウンターの削除機能
* セッションキーの更新機能
* カウンターの履歴管理
* 複数カウンターの管理
* カウンター間の転送機能

---

## 13. 関連ドキュメント

* [セッションキーに関するドキュメント](./sessionkey.md)
* [コンセプトドキュメント](./concept.md)

---

## 14. まとめ

`knockout-contract` は、セッションキー機能を活用したカウンター管理コントラクトです。
メインウォレットでの署名は初期化時のみとし、以降の操作はセッションキーで自動実行することで、
ユーザー体験を大幅に向上させます。

このコントラクトは、将来的なゲームロジックやベッティング機能の基盤としても使用できるよう設計されています。

