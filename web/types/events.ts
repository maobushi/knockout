export type Direction = "N" | "E" | "S" | "W";

export interface SeatAddress {
  dir: Direction;
  row: number; // 0..9
  col: number; // 0..9
}

export interface EventMessage {
  seat: SeatAddress;
  text: string;
  color?: string; // default: #ffffff
  speed?: number; // u/s
  ttl?: number;   // seconds
  fontSize?: number; // world units
}


