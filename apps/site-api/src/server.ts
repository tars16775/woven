import { createVerifier } from "./auth.ts";
import { startSiteApi } from "./index.ts";
import { FileStore, SupabaseStore } from "./store.ts";

const log = (line: string) => console.log(`${new Date().toISOString()} ${line}`);

// Deployed means Supabase, without exception. A file store on a volume was
// how this started; it is still right for a laptop, and wrong for a service
// whose whole job is to not lose what people sent.
const deployed = process.env.NODE_ENV === "production" || Boolean(process.env.RAILWAY_ENVIRONMENT);
const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabaseSecret = process.env.SUPABASE_SECRET_KEY?.trim();

if (deployed && !(supabaseUrl && supabaseSecret)) {
  console.error("site-api: SUPABASE_URL and SUPABASE_SECRET_KEY are required when deployed; the file store is for development only.");
  process.exit(1);
}

const store = supabaseUrl && supabaseSecret ? new SupabaseStore({ url: supabaseUrl, secretKey: supabaseSecret }) : new FileStore(process.env.DATA_DIR ?? "/data");
log(`store: ${supabaseUrl ? `supabase (${new URL(supabaseUrl).host})` : `files (${process.env.DATA_DIR ?? "/data"})`}`);

startSiteApi({
  port: Number(process.env.PORT ?? 8090),
  store,
  ...(supabaseUrl ? { verifyUser: createVerifier({ url: supabaseUrl, ...(process.env.SUPABASE_JWKS_URL ? { jwksUrl: process.env.SUPABASE_JWKS_URL } : {}) }) } : {}),
  adminToken: process.env.ADMIN_TOKEN ?? null,
  resendKey: process.env.RESEND_API_KEY ?? null,
  from: process.env.MAIL_FROM ?? "Woven <hello@woventechnology.com>",
  notify: process.env.NOTIFY_EMAIL ?? null,
  origins: (process.env.SITE_ORIGINS ?? "https://woventechnology.com").split(",").map((s) => s.trim()),
  log,
})
  .then((r) => log(`Woven site API listening on ${r.port}`))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
