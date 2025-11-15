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
    const { counterId, sessionAddress, packageId } = body;

    if (!counterId || !sessionAddress || !packageId) {
      return NextResponse.json(
        { error: "必要なパラメータが不足しています" },
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

    // カウンターオブジェクトを取得して、session_ownerを確認
    try {
      const counterObject = await suiClient.getObject({
        id: counterId,
        options: { showContent: true },
      });

      if (counterObject.data?.content && "fields" in counterObject.data.content) {
        const fields = counterObject.data.content.fields as any;
        const expectedSessionOwner = fields.session_owner;

        if (expectedSessionOwner !== sessionAddress) {
          return NextResponse.json(
            { error: "セッションキーのアドレスが一致しません" },
            { status: 403 }
          );
        }
      }
    } catch (err) {
      console.error("カウンターオブジェクトの取得エラー:", err);
      return NextResponse.json(
        { error: "カウンターオブジェクトの取得に失敗しました" },
        { status: 500 }
      );
    }

    // トランザクションを作成
    const tx = new Transaction();
    tx.setSender(sessionAddress);
    tx.moveCall({
      target: `${packageId}::knockout_contract::increment`,
      arguments: [tx.object(counterId)],
    });

    // トランザクションに署名
    const signedTransaction = await tx.sign({
      signer: sessionKeypair,
      client: suiClient,
    });

    // トランザクションを実行
    const result = await suiClient.executeTransactionBlock({
      transactionBlock: signedTransaction.bytes,
      signature: signedTransaction.signature,
      options: {
        showEffects: true,
        showObjectChanges: true,
        showEvents: true,
      },
    });

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
