# Security

## Reporting a vulnerability

Please report privately, through GitHub's
[private vulnerability reporting](https://github.com/dufrtss/biofrontier-sc/security/advisories/new),
rather than opening a public issue. That keeps the detail out of sight until
there is a fix.

Include what you did, what happened, and what you expected. A request and a
response are worth more than a description of either.

This is a small project maintained by one person, so expect a reply in days
rather than hours.

## What is worth reporting

The app stores contributor accounts and their submitted observations in
Supabase, and the browser holds only the anon key. Row Level Security is what
protects the data, so anything that gets around it matters:

- Reading rows an anonymous caller should not see, in particular identifications
  and profiles, or pending submissions and their notes
- Writing or altering a record as another user, including voting on your own
  submission or forging an `observer_id`
- Moving a submission's `status` directly rather than through the consensus
  trigger
- Anything that turns the sign-in form into a way to send mail to a third party
- Cross-site scripting through submitted text, which reaches the map as popup
  content

## What is not a vulnerability

- The `NEXT_PUBLIC_SUPABASE_ANON_KEY` being visible in the browser bundle. It
  identifies the project and grants nothing on its own; see
  `supabase/migrations` for the policies that do the work.
- The frontier scores being wrong for a given hexbin. The weights are an
  uncalibrated hypothesis and the app says so.
- Occurrence data being incomplete or out of date. It comes from GBIF,
  iNaturalist and MapBiomas, and the pipeline records what it managed to fetch.
