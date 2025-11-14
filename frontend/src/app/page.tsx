import CounterList from '@/components/CounterList';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Knockout Counter</h1>
          <p className="text-gray-600">
            Suiブロックチェーン上のカウンターオブジェクトをリアルタイムで表示
          </p>
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>パッケージID:</strong>{' '}
              <code className="font-mono text-xs">0x5fa6754acdef054ffa26ae6b5f336d1bb98111dacb98ad105b04f86abcce977e</code>
            </p>
            <p className="text-sm text-blue-800 mt-2">
              <strong>ネットワーク:</strong> Sui Testnet
            </p>
          </div>
        </div>
        <CounterList />
      </main>
    </div>
  );
}
