# The Woven Core, hosted, for exactly one purpose: the demonstration house at
# demo.woventechnology.com. A real Core lives inside a house on the household's
# own machine; this container is the same software running an example
# household that anyone may walk through and that is wiped and reseeded on
# every start. Nothing in it is anyone's. Do not point a real household here.
FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /repo
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages ./packages
COPY apps/core ./apps/core
RUN pnpm install --frozen-lockfile --filter "./packages/*" --filter "./apps/core"
RUN pnpm --filter "./packages/*" build 2>/dev/null || true
RUN cd apps/core && pnpm build
# A self-contained copy with real node_modules (no workspace symlinks), which
# is what the runtime image needs and what pnpm deploy is for. --legacy because
# the workspace packages are already bundled into dist by tsup; pnpm 10 would
# otherwise insist on injecting them, which there is nothing left to inject.
RUN pnpm --filter "./apps/core" --prod deploy --legacy /out

FROM node:22-bookworm-slim
ENV NODE_ENV=production WOVEN_DATA=/data WOVEN_KEY=file WOVEN_TLS=off WOVEN_MDNS=off WOVEN_PROXY=on WOVEN_DEMO=on WOVEN_HOST=0.0.0.0 WOVEN_PORT=4000 PORT=4000
WORKDIR /app
COPY --from=build /out /app
COPY apps/core/packaging/demo-start.sh /app/demo-start.sh
RUN chmod +x /app/demo-start.sh
EXPOSE 4000
CMD ["/app/demo-start.sh"]
