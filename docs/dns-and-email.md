# DNS, hosting and email

Three services have to agree for BioFrontier SC to serve on a custom domain and
send magic links: Vercel (hosting), Resend (SMTP), and Cloudflare (DNS for
`eduardofrafre.com`).

Status as of 2026-09-03.

## 0. Where the code lives

This project used to sit at `projects/biofrontier-sc/` inside the `omega`
repository, with the Vercel project named `omega` and a root directory pointing
into that subfolder. It is now its own repository, `dufrtss/biofrontier-sc`, and
the Vercel project was renamed to match with its root directory cleared. The 90
commits that touched the subfolder came across via `git subtree split`, so the
history is the real one rather than a squashed import.

Renaming the Vercel project rather than creating a new one kept the environment
variables, the attached custom domain and the deployment history intact.

## 1. Hosting URLs

| URL | Use | Public? |
|---|---|---|
| `biofrontier-sc.vercel.app` | canonical production | yes |
| `omega-six-tau.vercel.app` | legacy alias from the old project name | yes |
| `biofrontier-sc-eduardo-freitas-projects.vercel.app` | team-scoped | **no — Vercel SSO** |

The team-scoped hostname is the trap. It looks like a normal production URL and
Vercel's Supabase integration writes it into the auth settings on its own, but
it sits behind Vercel SSO: anyone following a magic link to it hits a Vercel
login wall instead of the app. Only the publicly reachable hostnames belong in
`site_url` / `additional_redirect_urls`.

If sign-in suddenly starts landing on a Vercel login page, check whether the
integration has rewritten those fields again, and re-run `supabase config push`
to restore `supabase/config.toml` as the source of truth.

## 2. App domain — `biofrontier.sc.eduardofrafre.com`

**Done:** attached to the Vercel project and verified there. It is already in
the Supabase redirect allow-list, so it starts working the moment DNS resolves.

**Pending:** one DNS record in Cloudflare.

| Type | Name             | Content       | Proxy        |
|------|------------------|---------------|--------------|
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

Then promote it in `supabase/config.toml` — move it from the allow-list into
`site_url` — and `supabase config push`.

## 3. Sending domain — `mail.eduardofrafre.com`

**Done.** Registered in Resend, its SPF/DKIM/MX records are in Cloudflare, and
the Resend dashboard reports the domain verified. `supabase/config.toml` sends
as `no-reply@mail.eduardofrafre.com`; a magic link requested against the live
project on 2026-09-03 was accepted and dispatched without an SMTP error.

A subdomain rather than the apex on purpose: this app emails people who do not
own the domain, and a sender reputation problem should not be able to reach
personal mail at the root domain.

The previous sender, `onboarding@resend.dev`, is Resend's shared sandbox address
and only delivers to the Resend account owner. It looked like it worked in
testing for exactly that reason, and would have delivered nothing to a class.

### Watch DMARC

If `eduardofrafre.com` publishes a `_dmarc` record with `p=quarantine` or
`p=reject`, this subdomain sender inherits that policy unless it publishes its
own. Getting it wrong sends magic links to spam silently — no error anywhere,
people simply never receive the link, and since magic links are the only way
into this app that reads as the app being broken.

## 4. Credentials

| Credential | Scope it has | Scope needed |
|---|---|---|
| Cloudflare token | Zone → Read (lists zones only) | **Zone → DNS → Edit** on `eduardofrafre.com`, to manage records from here |
| Resend key | send-only | fine for sending; the dashboard is needed to add domains |
| Vercel CLI | full | — |
| Supabase CLI | full | — |
| `gh` | repo, admin:public_key | — |
