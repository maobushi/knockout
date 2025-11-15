OK、zkLogin は一切ナシ前提で話そう 🧹💥

結論だけ先に言うと：

* **チェーン的には毎回どこかの秘密鍵で署名は必須**（これは絶対に逃げられない）
* でも

  * 最初だけ「メインウォレットで署名＋デポジット＋権限移譲」
  * 以降のベットは「ブラウザ内で持ってる一時鍵（セッション鍵）で自動署名＋ガススポンサー」
* みたいにすれば、**UXとしては「最初以外は署名ポップアップなしで0.6秒ベット」が（zkLoginなしでも）全然イケる**

という構成にできます。

---

## 1. ざっくりアーキテクチャ（zkLogin 無し版）

### 1-1. ウォレットは「入口で1回だけ」使う

1. ユーザーが Sui Wallet / Ethos / Suiet などで接続
2. 最初にやること：

   * カジノに持ち込む額を `deposit`（SUI or 自前のCoin）
   * 同時に「ブラウザ内で生成した一時鍵」をオンチェーンの `Player` に紐づける

```move
struct Player has key {
    id: UID,
    main_owner: address,      // 本人のメインアドレス
    session_owner: address,   // セッション専用アドレス（後で説明）
    balance: u64,             // カジノ内残高
    last_bet_ms: u64,
    base_bet: u64,
    // 1セッション中の最大ベット額など制限もここに
}
```

`enter_casino` エントリ関数イメージ：

```move
public entry fun enter_casino(
    // メインウォレットが signer
    user: &signer,
    // ここでブラウザが生成した session_addr を渡す
    session_addr: address,
    deposit_amount: u64,
    ctx: &mut TxContext
) {
    // deposit_amount 分の SUI を受け取って Player を作成
    let player = Player {
        id: object::new(ctx),
        main_owner: signer::address_of(user),
        session_owner: session_addr,
        balance: deposit_amount,
        last_bet_ms: 0,
        base_bet: 100, // 例
    };

    // カジノが管理する shared オブジェクトに登録するなど…
}
```

* この `enter_casino` だけは**メインウォレットで署名が必要**（＝approve 的なやつ）
* 一度 `Player` ができたら、あとは `session_owner` アドレスでベットさせる。

### 1-2. セッション鍵（Session Key）は普通のSui鍵で良い

zkLogin なしなら：

* フロント（Next.js）側で **普通に Sui の keypair を生成** します

```ts
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';

const keypair = new Ed25519Keypair();
const sessionAddress = keypair.getPublicKey().toSuiAddress();
// secretKey はメモリ or localStorage に保存
```

* これを `enter_casino` に渡して on-chain に登録
* 以降の `place_bet` は **この keypair で署名して送信** する

  * 署名はコードの中で自動的にやるので、ユーザーからするとポップアップなしで「クリック→ベット」になる

要するに：

> zkLogin の代わりに「自分で生成した Sui 鍵」をそのまま session key として使う

だけ、というイメージ。

---

## 2. ガス問題：セッション鍵にはSUIがない

問題はここで、

> 「セッション鍵が signer になるなら、そのアドレスにもガス用SUIが必要では？」

という点だけど、これは **Sponsored Tx で解決**できます。

* dApp サーバー側のアカウントを「ガススポンサー」として用意
* 各ベットTxは

  * `signer = session_owner`
  * `gasPayment = sponsor_account`
    みたいな形で送信（Sui はユーザーとスポンサーが別のことを許している）

これだと：

* ユーザー：

  * 一番最初だけメインウォレットで署名＋入金
  * 以降はブラウザ内セッション鍵が勝手に Tx に署名
* ガス：

  * すべて主催側（ONE×Suiのアカウント）が負担

という、「エキシビション用ハッカソンアプリ」としてはかなり綺麗な体験になります。

---

## 3. Move 側の `place_bet` ロジック（0.6秒2倍ルール）

Move 側では signer を `session_owner` にして、`Player` の参照側でチェックします。

