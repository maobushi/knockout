"use server";

import { cookies } from "next/headers";
import { Transaction } from "@mysten/sui/transactions";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";

// Suiクライアントを初期化
const suiClient = new SuiClient({
  url: getFullnodeUrl("testnet"),
});

export async function incrementCounter(
  counterId: string,
  sessionAddress: string,
  packageId: string
) {
  try {
    // Cookieから秘密鍵を取得（Server Actionsでは自動的にcookieが共有される）
    const cookieStore = await cookies();
    const secretKey = cookieStore.get("session_secret_key")?.value;

    if (!secretKey) {
      throw new Error("セッションキーが見つかりません");
    }

    if (!counterId || !sessionAddress || !packageId) {
      throw new Error("必要なパラメータが不足しています");
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
      
      // base64デコード
      const secretKeyString = atob(decodedSecretKey);
      console.log("base64デコード後:", {
        stringLength: secretKeyString.length,
      });
      
      const allKeyBytes = new Uint8Array(secretKeyString.length);
      for (let i = 0; i < secretKeyString.length; i++) {
        allKeyBytes[i] = secretKeyString.charCodeAt(i);
      }

      console.log("復元前の情報:", {
        allKeyBytesLength: allKeyBytes.length,
        expectedAddress: sessionAddress,
        first8Bytes: Array.from(allKeyBytes.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' '),
      });

      // Ed25519Keypair.fromSecretKeyは32バイトの秘密鍵を期待
      // getSecretKey()は64バイト（秘密鍵32バイト + 公開鍵32バイト）を返す
      // 最初の32バイトが秘密鍵なので、それを使用
      // 70バイトの場合は、base64エンコード/デコードの問題の可能性があるため、最初の64バイトを使用
      if (allKeyBytes.length === 70) {
        console.warn("キーサイズが70バイトです。最初の64バイトを使用します。");
        const trimmedBytes = allKeyBytes.slice(0, 64);
        const secretKeyBytes = trimmedBytes.slice(0, 32);
        sessionKeypair = Ed25519Keypair.fromSecretKey(secretKeyBytes);
      } else if (allKeyBytes.length === 64) {
        const secretKeyBytes = allKeyBytes.slice(0, 32);
        sessionKeypair = Ed25519Keypair.fromSecretKey(secretKeyBytes);
      } else {
        throw new Error(`予期しないキーサイズ: ${allKeyBytes.length}バイト（期待: 64バイトまたは70バイト）`);
      }
      
      // 64バイトの形式を確認: 最初の32バイトが秘密鍵、後半32バイトが公開鍵の可能性
      const first32Bytes = allKeyBytes.slice(0, 32);
      const last32Bytes = allKeyBytes.slice(32, 64);
      
      // まず最初の32バイトで復元を試みる
      sessionKeypair = Ed25519Keypair.fromSecretKey(first32Bytes);
      const restoredPublicKey = sessionKeypair.getPublicKey().toSuiAddress();
      
      console.log("キーペア復元情報:", {
        allKeyBytesLength: allKeyBytes.length,
        first32BytesPreview: Array.from(first32Bytes.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' '),
        last32BytesPreview: Array.from(last32Bytes.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' '),
        restoredAddress: restoredPublicKey,
        expectedAddress: sessionAddress,
        match: restoredPublicKey === sessionAddress,
      });
    } catch (err) {
      console.error("セッションキー復元エラー:", err);
      throw new Error(
        `セッションキーの復元に失敗しました: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    // セッションアドレスの検証
    const signerAddress = sessionKeypair.getPublicKey().toSuiAddress();
    console.log("アドレス検証:", {
      signerAddress,
      sessionAddress,
      match: signerAddress === sessionAddress,
    });
    
    if (signerAddress !== sessionAddress) {
      throw new Error(
        `セッションアドレスが一致しません。復元されたアドレス: ${signerAddress}, 期待されるアドレス: ${sessionAddress}`
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
          throw new Error("セッションキーのアドレスが一致しません");
        }
      }
    } catch (err) {
      console.error("カウンターオブジェクトの取得エラー:", err);
      throw new Error("カウンターオブジェクトの取得に失敗しました");
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

    return {
      success: true,
      digest: result.digest,
      result,
    };
  } catch (error: any) {
    console.error("Server Action エラー:", error);
    throw new Error(
      error.message || "トランザクションの実行に失敗しました"
    );
  }
}

