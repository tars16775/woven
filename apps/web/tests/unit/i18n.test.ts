import { describe, expect, it } from "vitest";
import { t, untranslated } from "@/lib/i18n";
import { en } from "@/lib/i18n/en";
import { de } from "@/lib/i18n/de";

describe("the language layer (gap 29)", () => {
  it("falls back to English key by key and fills placeholders", () => {
    expect(t("nav.files", {}, "en")).toBe("Files");
    expect(t("nav.files", {}, "de")).toBe("Dateien");
    expect(t("shell.core", { host: "woven.local" }, "de")).toBe("Core · woven.local");
    expect(t("shell.gateBytes", { bytes: "1.2 KB" }, "en")).toBe("1.2 KB crossed the Gate today");
    expect(t("shell.core", {}, "en")).toBe("Core · {host}"); // an unfilled placeholder stays visible rather than vanishing
  });

  it("keeps German honest about what is left", () => {
    const missing = untranslated("de");
    for (const k of missing) expect(en[k]).toBeDefined();
    for (const k of Object.keys(de)) expect(k in en, `${k} exists in German but not in English`).toBe(true);
    expect(untranslated("en")).toEqual([]);
  });
});
