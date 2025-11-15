import { NextResponse } from "next/server";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { CONTRACT_CONFIG } from "@/lib/contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Suiクライアントを初期化
const suiClient = new SuiClient({
  url: getFullnodeUrl("testnet"),
});

// 最後に取得したイベントのカーソルを保存（簡易版：メモリに保存）
let lastCursor: any = null;

export async function GET() {
  try {
    // CounterIncrementedイベントを取得
    const events = await suiClient.queryEvents({
      query: {
        MoveEventType: CONTRACT_CONFIG.EVENT_TYPE_INCREMENTED,
      },
      limit: 50,
      order: "descending",
      ...(lastCursor ? { cursor: lastCursor as any } : {}),
    });

    const processedEvents: Array<{
      seat: number;
      team: number;
      counterId: string;
      newValue: number;
    }> = [];

    for (const event of events.data) {
      if (event.type === CONTRACT_CONFIG.EVENT_TYPE_INCREMENTED && event.parsedJson) {
        const parsed = event.parsedJson as {
          counter_id?: string | { id?: string };
          seat?: number;
          team?: number;
          new_value?: number;
        };

        if (parsed.seat !== undefined && parsed.team !== undefined) {
          const counterId =
            typeof parsed.counter_id === "string"
              ? parsed.counter_id
              : parsed.counter_id?.id
              ? String(parsed.counter_id.id)
              : null;

          if (counterId) {
            processedEvents.push({
              seat: parsed.seat,
              team: parsed.team,
              counterId,
              newValue: parsed.new_value || 0,
            });
          }
        }
      }
    }

    // カーソルを更新
    if (events.nextCursor) {
      lastCursor = events.nextCursor;
    }

    return NextResponse.json({
      ok: true,
      events: processedEvents,
      count: processedEvents.length,
    });
  } catch (error: any) {
    console.error("Suiイベント取得エラー:", error);
    return NextResponse.json(
      { error: error.message || "イベントの取得に失敗しました" },
      { status: 500 }
    );
  }
}

