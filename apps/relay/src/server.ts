import { startRelay } from "./index.ts";

const port = Number(process.env.PORT ?? 8080);
startRelay({ port, log: (line) => console.log(`${new Date().toISOString()} ${line}`) })
  .then((r) => console.log(`Woven relay listening on ${r.port}`))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
