# The public site (marketing, reservations) for Railway. Household data never lives here.
FROM node:22-bookworm-slim AS build
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /repo
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages ./packages
COPY apps/web ./apps/web
COPY packaging ./packaging
RUN pnpm install --frozen-lockfile --filter "./packages/*" --filter "./apps/web"
ARG NEXT_PUBLIC_SITE_URL=https://woventechnology.com
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL NEXT_PUBLIC_WOVEN_LIVE=off NEXT_TELEMETRY_DISABLED=1
RUN cp packaging/install.sh apps/web/public/install.sh
RUN cd apps/web && pnpm build

FROM node:22-bookworm-slim
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
