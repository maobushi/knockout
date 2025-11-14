"use client";
import { io, Socket } from "socket.io-client";

let socketInstance: Socket | null = null;

export function getSocket(): Socket {
  if (socketInstance) return socketInstance;
  // Ensure the Socket.IO server is initialized on the Next.js side
  // The server is created when /api/socket is hit at least once.
  // Fire-and-forget: even if this races, the client will reconnect automatically.
  fetch("/api/socket").catch(() => {});
  socketInstance = io({
    path: "/api/socket",
    transports: ["websocket", "polling"],
    autoConnect: true,
    withCredentials: false
  });
  return socketInstance;
}


