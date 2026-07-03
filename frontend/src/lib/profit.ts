export interface FeeSettings {
  feePercent: number;
  perOrderFee: number;
  shippingCost: number;
  shippingCharged: number;
}

export interface ProfitResult {
  salePrice: number;
  shippingCharged: number;
  gross: number; // item + shipping charged (fee basis)
  fee: number; // eBay final value fee + per-order fee
  shippingCost: number; // what you pay to ship
  net: number; // take-home
  marginPct: number; // net / salePrice
}

/**
 * Net take-home for a sale. eBay charges the final-value fee on the item price
 * PLUS the shipping charged to the buyer, then a fixed per-order fee. You then
 * pay the actual shipping cost out of the proceeds.
 */
export function computeProfit(
  salePrice: number,
  s: FeeSettings,
  overrides?: { shippingCharged?: number; shippingCost?: number }
): ProfitResult {
  const shippingCharged = overrides?.shippingCharged ?? s.shippingCharged;
  const shippingCost = overrides?.shippingCost ?? s.shippingCost;
  const gross = salePrice + shippingCharged;
  const fee = gross * (s.feePercent / 100) + s.perOrderFee;
  const net = gross - fee - shippingCost;
  const marginPct = salePrice > 0 ? (net / salePrice) * 100 : 0;
  return { salePrice, shippingCharged, gross, fee, shippingCost, net, marginPct };
}
