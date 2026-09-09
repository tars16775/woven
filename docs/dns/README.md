# DNS for woventechnology.com

The zone is already on Cloudflare (`ridge.ns.cloudflare.com`, `ziggy.ns.cloudflare.com`)
and is empty. `woventechnology.com.zone` in this folder is the whole record set,
ready to import.

## Do this in order

The order matters. Importing DNS before Railway knows about the domain gives you
a name that resolves to a server which does not recognise it, and the symptom is
a certificate error rather than anything that says what is wrong.

**1. Add each domain in Railway first.** Project `woven`, then for each service:
Settings > Networking > Custom Domain.

| Service | Domain to add |
| --- | --- |
| `site` | `woventechnology.com` and `www.woventechnology.com` |
| `site-api` | `api.woventechnology.com` |
| `relay` | `relay.woventechnology.com` |

Railway shows a CNAME target for each. **Write those down.** They are usually the
service's own `*.up.railway.app` hostname, but Railway is the authority and a
guess fails silently.

> Custom domains were refused on this account the last time we tried, which is
> what Railway does when the plan does not include them. If that is still true,
> stop here: the plan has to change first, and everything below waits.

**2. Put the targets into the zone file.** Replace `__RAILWAY_SITE__`,
`__RAILWAY_SITE_API__` and `__RAILWAY_RELAY__`.

**3. Import.** Cloudflare > your zone > DNS > Records > Import and Export >
Import. Records arrive proxied-off, which is correct.

**4. Leave the cloud grey.** Every record here should stay DNS-only:

- Railway issues and renews the certificates. With Cloudflare proxying in front,
  Railway cannot complete the challenge, and you end up managing two
  certificates for one name.
- The relay holds a long-lived WebSocket. A proxy in front of it buys nothing
  and can time it out mid-session, which a household experiences as remote
  access dropping for no reason.

Turning the orange cloud on later is a deliberate decision that needs Full
(strict) SSL and a re-test of the relay, not a default.

**5. Point the site build at the real API.** The site reads
`NEXT_PUBLIC_SITE_API` at build time, so it has to be redeployed, not just
reconfigured:

```bash
railway variables --service site --set NEXT_PUBLIC_SITE_API=https://api.woventechnology.com
railway up --service site
```

**6. Narrow the API's origins** to the real domain once the site answers there:

```bash
railway variables --service site-api --set SITE_ORIGINS=https://woventechnology.com,https://www.woventechnology.com
```

**7. Check it end to end.**

```bash
curl -sS -o /dev/null -w '%{http_code} %{url_effective}\n' -L https://woventechnology.com
curl -sS https://api.woventechnology.com/health
# A reservation from the live site should return sent, not local.
```

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
