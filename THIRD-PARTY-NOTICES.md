# Third-party notices

Components of this project that are covered by someone else's licence, and the
notices those licences require to travel with them.

## What the project licence does and does not cover

The MIT licence in `LICENSE` covers **the source code of this project**. It does
not, and cannot, relicense third-party material distributed alongside it:

- **`public/data/hexbins.json` and `public/data/habitat-by-hex.json` are derived
  data**, not original work. They are computed from GBIF and iNaturalist
  occurrence records and from MapBiomas land cover, and they carry whatever
  terms those sources attach, see the scripts in `scripts/` for exactly what
  each file is built from. Anyone redistributing them should check the source
  terms rather than assume MIT.
- Basemap tiles are served from OpenStreetMap and are not redistributed here at
  all; the attribution requirement still applies to the running site.

---

## Map data and tiles

Not a licence notice so much as an attribution requirement the map already
satisfies on screen, recorded here so it is not lost in a refactor:

- **OpenStreetMap**: basemap tiles. © OpenStreetMap contributors, ODbL.
  The attribution control in `GapMap.client.tsx` carries this and must not be
  removed or hidden.
- **GBIF** and **iNaturalist**: occurrence records. Cited in the data summary
  bar and in the methodology panel.
- **MapBiomas**: land cover used for the habitat component. Cited in the
  methodology panel.
