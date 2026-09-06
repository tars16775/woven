"use client";

import { locales, setLocale, useT } from "@/lib/i18n";

/** The language picker (gap 29): follows the browser until a person chooses. */
export function LanguageControl() {
  const { locale, t } = useT();
  return (
    <div className="mb-4 border-b border-ink/6 pb-4">
      <label htmlFor="woven-language" className="block text-[13px] font-medium">
        {t("settings.language")}
      </label>
      <select id="woven-language" value={locale} onChange={(e) => setLocale(e.target.value as typeof locale)} className="mt-1 rounded-[8px] bg-bone px-3 py-2 text-[14px] ring-1 ring-ink/8" data-testid="language">
        {locales.map((l) => (
          <option key={l.id} value={l.id}>
            {l.label}
          </option>
        ))}
      </select>
      <p className="mt-1 text-[12px] text-ash">{t("settings.languageHint")}</p>
    </div>
  );
}
