import { latLngToCell, cellToLatLng, cellToBoundary, polygonToCells, CONTAINED_BY_CELL } from 'h3-js'

// Resolution for point-to-hex mapping (~0.7 km² hexbins, suitable for occurrence clustering)
export const SC_RESOLUTION = 7

// Resolution for the statewide grid overview (~36 km² hexbins)
export const SC_GRID_RESOLUTION = 6

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

// All H3 hexbins fully contained within Santa Catarina's bounding box at resolution 6
export function generateSCHexgrid(): string[] {
  const polygon: Array<[number, number]> = [
    [SC_BBOX.north, SC_BBOX.west],
    [SC_BBOX.north, SC_BBOX.east],
    [SC_BBOX.south, SC_BBOX.east],
    [SC_BBOX.south, SC_BBOX.west],
    [SC_BBOX.north, SC_BBOX.west],  // close ring
  ]
  return polygonToCells(polygon, SC_GRID_RESOLUTION, { containmentMode: CONTAINED_BY_CELL })
}
