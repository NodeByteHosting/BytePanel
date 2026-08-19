export const applyMarkup = (
  basePriceEur: number,
  _cpuType: "shared" | "dedicated",
): number => {
  const normalized = Number.isFinite(basePriceEur) ? basePriceEur : 0;
  return Math.max(0, Math.round(normalized * 100));
};
