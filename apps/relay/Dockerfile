# The Woven relay for Railway. Holds no household data: it pipes encrypted frames and keeps nothing.
FROM node:22-bookworm-slim AS build
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /repo
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY apps/relay ./apps/relay
RUN pnpm install --frozen-lockfile --filter "./apps/relay"
RUN cd apps/relay && pnpm build

FROM node:22-bookworm-slim
ENV NODE_ENV=production PORT=8080
WORKDIR /app
# The bundle carries its one dependency, so there is nothing else to copy.
COPY --from=build /repo/apps/relay/dist ./dist
EXPOSE 8080
CMD ["node", "dist/server.js"]
