/**
 * Recommendation engine.
 *
 * Pure, deterministic, and unit-testable: given what we know about a comic and
 * its latest price comps, decide a recommended price, listing format
 * (auction vs. Buy It Now), and action (sell now vs. "let it cook longer"),
 * with a plain-English rationale.
 *
 * The thresholds live in TUNING so they're easy to adjust as you learn what
 * sells for you.
 */

export type Trend = "RISING" | "FLAT" | "FALLING" | "UNKNOWN";
export type ListingFormat = "AUCTION" | "BUY_IT_NOW";
export type SellAction = "SELL_NOW" | "HOLD";

export interface RecommendationInput {
  grade?: number | null; // confirmed grade, if any
  keyIssue: boolean;
  averagePrice?: number | null;
  medianPrice?: number | null;
  lowPrice?: number | null;
  highPrice?: number | null;
  salesPerMonth?: number | null; // liquidity signal
  trend?: Trend | null;
  freeShipping?: boolean; // if true, buyer pays $0 shipping
  shippingCost?: number | null; // your cost to ship (added to price when free shipping)
}

export interface RecommendationOutput {
  recommendedPrice: number | null;
  recommendedFormat: ListingFormat;
  recommendedAction: SellAction;
  recommendationNote: string;
}

export const TUNING = {
  // Value at/above which auctions tend to outperform fixed price (competition).
  auctionMinValue: 60,
  // Sales/month at/above which an item is considered "liquid" (sells readily).
  liquidSalesPerMonth: 8,
  // Price nudges by trend.
  risingMultiplier: 1.05,
  fallingMultiplier: 0.95,
  // Below this value, low-grade books are better bundled/moved than held.
  bulkValueCeiling: 10,
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Choose the base fair-market value from available signals. */
function baseValue(input: RecommendationInput): number | null {
  const candidates = [input.medianPrice, input.averagePrice].filter(
    (v): v is number => typeof v === "number" && v > 0
  );
  if (candidates.length > 0) return candidates[0];
  // Fall back to midpoint of low/high if that's all we have.
  if (typeof input.lowPrice === "number" && typeof input.highPrice === "number") {
    return (input.lowPrice + input.highPrice) / 2;
  }
  return null;
}

export function recommend(input: RecommendationInput): RecommendationOutput {
  const reasons: string[] = [];
  const trend: Trend = input.trend ?? "UNKNOWN";
  const liquid =
    typeof input.salesPerMonth === "number" &&
    input.salesPerMonth >= TUNING.liquidSalesPerMonth;

  const base = baseValue(input);

  // --- No usable price data: can't responsibly recommend a price yet. ---
  if (base === null) {
    return {
      recommendedPrice: null,
      recommendedFormat: "BUY_IT_NOW",
      recommendedAction: "HOLD",
      recommendationNote:
        "No price comps yet — add a CovrPrice/Key Collector value (or import a CSV) to generate a recommendation.",
    };
  }

  // --- Price: start from FMV, nudge by trend. ---
  let price = base;
  if (trend === "RISING") {
    price *= TUNING.risingMultiplier;
    reasons.push("priced slightly above FMV because the market is rising");
  } else if (trend === "FALLING") {
    price *= TUNING.fallingMultiplier;
    reasons.push("priced slightly below FMV to sell into a falling market");
  } else {
    reasons.push("priced at fair market value");
  }
  const recommendedPrice = round2(price);

  // --- Format: auction vs. Buy It Now. ---
  let format: ListingFormat;
  if (input.keyIssue) {
    format = "AUCTION";
    reasons.push("auction — key issues draw competitive bidding");
  } else if (recommendedPrice >= TUNING.auctionMinValue) {
    format = "AUCTION";
    reasons.push(
      `auction — value ($${recommendedPrice}) is high enough that bidding tends to maximize price`
    );
  } else if (trend === "RISING" && liquid) {
    format = "AUCTION";
    reasons.push("auction — hot and liquid, so bidders will compete");
  } else {
    format = "BUY_IT_NOW";
    reasons.push("Buy It Now — a common/steady book sells best at a fixed price");
  }

  // --- Action: sell now vs. hold ("cook longer"). ---
  let action: SellAction;
  const lowGradeBulk =
    typeof input.grade === "number" &&
    input.grade <= 4.0 &&
    recommendedPrice <= TUNING.bulkValueCeiling;

  if (lowGradeBulk) {
    action = "SELL_NOW";
    reasons.push("sell now — low grade and low value; not worth holding for");
  } else if (trend === "RISING") {
    action = "HOLD";
    reasons.push('hold — momentum is up, so it may be worth letting it "cook"');
  } else if (trend === "FALLING") {
    action = "SELL_NOW";
    reasons.push("sell now — trend is down, no upside to waiting");
  } else if (liquid) {
    action = "SELL_NOW";
    reasons.push("sell now — it moves quickly, so realize the value");
  } else {
    action = "SELL_NOW";
    reasons.push("sell now — flat market, listing frees up space");
  }

  // Free shipping: bake your shipping cost into the price so margin holds.
  let finalPrice = recommendedPrice;
  if (input.freeShipping && typeof input.shippingCost === "number" && input.shippingCost > 0) {
    finalPrice = round2(recommendedPrice + input.shippingCost);
    reasons.push(`+$${input.shippingCost.toFixed(2)} added to cover free shipping to the buyer`);
  }

  const note = reasons.join("; ") + ".";
  return {
    recommendedPrice: finalPrice,
    recommendedFormat: format,
    recommendedAction: action,
    recommendationNote: note.charAt(0).toUpperCase() + note.slice(1),
  };
}
