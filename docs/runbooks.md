# Runbooks

Phase 47. One page per thing that must not stay broken. Each alert on the screen and the Core page points here.

## The ledger does not verify (`ledger`, urgent)

What it means: a receipt row was changed or damaged; the core refuses to start on it, and the nightly check raises this while it runs.

1. Do not "fix" the database by hand. Copy the data root aside first.
2. Run a restore drill from the Core page. If the drill passes, the newest snapshot is sound.
3. Stop the core (`Stop Woven.command`), move `Woven Data/db` aside, run `pnpm --filter ./apps/core restore <snapshot-dir>` with the newest snapshot, start again.
4. If every snapshot fails, the volume is failing: see "Damaged files".

## Damaged files on the volume (`objects`, urgent)

What it means: objects no longer match their hash (bit rot, a failing drive, a bad cable).

1. Run a restore drill; note which objects are corrupt (`integrity.json` in a diagnostics bundle lists counts).
2. Check the drive: Disk Utility First Aid on the Woven image, SMART on the physical disk.
3. Restore the objects from the mirror (`WOVEN_SNAPSHOT_MIRROR/<snapshot>/objects`) or from the device that backed them up (`pnpm backup` re-sends anything missing).
4. Replace the drive before restoring onto it again.

## The volume is almost full (`disk`, urgent at 3 %, warn at 10 %)

1. The Files page shows what takes space by namespace and source.
2. Delete what nobody needs; exports and old diagnostics live under `Woven Data/exports`; old snapshots are pruned nightly to 14.
3. Add space: a bigger image, or a second drive (and move the data root with `WOVEN_DATA`).

## No Gate is running (`gate`, warn)

1. Restart the core from the Core page; it starts the Gate.
2. If it comes back absent, read `Woven Data/logs/core.log` for the Gate's exit; the port (`WOVEN_GATE_PORT`) may be taken.

## The second backup location is not reachable (`mirror`, warn)

1. Plug the second drive in, or fix the path in `WOVEN_SNAPSHOT_MIRROR`.
2. Take a snapshot from the Core page; it copies to the mirror at once.

## The certificate is about to renew (`cert`, warn)

The core renews its certificate at start when fewer than 30 days remain. Restart the core. Devices keep trusting the household CA; nothing to reinstall.

## No recent snapshot (`snapshot`, warn)

The nightly job did not run for two days: the Mac was asleep at 3:00, or the core was down. Keep the Mac awake and plugged in; take a snapshot now from the Core page.

## The dashboard cannot find the Core

1. Same network? The core only answers on the home LAN.
2. `https://woven.local:4000/v1/health` from the Mac. If it answers there but not from a phone, trust the CA on the phone (`http://woven.local:4001`).
3. If nothing answers, `Start Woven.command`; then `Woven Data/logs/core.log`.
