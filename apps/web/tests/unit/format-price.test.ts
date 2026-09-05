import { describe, expect, it } from "vitest";
import { formatPrice, tierOrder, tiers } from "@/lib/site";

describe("formatPrice", () => {
  it("formats whole US dollars with a thousands separator and no cents", () => {
    expect(formatPrice(899)).toBe("$899");
    expect(formatPrice(1499)).toBe("$1,499");
    expect(formatPrice(2499)).toBe("$2,499");
  });

  it("rounds away fractional cents", () => {
    expect(formatPrice(8.4)).toBe("$8");
    expect(formatPrice(99.5)).toBe("$100");
  });

  it("handles zero and large values", () => {
    expect(formatPrice(0)).toBe("$0");
    expect(formatPrice(1_250_000)).toBe("$1,250,000");
  });

  it("prices every tier in ascending order", () => {
    const prices = tierOrder.map((id) => tiers[id].priceFrom);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    for (const id of tierOrder) expect(formatPrice(tiers[id].priceFrom)).toMatch(/^\$[\d,]+$/);
  });
});
