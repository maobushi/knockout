# Knockout Contract

Suiブロックチェーン上にデプロイするためのMoveコントラクトプロジェクトです。

## プロジェクト構造

```
knockout-contract/
├── Move.toml          # プロジェクト設定ファイル
├── sources/           # Moveソースコード
│   └── knockout-contract.move
├── tests/             # テストコード
│   └── knockout-contract_tests.move
└── README.md          # このファイル
```

## 前提条件

- Sui CLIがインストールされていること
- Suiネットワークに接続するためのアカウントとガス代が必要

## ビルド

```bash
sui move build
```

## テスト

```bash
sui move test
```

## デプロイ

### 1. アカウントの準備

まず、Suiアカウントを作成（または既存のアカウントを使用）：

```bash
sui client active-address
```

アカウントがない場合は作成：

```bash
sui client new-address ed25519
```

### 2. ガスの取得

テストネットでガスを取得する場合：

```bash
# テストネットのfaucetからガスを取得
curl --location --request POST 'https://faucet.testnet.sui.io/gas' \
--header 'Content-Type: application/json' \
--data-raw '{
    "FixedAmountRequest": {
        "recipient": "YOUR_ADDRESS"
    }
}'
```

### 3. コントラクトの公開

```bash
sui client publish --gas-budget 100000000
```

### 4. 公開されたパッケージの確認

デプロイが成功すると、パッケージIDが表示されます。このIDを使用して、公開されたモジュールを確認できます：

```bash
sui client object <PACKAGE_ID>
```

## ネットワークの切り替え

異なるネットワークにデプロイする場合：

```bash
# テストネットに切り替え
sui client switch --env testnet

# メインネットに切り替え
sui client switch --env mainnet

# ローカルネットワークに切り替え
sui client switch --env localnet
```

## コントラクトの機能

このコントラクトには以下の機能が含まれています：

- **Counter**: カウンターオブジェクト
- **create_and_share**: 共有可能なカウンターを作成
- **increment**: カウンターの値を増やす
- **value**: カウンターの現在の値を取得

## 開発

### 新しい関数の追加

`sources/knockout-contract.move`を編集して、新しい機能を追加できます。

### テストの追加

`tests/knockout-contract_tests.move`に新しいテストケースを追加できます。

## 参考資料

- [Sui公式ドキュメント](https://docs.sui.io/)
- [Move言語ドキュメント](https://move-language.github.io/move/)
- [Sui Move Examples](https://github.com/MystenLabs/sui/tree/main/sui_programmability/examples)

