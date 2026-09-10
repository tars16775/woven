# DNS for woventechnology.com

The zone is already on Cloudflare (`ridge.ns.cloudflare.com`, `ziggy.ns.cloudflare.com`)
and is empty. `woventechnology.com.zone` in this folder is the whole record set,
ready to import.

## State: the domains are added, the records are not

All four custom domains are registered against their Railway services and are
sitting at `VALIDATING_OWNERSHIP`, waiting for DNS. The CNAME targets in
`woventechnology.com.zone` came from Railway's own API rather than a guess.

| Domain | Service | CNAME target |
| --- | --- | --- |
| `woventechnology.com` | `site` | `8yqpl9im.up.railway.app` |
| `www.woventechnology.com` | `site` | `w4um6z2s.up.railway.app` |
| `api.woventechnology.com` | `site-api` | `yxc9ldh5.up.railway.app` |
| `relay.woventechnology.com` | `relay` | `pnfom1f8.up.railway.app` |

**Import the zone.** Cloudflare > your zone > DNS > Records > Import and
Export > Import, and pick `woventechnology.com.zone`. Records arrive
proxied-off, which is correct.

One record may not survive the import: the apex `CNAME`. A zone may not hold a
CNAME beside other data, and the apex also carries `MX` and `TXT`. Cloudflare
itself allows this — it flattens the apex CNAME into A records before
publishing, so the published zone has no conflict — but the importer reads BIND
format and may refuse the line. If the bare domain is missing afterwards, add
it by hand: CNAME, name `@`, target `8yqpl9im.up.railway.app`, proxy off.

**Leave every cloud grey.** This is not a default to drift away from:

- Railway issues and renews the certificates. With Cloudflare proxying in
  front, Railway cannot complete its challenge, and you end up maintaining two
  certificates for one name.
- The relay holds a long-lived WebSocket. A proxy in front of it buys nothing
  and can time it out mid-session, which a household experiences as remote
  access dropping for no reason.

Turning the orange cloud on later is a deliberate decision needing Full
(strict) SSL and a re-test of the relay.

**Then check.** Certificates usually issue within a few minutes of the CNAME
resolving.

```bash
dig +short woventechnology.com api.woventechnology.com relay.woventechnology.com
curl -sS -o /dev/null -w '%{http_code}\n' -L https://woventechnology.com
curl -sS https://api.woventechnology.com/health
```

A reservation submitted from the live site should report `sent`, not `local`.

## What the records are for

| Name | Points at | Why |
| --- | --- | --- |
| `@`, `www` | the `site` service | Cloudflare flattens a CNAME at the apex, so there is no A record whose address we would have to chase when Railway moves it |
| `api` | the `site-api` service | Reservations, applications, contact. Holds no household data |
| `relay` | the `relay` service | Sealed frames between a Core and its dashboards. Holds nothing |
| `MX .` (apex) | nowhere, deliberately | A null MX says this domain accepts no mail, which stops the backscatter an unconfigured domain attracts. It does not affect sending |
| `send` MX + TXT | Resend's return path | Resend bounces and SPF-checks against `send.woventechnology.com`, not the apex. Both values came from Resend's API for this domain |
| `resend._domainkey` | Resend's DKIM key | Signs as `d=woventechnology.com`, which is what makes DMARC pass under strict alignment |
| apex `SPF` | nothing authorised | `v=spf1 -all`. Nothing legitimately sends with the bare domain as envelope sender, so anything that claims to is forged |
| `DMARC` | reject | Anything failing both checks is rejected rather than quarantined. `aspf=r` because the envelope sender is a subdomain; `adkim=s` because DKIM signs the apex exactly |

There is no wildcard, on purpose. A wildcard answers for every name anyone
invents, which is how a subdomain nobody meant to publish ends up serving
something.

## Mail

Resend holds `woventechnology.com` and it is **`pending`** — it stays pending
until the three mail records below resolve, and until it verifies, every send
fails. The site stores the reservation either way and reports `failed` rather
than `sent`.

| Record | Name | Value |
| --- | --- | --- |
| MX (priority 10) | `send` | `feedback-smtp.us-east-1.amazonses.com` |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` |
| TXT | `resend._domainkey` | the DKIM public key, in the zone file |

All three are already in `woventechnology.com.zone`. After the import, press
Verify on the Resend dashboard, or:

```bash
curl -sS -H "Authorization: Bearer $RESEND_API_KEY" \
  https://api.resend.com/domains | python3 -m json.tool
```

The DKIM value is one long unbroken string. If an editor wraps it, the record
is silently wrong and Resend will keep saying `pending` with no other clue.

`RESEND_API_KEY` is set on the `site-api` service. `MAIL_FROM` is unset and
defaults to `Woven <hello@woventechnology.com>`, which is the address DKIM
aligns with — do not change it to another domain without changing DKIM too.

**`NOTIFY_EMAIL` is unset.** A reservation is acknowledged to the person who
made it, and nobody at Woven is told it happened. Set it to an address you
actually read.

Leave DMARC at `p=reject`. If legitimate mail starts failing, that is a
misconfiguration to fix rather than a policy to relax.

Do not point the apex `MX` at Resend unless you also intend to *receive* mail.
Sending does not need it.

## The Core does not appear here

A household's Core is reachable at `woven.local` on their own network and,
when they switch it on, through the relay. Neither needs a record in this zone,
and neither should have one: nothing about a house belongs in a public
nameserver.
