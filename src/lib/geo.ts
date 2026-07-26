export type Coordinates = {
  latitud: number
  longitud: number
}

const EARTH_RADIUS_METERS = 6_371_000

function toRadians(value: number) {
  return (value * Math.PI) / 180
}

export function haversineDistanceMeters(from: Coordinates, to: Coordinates) {
  const latDelta = toRadians(to.latitud - from.latitud)
  const lonDelta = toRadians(to.longitud - from.longitud)
  const fromLat = toRadians(from.latitud)
  const toLat = toRadians(to.latitud)

  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(lonDelta / 2) ** 2

  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
