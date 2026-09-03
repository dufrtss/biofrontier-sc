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

| URL | Use |
|---|---|
| `biofrontier.sc.eduardofrafre.com` | **canonical production**, and `site_url` |
| `biofrontier-sc.vercel.app` | Vercel alias |
| `omega-six-tau.vercel.app` | legacy alias from the old project name |
| `biofrontier-sc-eduardo-freitas-projects.vercel.app` | team-scoped |

The team-scoped hostname used to be a trap, and the shape of it is worth
keeping in mind. Vercel's Supabase integration rewrites `site_url` to that
hostname **on every deployment** — `supabase config push` fixes it and the next
deploy undoes the fix. It was also the one hostname behind Vercel SSO, so the
result was that sign-in silently broke after each deploy: the magic link led to
a Vercel login wall rather than the app.

Fighting the rewrite is the losing move; the fix was to make what it writes
harmless. Deployment protection is now off for this project, so every hostname
above serves the app. All four are in `additional_redirect_urls` for the same
reason. The app is public and open source, so there was nothing for protection
to protect — the only thing it did was break authentication once a day.

## 2. App domain — `biofrontier.sc.eduardofrafre.com`

**Live.** Serving with a Let's Encrypt certificate issued 2026-09-03, and it is
now `site_url`. The record that made it work:

| Type | Name             | Content       | Proxy        |
|------|------------------|---------------|--------------|
| A    | `biofrontier.sc` | `76.76.21.21` | **DNS only** |

Vercel's alternative — repointing the nameservers to `ns1/ns2.vercel-dns.com` —
was not an option: Cloudflare is authoritative for this zone and moving it would
take the other records with it.

### Keep the proxy off

The grey cloud matters more than usual for this hostname. Cloudflare's Universal
SSL covers `example.com` and `*.example.com`, but **not** `*.sub.example.com` —
and `biofrontier.sc.eduardofrafre.com` is two labels deep, so a proxied record
would have no certificate on the free plan. Left DNS-only, Vercel issues and
serves its own certificate and the depth is irrelevant.

To re-check it:

```
vercel domains inspect biofrontier.sc.eduardofrafre.com
```

## 3. Sending domain — `mail.eduardofrafre.com`

**Done.** Registered in Resend, its SPF/DKIM/MX records are in Cloudflare, and
the Resend dashboard reports the domain verified. `supabase/config.toml` sends
as `no-reply@mail.eduardofrafre.com`. Confirmed delivered end to end on
2026-09-03: SPF, DKIM and the bounce MX all resolve, and Resend's log shows
every message to Gmail — HTTP API, raw SMTP on both 465 and 587, and Supabase's
own magic links — with status `delivered`.

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

## 5. Two things that look like breakage and are not

**Resend's SMTP ingestion lags its HTTP API by minutes.** A message sent through
the API arrives almost at once; the same message over `smtp.resend.com` can take
several minutes to leave the queue. Supabase only speaks SMTP, so every magic
link is on the slow path. An hour was spent here concluding mail was broken when
it was merely late — the messages had all been delivered.

Check before diagnosing:

```
curl -s -H "Authorization: Bearer $RESEND_ADMIN_API_KEY" \
  'https://api.resend.com/emails?limit=15' | jq '.data[] | {created_at,last_event,subject}'
```

`RESEND_API_KEY` cannot do this — it is send-only, and reading the log needs
full access. That separation is deliberate: the key Supabase holds should not be
able to read mail history or create domains.

**The magic link's subject is "Confirm your email address".** No account existed
yet, so GoTrue sends the *signup confirmation* template rather than the magic
link one. In an app where the link is the only way in, that subject reads like
unrelated boilerplate and is easy to scroll past — which is exactly what
happened. Worth overriding the template if sign-in drop-off ever shows up.
