// コントラクト設定
// デプロイ後にパッケージIDを更新してください
const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID || "0x0d39100eb1babb36835cc44343ede798005816424871912cf07023c5b4a56c93";

export const CONTRACT_CONFIG = {
  PACKAGE_ID,
  MODULE_NAME: "knockout_contract",
  REGISTRY_TYPE: `${PACKAGE_ID}::knockout_contract::CounterRegistry`,
  COUNTER_TYPE: `${PACKAGE_ID}::knockout_contract::Counter`,
} as const;

