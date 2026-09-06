import { startSiteApi } from "./index.ts";

startSiteApi({
  port: Number(process.env.PORT ?? 8090),
  dataDir: process.env.DATA_DIR ?? "/data",
  adminToken: process.env.ADMIN_TOKEN ?? null,
  resendKey: process.env.RESEND_API_KEY ?? null,
  from: process.env.MAIL_FROM ?? "Woven <hello@woventechnology.com>",
  notify: process.env.NOTIFY_EMAIL ?? null,
  origins: (process.env.SITE_ORIGINS ?? "https://woventechnology.com").split(",").map((s) => s.trim()),
  log: (line) => console.log(`${new Date().toISOString()} ${line}`),
})
  .then((r) => console.log(`Woven site API listening on ${r.port}`))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
