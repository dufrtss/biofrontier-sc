import { latLngToCell, cellToLatLng, cellToBoundary, polygonToCells } from 'h3-js'

export const SC_RESOLUTION = 6

export const SC_BBOX = {
  north: -25.95,
  south: -29.35,
  west:  -53.85,
  east:  -48.35,
}

// Average area of an H3 resolution-6 hexbin in km²
export const H3_RES6_AREA_KM2 = 36.13

export function occurrenceToHex(lat: number, lng: number): string {
  return latLngToCell(lat, lng, SC_RESOLUTION)
}

export function hexCenter(hexId: string): [number, number] {
  const [lat, lng] = cellToLatLng(hexId)
  return [lat, lng]
}

// Returns [[lat, lng], ...] — compatible with Leaflet L.polygon()
export function hexBoundary(hexId: string): Array<[number, number]> {
  return cellToBoundary(hexId).map(([lat, lng]) => [lat, lng] as [number, number])
}

export function isInSCBounds(lat: number, lng: number): boolean {
  return (
    lat >= SC_BBOX.south && lat <= SC_BBOX.north &&
    lng >= SC_BBOX.west  && lng <= SC_BBOX.east
  )
}

// All H3 hexbins intersecting Santa Catarina's bounding box at resolution 6
// polygonToCells in h3-js v4 uses [lat, lng] order
export function generateSCHexgrid(): string[] {
  const polygon: Array<[number, number]> = [
    [SC_BBOX.north, SC_BBOX.west],
    [SC_BBOX.north, SC_BBOX.east],
    [SC_BBOX.south, SC_BBOX.east],
    [SC_BBOX.south, SC_BBOX.west],
    [SC_BBOX.north, SC_BBOX.west],  // close ring
  ]
  return polygonToCells(polygon, SC_RESOLUTION)
}
