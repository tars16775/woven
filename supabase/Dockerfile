# Applies the site's database migrations to the live Supabase project, and
# exits. Railway builds and runs this on every merge to main that touches
# supabase/, after CI has applied the same migrations to a fresh database and
# passed. The database URL is a Railway variable, so the only credential that
# can change the live schema lives where the other credentials live, and
# nowhere in GitHub.
FROM node:22-bookworm-slim
RUN npm install -g supabase@2 >/dev/null 2>&1
WORKDIR /work
COPY supabase ./supabase
# --db-url skips "supabase link" (which would need an access token); the
# version table in the project records what ran, so nothing runs twice.
CMD ["sh", "-c", "supabase db push --db-url \"$SUPABASE_DB_URL\" --yes && echo 'migrations: up to date'"]
