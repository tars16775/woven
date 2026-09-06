import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { hmacSha256Base64Url, sha256 } from "@/lib/core/device";

describe("device signing", () => {
  it("matches Node's HMAC-SHA256 byte for byte", () => {
    for (const [key, msg] of [
      ["k", "m"],
      ["a-device-secret-that-is-fairly-long-and-random-ish-1234567890", "/v1/photos/01J/thumb|1757100000"],
      ["x".repeat(100), "y".repeat(1000)],
    ] as const) {
      const want = createHmac("sha256", key).update(msg).digest("base64url");
      expect(hmacSha256Base64Url(key, msg)).toBe(want);
    }
  });
  it("hashes like everyone else", () => {
    const hex = Array.from(sha256(new TextEncoder().encode("abc"))).map((b) => b.toString(16).padStart(2, "0")).join("");
    expect(hex).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
