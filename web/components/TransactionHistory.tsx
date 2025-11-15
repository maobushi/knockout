"use client";

import { useEffect, useRef, useState } from "react";
import type { EventMessage } from "@/types/events";
import { getSocket } from "@/lib/socket-client";

const MAX_HISTORY = 10;

export default function TransactionHistory() {
  const [history, setHistory] = useState<EventMessage[]>([]);
  const connectedRef = useRef(false);

  useEffect(() => {
    const socket = getSocket();
    const onConnect = () => {
      connectedRef.current = true;
    };
    const onDisconnect = () => {
      connectedRef.current = false;
    };
    const onEvent = (msg: EventMessage) => {
      setHistory((prev) => {
        const next = [msg, ...prev];
        if (next.length > MAX_HISTORY) next.length = MAX_HISTORY;
        return next;
      });
    };
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("event", onEvent);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("event", onEvent);
    };
  }, []);

  return (
    <div className="w-[clamp(360px,80vw,960px)] mt-1.5">
      <div
        className="flex flex-col gap-1.5"
        style={{
          WebkitMaskImage:
            "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 70%, rgba(0,0,0,0) 100%)",
          maskImage:
            "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 70%, rgba(0,0,0,0) 100%)",
        }}
      >
        {history.map((h, idx) => {
          const seat = `${h.seat.dir}-${h.seat.row}-${h.seat.col}`;
          return (
            <div
              key={idx}
              className="text-[clamp(12px,2.6vw,16px)] leading-snug"
            >
              <div className="text-white break-all drop-shadow-[0_0_6px_rgba(255,255,255,0.25)]">
                [{seat}] {h.text}
              </div>
            </div>
          );
        })}
        {history.length === 0 ? (
          <div className="text-white/50 text-[clamp(12px,2.6vw,16px)]">
            No transactions yet
          </div>
        ) : null}
      </div>
    </div>
  );
}
