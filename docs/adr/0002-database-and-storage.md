# ADR 0002: Embedded database and a content-addressed store

Status: accepted · 2026-09-05

## Decision

- Structured state lives in one SQLite database per household, in WAL mode, accessed through Drizzle ORM with checked-in migrations.
- Files, photos, media and clips live in a content-addressed store: each blob is stored once under its SHA-256, with metadata rows in SQLite pointing at it. Deduplication is a property of the layout, not a feature.
- Everything lives under one data root (`WOVEN_DATA`), on the Mac `/Volumes/Woven/Woven Data`, on the box the chassis storage. Layout:

```
WOVEN_DATA/
  db/woven.sqlite            the household database (+ -wal, -shm)
  store/objects/ab/cd/<sha>  content-addressed blobs
  store/tmp/                 in-flight uploads
  keys/                      household CA, server certs, signing keys (0600)
  snapshots/<timestamp>/     nightly consistent copies of db/ and store manifests
  logs/
```

## Why

- A household is one machine. An embedded database is faster, simpler and more private than a server database, and it has no network surface.
- SQLite's durability with WAL is proven; backups are file copies taken through the backup API, not ad hoc.
- Drizzle keeps the schema in TypeScript next to the code and gives a migration path if a deployment ever outgrows SQLite.

## Consequences

- No cloud database, ever, for household data. The public marketing site's reservations are a separate concern (ADR 0005).
- Every table that records what happened is append-only (ADR 0004).
- Deleting a person or the household deletes rows and unreferenced blobs; a garbage-collection pass reconciles the store against the database.
