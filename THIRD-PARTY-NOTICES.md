# Third-party notices

Components of this project that are covered by someone else's licence, and the
notices those licences require to travel with them.

## What the project licence does and does not cover

The MIT licence in `LICENSE` covers **the source code of this project**. It does
not, and cannot, relicense third-party material distributed alongside it:

- **`public/data/hexbins.json` and `public/data/habitat-by-hex.json` are derived
  data**, not original work. They are computed from GBIF and iNaturalist
  occurrence records and from MapBiomas land cover, and they carry whatever
  terms those sources attach — see the scripts in `scripts/` for exactly what
  each file is built from. Anyone redistributing them should check the source
  terms rather than assume MIT.
- The bird mark is Phosphor Icons' work under its own MIT grant, below.
- Basemap tiles are served from OpenStreetMap and are not redistributed here at
  all; the attribution requirement still applies to the running site.

---

## Phosphor Icons

The BioFrontier mark — the bird used as the site logo and favicon — is derived
from the `bird` glyph (regular weight) in Phosphor Icons.

**Used in:** `src/app/icon.svg`, `src/app/favicon.ico`, `src/app/apple-icon.png`,
and `src/components/ui/Mark.tsx`.

**Modifications:** recoloured to the project's brand green, and the path painted
with a stroke in its own colour so the outline survives rendering at 16px.
The path geometry is otherwise unchanged.

**Source:** https://phosphoricons.com · https://github.com/phosphor-icons/core

```
MIT License

Copyright (c) 2023 Phosphor Icons

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## Map data and tiles

Not a licence notice so much as an attribution requirement the map already
satisfies on screen, recorded here so it is not lost in a refactor:

- **OpenStreetMap** — basemap tiles. © OpenStreetMap contributors, ODbL.
  The attribution control in `GapMap.client.tsx` carries this and must not be
  removed or hidden.
- **GBIF** and **iNaturalist** — occurrence records. Cited in the data summary
  bar and in the methodology panel.
- **MapBiomas** — land cover used for the habitat component. Cited in the
  methodology panel.
