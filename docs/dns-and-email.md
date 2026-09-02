# DNS and email setup

Three services have to agree for BioFrontier SC to serve on a custom domain and
send magic links: Vercel (hosting), Resend (SMTP), and Cloudflare (DNS for
`eduardofrafre.com`).

Status as of 2026-09-02.

## 1. App domain — `biofrontier.sc.eduardofrafre.com`

**Done:** the domain is attached to the Vercel `omega` project.

**Pending:** one DNS record in Cloudflare.

| Type | Name            | Content        | Proxy      |
|------|-----------------|----------------|------------|
| A    | `biofrontier.sc` | `76.76.21.21` | **DNS only** |

Vercel's alternative — repointing the nameservers to `ns1/ns2.vercel-dns.com` —
is not an option here: Cloudflare is authoritative for this zone and moving it
would take the other records with it.

### Keep the proxy off

The grey cloud matters more than usual for this hostname. Cloudflare's Universal
SSL covers `example.com` and `*.example.com`, but **not** `*.sub.example.com` —
and `biofrontier.sc.eduardofrafre.com` is two labels deep, so a proxied record
would have no certificate on the free plan. Left DNS-only, Vercel issues and
serves its own certificate and the depth is irrelevant.

Verify after the record exists:

```
vercel domains inspect biofrontier.sc.eduardofrafre.com
```

## 2. Sending domain — `mail.eduardofrafre.com`

A subdomain rather than the apex on purpose: this app will email people who are
not the domain owner, and a sender reputation problem should not be able to
reach personal mail from the root domain.

**Blocked** on two things, neither of which is a DNS record yet:

1. The domain must be registered in Resend before its records exist. The API key
   in `.env.local` is send-only (`restricted_api_key`), so it cannot create a
   domain — this needs the Resend dashboard or a full-access key.
2. Resend then returns an SPF record, a **DKIM public key unique to this
   domain**, and an MX record for bounce handling. The DKIM value cannot be
   guessed or copied from another setup; it has to come from Resend.

Once those exist, add them in Cloudflare **DNS only** (proxying breaks MX and is
meaningless for TXT), then flip the sender:

```toml
# supabase/config.toml
[auth.email.smtp]
admin_email = "no-reply@mail.eduardofrafre.com"
```

```
supabase config push
```

### Check DMARC before adding a sender

If `eduardofrafre.com` already publishes a `_dmarc` record with `p=quarantine`
or `p=reject`, a new subdomain sender inherits that policy unless it publishes
its own. Getting this wrong sends magic links to spam silently — there is no
error anywhere, people simply never receive the link, and since magic links are
the only way into this app that reads as the app being broken.

Read the existing records before changing anything.

## 3. Credentials

| Credential | Scope it has | Scope needed |
|---|---|---|
| Cloudflare token | Zone → Read (lists 3 zones) | **Zone → DNS → Edit** on `eduardofrafre.com` |
| Resend key | send-only | **Full access**, or add the domain via the dashboard |
| Vercel CLI | full | — |
| Supabase CLI | full | — |
