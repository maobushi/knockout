import { NextRequest, NextResponse } from "next/server";
import { Buffer } from "buffer";
import { Transaction } from "@mysten/sui/transactions";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";

// Suiクライアントを初期化
const suiClient = new SuiClient({
  url: getFullnodeUrl("testnet"),
});

export async function POST(request: NextRequest) {
  try {
    // Cookieから秘密鍵を取得
    const secretKey = request.cookies.get("session_secret_key")?.value;
    
    if (!secretKey) {
      return NextResponse.json(
        { error: "セッションキーが見つかりません" },
        { status: 401 }
      );
    }

    // リクエストボディからパラメータを取得
    const body = await request.json();
    const { counterId, sessionAddress, packageId, seat, team } = body;

    if (!counterId || !sessionAddress || !packageId) {
      return NextResponse.json(
        { error: "必要なパラメータが不足しています" },
        { status: 400 }
      );
    }

    // seatとteamのバリデーション
    const seatValue = seat !== undefined ? Number(seat) : Math.floor(Math.random() * 20);
    const teamValue = team !== undefined ? Number(team) : Math.floor(Math.random() * 2);
    
    if (seatValue < 0 || seatValue >= 20) {
      return NextResponse.json(
        { error: "seatは0-19の範囲で指定してください" },
        { status: 400 }
      );
    }
    
    if (teamValue < 0 || teamValue >= 2) {
      return NextResponse.json(
        { error: "teamは0または1を指定してください" },
        { status: 400 }
      );
    }

    // 秘密鍵からキーペアを復元
    let sessionKeypair: Ed25519Keypair;
    try {
      console.log("復元開始:", {
        secretKeyLength: secretKey.length,
        secretKeyPreview: secretKey.substring(0, 50),
      });

      // cookieの値はURLエンコードされているのでデコード
      const decodedSecretKey = decodeURIComponent(secretKey);
      console.log("URLデコード後:", {
        decodedLength: decodedSecretKey.length,
        decodedPreview: decodedSecretKey.substring(0, 50),
      });

      if (decodedSecretKey.startsWith("suiprivkey")) {
        // 正規のエクスポート文字列をそのまま渡す
        sessionKeypair = Ed25519Keypair.fromSecretKey(decodedSecretKey);
      } else {
        // レガシー: base64 などで保存された 32/64 バイト配列に対応
        const keyBytes = Uint8Array.from(
          Buffer.from(decodedSecretKey, "base64")
        );

        let secretKeyBytes: Uint8Array;
        if (keyBytes.length === 32) {
          secretKeyBytes = keyBytes;
        } else if (keyBytes.length === 64) {
          secretKeyBytes = keyBytes.slice(0, 32);
        } else if (keyBytes.length >= 45) {
          // "suiprivkey" を誤って除去して base64 したケース: 末尾32バイトを使用
          secretKeyBytes = keyBytes.slice(keyBytes.length - 32);
          console.warn(
            `想定外のキー長 (${keyBytes.length}) を検出。末尾32バイトで復元を試みます。`
          );
        } else {
          return NextResponse.json(
            { error: `予期しないキーサイズ: ${keyBytes.length}バイト` },
            { status: 401 }
          );
        }

        sessionKeypair = Ed25519Keypair.fromSecretKey(secretKeyBytes);
      }

      console.log("キーペア復元情報:", {
        restoredAddress: sessionKeypair.getPublicKey().toSuiAddress(),
        expectedAddress: sessionAddress,
        match: sessionKeypair.getPublicKey().toSuiAddress() === sessionAddress,
      });
    } catch (err) {
      console.error("セッションキー復元エラー:", err);
      console.error("secretKey length:", secretKey?.length);
      console.error("secretKey preview:", secretKey?.substring(0, 50));
      return NextResponse.json(
        { error: `セッションキーの復元に失敗しました: ${err instanceof Error ? err.message : String(err)}` },
        { status: 401 }
      );
    }

    // セッションアドレスの検証
    const signerAddress = sessionKeypair.getPublicKey().toSuiAddress();
    if (signerAddress !== sessionAddress) {
      return NextResponse.json(
        { error: "セッションアドレスが一致しません" },
        { status: 401 }
      );
    }

    // バージョン不整合エラーを検出する関数
    const isVersionMismatchError = (error: any): boolean => {
      const errorMessage = error?.message || error?.toString() || "";
      return (
        errorMessage.includes("not available for consumption") ||
        errorMessage.includes("current version") ||
        errorMessage.includes("already locked") ||
        errorMessage.includes("Version")
      );
    };

    // トランザクションを実行する関数（リトライ対応）
    const executeIncrementTransaction = async (retryCount = 0): Promise<any> => {
      const maxRetries = 2;
      
      try {
        // トランザクションを組む直前に、必ず最新のカウンターオブジェクトを取得
        const counterObject = await suiClient.getObject({
          id: counterId,
          options: { showContent: true, showOwner: true },
        });

        if (!counterObject.data) {
          throw new Error("カウンターオブジェクトが見つかりません");
        }

        // session_ownerを確認
        if (counterObject.data.content && "fields" in counterObject.data.content) {
          const fields = counterObject.data.content.fields as any;
          const expectedSessionOwner = fields.session_owner;

          if (expectedSessionOwner !== sessionAddress) {
            return NextResponse.json(
              { error: "セッションキーのアドレスが一致しません" },
              { status: 403 }
            );
          }
        }

        console.log(`トランザクション構築 (リトライ: ${retryCount}):`, {
          counterId,
          version: counterObject.data.version,
          digest: counterObject.data.digest,
        });

        // Gasオブジェクトを明示的に取得（最新のものを使用）
        const gasObjects = await suiClient.getCoins({
          owner: sessionAddress,
          coinType: "0x2::sui::SUI",
        });

        if (!gasObjects.data || gasObjects.data.length === 0) {
          throw new Error("ガス用のSUIコインが見つかりません");
        }

        // 最新のGasオブジェクトを使用（最初のものが最新の可能性が高い）
        const gasObject = gasObjects.data[0];
        console.log(`Gasオブジェクト取得:`, {
          objectId: gasObject.coinObjectId,
          version: gasObject.version,
          balance: gasObject.balance,
        });

        // トランザクションを作成（最新のオブジェクトを使用）
        const tx = new Transaction();
        tx.setSender(sessionAddress);
        tx.setGasPayment([{
          objectId: gasObject.coinObjectId,
          version: gasObject.version,
          digest: gasObject.digest,
        }]);
        tx.setGasBudget(10000000); // 10 MIST = 0.00001 SUI（十分なガス予算）
        
        tx.moveCall({
          target: `${packageId}::knockout_contract::increment`,
          arguments: [
            tx.object(counterId), // 最新のバージョンが自動的に使用される
            tx.pure.u8(seatValue),
            tx.pure.u8(teamValue),
          ],
        });

        // トランザクションに署名（Gasオブジェクトのバージョンが確定）
        const signedTransaction = await tx.sign({
          signer: sessionKeypair,
          client: suiClient,
        });

        // トランザクションを即座に実行（バージョンが変わる前に）
        const result = await suiClient.executeTransactionBlock({
          transactionBlock: signedTransaction.bytes,
          signature: signedTransaction.signature,
          options: {
            showEffects: true,
            showObjectChanges: true,
            showEvents: true,
          },
        });

        return result;
      } catch (error: any) {
        // バージョン不整合エラーで、まだリトライ可能な場合
        if (isVersionMismatchError(error) && retryCount < maxRetries) {
          console.warn(
            `バージョン不整合エラー検出 (リトライ ${retryCount + 1}/${maxRetries}):`,
            error.message
          );
          
          // 少し待ってからリトライ（他のトランザクションが完了するのを待つ）
          // リトライ回数に応じて待機時間を増やす（200ms, 400ms, 600ms...）
          const waitTime = 200 * (retryCount + 1);
          console.log(`リトライ前に${waitTime}ms待機します...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          
          return executeIncrementTransaction(retryCount + 1);
        }
        
        // リトライ不可能またはバージョン不整合以外のエラー
        throw error;
      }
    };

    // トランザクションを実行（リトライ対応）
    const result = await executeIncrementTransaction();

    return NextResponse.json({
      success: true,
      digest: result.digest,
      result,
    });
  } catch (error: any) {
    console.error("API エラー:", error);
    return NextResponse.json(
      {
        error: error.message || "トランザクションの実行に失敗しました",
        details: error.toString(),
      },
      { status: 500 }
    );
  }
}
