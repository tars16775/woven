# The public site's backend for Railway. Mount a volume at /data. Holds no household data.
FROM node:22-bookworm-slim AS build
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /repo
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY apps/site-api ./apps/site-api
RUN pnpm install --frozen-lockfile --filter "./apps/site-api"
RUN cd apps/site-api && pnpm build

FROM node:22-bookworm-slim
ENV NODE_ENV=production PORT=8090 DATA_DIR=/data
WORKDIR /app
COPY --from=build /repo/apps/site-api/dist ./dist
COPY --from=build /repo/apps/site-api/package.json ./package.json
EXPOSE 8090
CMD ["node", "dist/server.js"]
