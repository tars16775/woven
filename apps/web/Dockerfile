# The public site (marketing, reservations) for Railway. Household data never lives here.
FROM node:22-bookworm-slim AS build
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /repo
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages ./packages
COPY apps/web ./apps/web
COPY packaging ./packaging
RUN pnpm install --frozen-lockfile --filter "./packages/*" --filter "./apps/web"
# Next reads NEXT_PUBLIC_* at build time, and Railway hands a Dockerfile build
# its service variables only as declared build args. Anything not listed here
# is simply absent from the site, however carefully it was set on the service.
ARG NEXT_PUBLIC_SITE_URL=https://woventechnology.com
ARG NEXT_PUBLIC_SITE_API=https://api.woventechnology.com
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_WOVEN_DEMO_CORE
# Not NEXT_PUBLIC_: the Core's real address is resolved into the route manifest
# at build time and never reaches the page.
ARG WOVEN_DEMO_CORE_ORIGIN
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL NEXT_PUBLIC_SITE_API=$NEXT_PUBLIC_SITE_API NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY NEXT_PUBLIC_WOVEN_DEMO_CORE=$NEXT_PUBLIC_WOVEN_DEMO_CORE WOVEN_DEMO_CORE_ORIGIN=$WOVEN_DEMO_CORE_ORIGIN NEXT_PUBLIC_WOVEN_LIVE=off NEXT_TELEMETRY_DISABLED=1
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
