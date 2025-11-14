#!/bin/bash

# Suiコントラクトデプロイスクリプト

set -e

echo "🚀 Suiコントラクトをデプロイします..."

# ビルド
echo "📦 コントラクトをビルドしています..."
sui move build

# ガス予算の設定（デフォルト: 100000000）
GAS_BUDGET=${1:-100000000}

# デプロイ
echo "📤 コントラクトをデプロイしています（ガス予算: $GAS_BUDGET）..."
sui client publish --gas-budget $GAS_BUDGET

echo "✅ デプロイが完了しました！"

