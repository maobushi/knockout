import { NextResponse } from "next/server";
import type { EventMessage } from "@/types/events";
import { emitEvent } from "@/lib/server/io";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as EventMessage;
    if (
      !body ||
      !body.seat ||
      !body.seat.dir ||
      body.seat.row == null ||
      body.seat.col == null ||
      typeof body.text !== "string"
    ) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    
    // イベントを送信（WebSocketサーバーは /api/socket で初期化される）
    emitEvent(body);
    
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/events] エラー:", error);
    return NextResponse.json({ error: "Bad Request" }, { status: 400 });
  }
}


