"use client";
import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect } from "react";
import { CameraRig } from "@/components/CameraRig";
import { Ring } from "@/components/Ring";
import { Stands } from "@/components/Stands";
import { DanmakuLayer } from "@/components/danmaku/DanmakuLayer";
import AfterimageEffect from "@/components/AfterimageEffect";
import { useSeatHighlightStore } from "@/lib/seatHighlightStore";
import { seatToSeatAddresses, teamToColor } from "@/lib/sui-utils";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { CONTRACT_CONFIG } from "@/lib/contract";
import type { EventMessage } from "@/types/events";
import { useDanmakuEventStore } from "@/lib/danmakuEventStore";

export default function SceneCanvas() {
  const highlightSeat = useSeatHighlightStore((s) => s.highlightSeat);
  const addEvent = useDanmakuEventStore((s) => s.addEvent);

  // フロントエンドから直接Suiクライアントでカウンターオブジェクトを取得
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    let isPolling = true;

    // Suiクライアントを初期化
    const suiClient = new SuiClient({
      url: getFullnodeUrl("testnet"),
    });

    // 前回のカウンター値を保存（JSON形式）
    // key: objectId, value: number（値のみ、差分検知のため）
    const previousValues = new Map<string, number>();

    const pollCounters = async () => {
      if (!isPolling) return;

      try {
        // Counterは共有オブジェクトなので、getOwnedObjectsでは取得できない
        // イベントからcounterIdを収集して、それらのオブジェクトを直接取得する
        
        // イベントから最新のcounterIdを取得（最大400件まで）
        const events = await suiClient.queryEvents({
          query: {
            MoveEventType: CONTRACT_CONFIG.EVENT_TYPE_INCREMENTED,
          },
          limit: 400, // 400個の椅子に対応
          order: "descending",
        });

        // イベントからcounterIdを収集（重複を除去）
        const counterIds = new Set<string>();
        for (const event of events.data) {
          if (event.parsedJson && typeof event.parsedJson === 'object') {
            const parsed = event.parsedJson as any;
            const counterId = parsed.counter_id?.id || parsed.counter_id;
            if (counterId && typeof counterId === 'string') {
              counterIds.add(counterId);
            }
          }
        }

        let changedCount = 0;
        const changedSeats: Array<{ seat: number; team: number; counterId: string }> = [];

        // 各Counterオブジェクトを取得して値を監視（並列処理で高速化）
        const objectPromises = Array.from(counterIds).map(async (counterId) => {
          try {
            const object = await suiClient.getObject({
              id: counterId,
              options: {
                showContent: true,
                showType: true,
              },
            });

            if (object.data && object.data.content && 'fields' in object.data.content) {
              const fields = object.data.content.fields as any;
              const value = Number(fields.value || 0);
              const seat = Number(fields.seat || 0);
              const team = Number(fields.team || 0);

              // 前回の値を取得
              const previousValue = previousValues.get(counterId) ?? 0;

              // 差分があるかどうかだけをチェック
              const hasChanged = value !== previousValue;

              if (hasChanged) {
                // 差分がある場合、最大のエフェクトを発生させる
                changedSeats.push({ seat, team, counterId });
                previousValues.set(counterId, value);
                changedCount++;
              } else {
                // 値が変化していない場合も最新の値を保持
                previousValues.set(counterId, value);
              }

              return { hasChanged, seat, team, counterId, value, previousValue };
            }
            return null;
          } catch (err) {
            console.warn(`[カウンター監視] オブジェクト取得エラー (${counterId}):`, err);
            return null;
          }
        });

        // すべてのオブジェクト取得を待機
        await Promise.all(objectPromises);

        // 差分がある場合、起こりうる最大のエフェクトを発生させる
        if (changedSeats.length > 0) {
          console.log(`[カウンター監視] ${changedSeats.length}件の差分を検知、最大エフェクトを発生`);

          // 最大強度の設定
          const maxIntensity = 20; // 最大強度（20回のハイライト追加で最大限に光る）
          const ttl = 15; // 15秒間持続

          // 各変化した座席に対して最大のエフェクトを発生
          for (const { seat, team, counterId } of changedSeats) {
            const color = teamToColor(team);
            
            // seat (0-19) を使って、400個の椅子のうち対応する椅子をすべて取得
            // 条件: インデックス % 20 == seat の椅子を選択
            const seatAddresses = seatToSeatAddresses(seat);
            
            console.log(`[カウンター監視] seat=${seat}に対応する${seatAddresses.length}個の椅子を光らせる`);

            // 各対応する椅子に対して最大のエフェクトを発生
            for (const seatAddress of seatAddresses) {
              // 最大強度でハイライト（複数回追加して強度を最大化）
              for (let i = 0; i < maxIntensity; i++) {
                highlightSeat(seatAddress, color, ttl);
              }

              // 文字のビーム（DanmakuLayer）を発生させる
              const eventMessage: EventMessage = {
                seat: seatAddress,
                text: `Team ${team} - Seat ${seat}`,
                color,
                speed: 1.0,
                ttl: 10,
                fontSize: 0.3,
              };

              // 文字のビーム（DanmakuLayer）を発生させる
              // Zustandストアに直接イベントを追加（WebSocket不要）
              addEvent(eventMessage);
            }

            console.log(`[カウンター監視] 最大エフェクト発生: seat=${seat}, team=${team}, counterId=${counterId}, ${seatAddresses.length}個の椅子`);
          }
        }
      } catch (error) {
        console.error("[カウンター監視] エラー:", error);
      }
    };

    // 初回実行
    pollCounters();

    // 1秒ごとにポーリング
    intervalId = setInterval(pollCounters, 1000);

    return () => {
      isPolling = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [highlightSeat]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#0C0403"
      }}
    >
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true }}
        onCreated={({ gl, scene }) => {
          gl.setClearColor("#0C0403", 1);
          scene.matrixAutoUpdate = true;
        }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 15, 10]} intensity={0.8} />
        <Suspense fallback={null}>
          <CameraRig />
          <Ring />
          <Stands />
          <DanmakuLayer />
          <AfterimageEffect />
        </Suspense>
      </Canvas>
    </div>
  );
}