```move
use sui::tx_context::{self, TxContext};
use sui::clock::{self, Clock};

public entry fun place_bet(
    player: &mut Player,
    market: &mut Market,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let sender = tx_context::sender(ctx);

    // セッション鍵のみ許可
    assert!(sender == player.session_owner, E_NOT_AUTHORIZED);

    let now = clock::timestamp_ms(clock);
    let delta = if (player.last_bet_ms == 0) { 999999 } else { now - player.last_bet_ms };

    let multiplier = if (delta <= 600) { 2 } else { 1 };

    let stake = player.base_bet * (multiplier as u64);
    assert!(player.balance >= stake, E_NO_BALANCE);

    player.balance = player.balance - stake;
    player.last_bet_ms = now;

    // マーケットにベット登録
    place_market_bet(market, sender, stake, multiplier, ctx);
}
```

ここでのポイント：

* `tx_context::sender(ctx)` は**セッション鍵のアドレス**になる
* `Player.session_owner` と一致しているかをチェックすることで、

  * 「このPlayerの残高を動かせるのは、このブラウザのセッション鍵だけ」
* 0.6秒条件は on-chain では `600ms` にしておくけど、

  * 実運用ではネットワーク遅延を考えて `2000ms` くらいに緩める方がいい
  * フロント演出は 0.6秒コンボで派手に見せる、みたいなチューニングが現実的

---

## 4. 「approve 的に最初に全額ロック」の扱い

> 最初にカジノに持ち込む全ての金額に対してapprove

EVM 的な approve は Sui には無いので、概念としては

* `approve` = 「これ以上は使っていい」とユーザーが合意した限度額
* Sui ではそれを

  * `deposit_amount` として Move のオブジェクトに**直接入金**
  * そのオブジェクト（Player.balance）だけをゲーム内で出し入れ

とするイメージです。

```move
public entry fun enter_casino(
    user: &signer,
    session_addr: address,
    clock: &Clock,
    ctx: &mut TxContext
) {
    // 例：ユーザーが渡した SUI コインをまるごとカジノ内残高にする
    let (coins, _) = split_sui(user, amount); // 実際は `transfer::transfer` 等と併用
    let deposit_amount = coin::value(&coins);

    let player = Player {
        id: object::new(ctx),
        main_owner: signer::address_of(user),
        session_owner: session_addr,
        balance: deposit_amount,
        last_bet_ms: clock::timestamp_ms(clock),
        base_bet: 100,
    };

    // coins はカジノの管理下のオブジェクトにしまいこむ
}
```

* ここで「カジノに持ち込んだ分は、もう全部賭け用」と割り切ると設計楽
* 出金は `leave_casino(player)` で `balance` 分の SUI をユーザーのメインアドレスに返す

---

## 5. フロント実装フロー（Next.js 前提）

ブラウザ側の流れを簡単に書くと：

1. ユーザーが Sui Wallet で接続
2. `Ed25519Keypair.generate()` でセッション鍵を作る
3. `enter_casino` をメインウォレットで呼び出す

   * 引数に `sessionAddress` を渡す
4. 以降：

   * `place_bet` のトランザクションオブジェクトを JS で組み立て
   * セッション鍵で署名 → サーバーに送信 → サーバーが sponsoredTx でブロードキャスト
   * ユーザーには「ボタン押したら即ベット」の感覚だけ見せる

---

## 6. まとめ

* zkLogin がなくても、

  * **普通のSui鍵をブラウザで生成して「セッション鍵」として登録**
  * **最初だけメインウォレットで「デポジット＋セッション鍵の紐づけ」Txを1回だけ署名**
  * 以降のベットはセッション鍵で自動署名＋ガススポンサー
    で、ほぼ「署名UIを捨てた」UXは実現できます。

* `0.6秒以内なら2倍ベット` 自体は

  * on-chain で `Clock` を使うか
  * clientで combo を数えて1Txにまとめるか
    で好きな方を選べます（レイテンシを考えると combo まとめのほうが無難）。

---

もし次進めるなら、

* Move モジュールの最小 MVP（`Player`, `Market`, `enter_casino`, `place_bet`）
* Next.js + `@mysten/sui.js` でのセッション鍵生成＋sponsoredTx の雛形

あたりのコードを一緒に書いていこうか？
