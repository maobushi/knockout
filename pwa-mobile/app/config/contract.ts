// コントラクト設定
// デプロイ後にパッケージIDを更新してください
const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID || "0x0836352492611ee7a2483819ee57091d81ac66024379339570d3a96c203e7eac";

export const CONTRACT_CONFIG = {
  PACKAGE_ID,
  MODULE_NAME: "knockout_contract",
  REGISTRY_TYPE: `${PACKAGE_ID}::knockout_contract::CounterRegistry`,
  COUNTER_TYPE: `${PACKAGE_ID}::knockout_contract::Counter`,
} as const;

