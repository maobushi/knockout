import type { Direction, SeatAddress } from "@/types/events";

/**
 * 400個の椅子のインデックスからSeatAddressを計算
 * インデックス: 0-399
 * 4方向 × 10行 × 10列 = 400個
 */
function indexToSeatAddress(index: number): SeatAddress {
  const dirs: Direction[] = ["N", "E", "S", "W"];
  const dirIndex = Math.floor(index / 100); // 0-3
  const remainder = index % 100;
  const row = Math.floor(remainder / 10); // 0-9
  const col = remainder % 10; // 0-9
  
  return {
    dir: dirs[dirIndex],
    row,
    col,
  };
}

/**
 * seat (0-19) を使って、400個の椅子のうち対応する椅子をすべて取得
 * 条件: インデックス % 20 == seat の椅子を選択
 * つまり、400 % 20 == 20 % seat を満たす椅子
 */
export function seatToSeatAddresses(seat: number): SeatAddress[] {
  const addresses: SeatAddress[] = [];
  // 400個の椅子のうち、インデックス % 20 == seat の椅子を選択
  for (let i = 0; i < 400; i++) {
    if (i % 20 === seat) {
      addresses.push(indexToSeatAddress(i));
    }
  }
  return addresses;
}

/**
 * seat (0-19) をSeatAddressにマッピング（後方互換性のため残す）
 * 最初の1つの椅子を返す
 */
export function seatToSeatAddress(seat: number): SeatAddress {
  const addresses = seatToSeatAddresses(seat);
  return addresses[0] || { dir: "N", row: 0, col: 0 };
}

/**
 * team (0または1) で色を決定
 * - team 0: 青系（#01FFFF）
 * - team 1: マゼンタ系（#B50087）
 */
export function teamToColor(team: number): string {
  return team === 0 ? "#01FFFF" : "#B50087";
}

