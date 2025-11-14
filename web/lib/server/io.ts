import type { Server as IOServer } from "socket.io";
import type { EventMessage } from "@/types/events";

declare global {
  var __io: IOServer | undefined;
}

export function setIO(io: IOServer) {
  global.__io = io;
}

export function getIO(): IOServer | undefined {
  return global.__io;
}

export function emitEvent(msg: EventMessage) {
  const io = getIO();
  if (!io) return;
  io.emit("event", msg);
}


