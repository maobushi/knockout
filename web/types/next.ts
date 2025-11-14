import type { NextApiResponse } from "next";
import type { Server as HTTPServer } from "http";
import type { Socket } from "net";

export type NextApiResponseServerIO = NextApiResponse & {
  socket: Socket & {
    server: HTTPServer;
  };
};


