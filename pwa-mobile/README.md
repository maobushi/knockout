This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Suiet Wallet Kit (Sui) Setup

1. Install dependencies:
   ```bash
   npm install @suiet/wallet-kit @mysten/sui
   ```
2. Start the dev server:
   ```bash
   npm run dev
   ```
3. On the home page, use the “Connect” button (powered by Suiet Kit) to connect Sui wallets.

Docs: https://kit.suiet.app/docs/QuickStart/

## セッションキーテストページ

セッションキーを使用したカウンターコントラクトのテストページが `/session` にあります。

### セットアップ

1. コントラクトをデプロイ:
   ```bash
   cd ../sui/knockout-contract
   sui move build
   sui client publish --gas-budget 100000000
   ```

2. パッケージIDを設定:
   - デプロイ後、パッケージIDが表示されます
   - `.env.local` ファイルを作成して以下を設定:
     ```
     NEXT_PUBLIC_PACKAGE_ID=0x<パッケージID>
     ```
   - または `app/config/contract.ts` を直接編集

3. 開発サーバーを起動:
   ```bash
   bun dev
   ```

4. ブラウザで `/session` にアクセス

### 使用方法

1. **ウォレット接続**: ホームページでウォレットを接続
2. **セッションキー生成**: 「セッションキーを生成」ボタンをクリック
3. **レジストリ作成**: 「レジストリを作成」ボタンをクリック（メインウォレットで署名）
4. **カウンター初期化**: 「カウンターを初期化」ボタンをクリック（メインウォレットで署名）
5. **カウントアップ**: 「カウントアップ」ボタンをクリック（セッションキーで自動署名）

セッションキーで署名されたトランザクションは、ポップアップなしで自動的に実行されます。
