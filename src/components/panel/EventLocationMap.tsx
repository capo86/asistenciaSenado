import { useEffect, useMemo, useRef } from 'react'
import L, { type LatLngExpression } from 'leaflet'
import 'leaflet/dist/leaflet.css'

import type { Evento } from '@/types/evento'

type Coordinates = {
  latitud: number
  longitud: number
}

type EventLocationMapProps = {
  evento: Evento
  onChange: (coordinates: Coordinates) => void
}

const fallbackPosition: Coordinates = {
  latitud: -25.282197,
  longitud: -57.6351,
}

const eventMarkerIcon = L.divIcon({
  className: 'event-location-marker',
  html: '<span class="event-location-marker__pin"><span></span></span>',
  iconAnchor: [17, 34],
  iconSize: [34, 34],
})

function getPositionFromValues(latitud: number, longitud: number): Coordinates {
  if (Number.isFinite(latitud) && Number.isFinite(longitud)) {
    return {
      latitud,
      longitud,
    }
  }

  return fallbackPosition
}

function getPosition(evento: Evento): Coordinates {
  return getPositionFromValues(evento.latitud, evento.longitud)
}

function toLeafletPosition(coordinates: Coordinates): LatLngExpression {
  return [coordinates.latitud, coordinates.longitud]
}

function roundCoordinate(value: number) {
  return Number(value.toFixed(6))
}

export function EventLocationMap({ evento, onChange }: EventLocationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const initialEventoRef = useRef(evento)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const circleRef = useRef<L.Circle | null>(null)
  const onChangeRef = useRef(onChange)
  const displayPosition = useMemo(
    () => getPositionFromValues(evento.latitud, evento.longitud),
    [evento.latitud, evento.longitud],
  )

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return
    }

    const initialEvento = initialEventoRef.current
    const position = getPosition(initialEvento)
    const leafletPosition = toLeafletPosition(position)
    const map = L.map(containerRef.current, {
      attributionControl: false,
      scrollWheelZoom: false,
      zoomControl: true,
    }).setView(leafletPosition, 17)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 20,
    }).addTo(map)

    L.control
      .attribution({ prefix: false })
      .addAttribution('&copy; OpenStreetMap contributors')
      .addTo(map)

    const marker = L.marker(leafletPosition, {
      autoPan: true,
      draggable: true,
      icon: eventMarkerIcon,
    }).addTo(map)

    const circle = L.circle(leafletPosition, {
      color: '#9f7b36',
      fillColor: '#9f7b36',
      fillOpacity: 0.14,
      radius: initialEvento.radio_metros,
      weight: 2,
    }).addTo(map)

    function commitLocation(latlng: L.LatLng) {
      const nextPosition = {
        latitud: roundCoordinate(latlng.lat),
        longitud: roundCoordinate(latlng.lng),
      }

      marker.setLatLng(latlng)
      circle.setLatLng(latlng)
      onChangeRef.current(nextPosition)
    }

    marker.on('dragend', () => {
      commitLocation(marker.getLatLng())
    })

    map.on('click', (event) => {
      commitLocation(event.latlng)
    })

    mapRef.current = map
    markerRef.current = marker
    circleRef.current = circle

    window.setTimeout(() => map.invalidateSize(), 0)

    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
      circleRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const marker = markerRef.current
    const circle = circleRef.current

    if (!map || !marker || !circle) {
      return
    }

    const position = displayPosition
    const leafletPosition = toLeafletPosition(position)

    marker.setLatLng(leafletPosition)
    circle.setLatLng(leafletPosition)
    circle.setRadius(evento.radio_metros)
    map.setView(leafletPosition, map.getZoom())
    window.setTimeout(() => map.invalidateSize(), 0)
  }, [displayPosition, evento.radio_metros])

  return (
    <div className="event-location-map overflow-hidden rounded-lg border bg-muted/40">
      <div ref={containerRef} className="h-72 w-full sm:h-80" />
      <div className="grid grid-cols-2 border-t bg-card/90 text-xs">
        <div className="border-r px-3 py-2">
          <p className="text-muted-foreground">Latitud</p>
          <p className="mt-1 font-mono font-medium">
            {displayPosition.latitud.toFixed(6)}
          </p>
        </div>
        <div className="px-3 py-2">
          <p className="text-muted-foreground">Longitud</p>
          <p className="mt-1 font-mono font-medium">
            {displayPosition.longitud.toFixed(6)}
          </p>
        </div>
      </div>
    </div>
  )
}
