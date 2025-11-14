import type { NextApiRequest } from "next";
import type { NextApiResponseServerIO } from "@/types/next";
import { Server as IOServer } from "socket.io";
import { setIO, getIO } from "@/lib/server/io";

export const config = {
  api: {
    bodyParser: false
  }
};

export default function handler(req: NextApiRequest, res: NextApiResponseServerIO) {
  if (!res.socket?.server) {
    res.status(500).end();
    return;
  }

  if (!getIO()) {
    const io = new IOServer(res.socket.server, {
      path: "/api/socket",
      addTrailingSlash: false,
      cors: {
        origin: "*"
      }
    });
    setIO(io);
    io.on("connection", (socket) => {
      socket.on("ping", () => socket.emit("pong"));
    });
  }
  res.end();
}


