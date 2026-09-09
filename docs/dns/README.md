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
| `MX .` | nowhere, deliberately | A null MX says this domain accepts no mail, which stops the backscatter an unconfigured domain attracts |
| `SPF` | nothing authorised | `v=spf1 -all` until Resend is set up. A hard fail is honest and safer than a permissive record nobody revisits |
| `DMARC` | reject | Anything failing the above is rejected rather than quarantined |

There is no wildcard, on purpose. A wildcard answers for every name anyone
invents, which is how a subdomain nobody meant to publish ends up serving
something.

## When mail is switched on

Resend will give you an SPF value and a DKIM record. Replace the `v=spf1 -all`
record with theirs and add the DKIM record beside it. Leave DMARC at `p=reject`;
if legitimate mail starts failing, that is a misconfiguration to fix rather than
a policy to relax.

Do not point `MX` at Resend unless you also intend to *receive* mail. Sending
does not need it.

## The Core does not appear here

A household's Core is reachable at `woven.local` on their own network and,
when they switch it on, through the relay. Neither needs a record in this zone,
and neither should have one: nothing about a house belongs in a public
nameserver.
