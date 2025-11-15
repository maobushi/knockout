// コントラクト設定
const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID || "0x0836352492611ee7a2483819ee57091d81ac66024379339570d3a96c203e7eac";

export const CONTRACT_CONFIG = {
  PACKAGE_ID,
  MODULE_NAME: "knockout_contract",
  EVENT_TYPE_INCREMENTED: `${PACKAGE_ID}::knockout_contract::CounterIncremented`,
  COUNTER_TYPE: `${PACKAGE_ID}::knockout_contract::Counter`,
} as const;

