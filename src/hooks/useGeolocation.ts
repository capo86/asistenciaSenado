import { useCallback, useState } from 'react'

export type GeoPosition = {
  latitud: number
  longitud: number
  precision_metros: number
}

type GeoStatus = 'idle' | 'loading' | 'success' | 'error'

function getGeolocationErrorMessage(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) {
    return 'Debes permitir el acceso a tu ubicación para validar la asistencia.'
  }

  if (error.code === error.POSITION_UNAVAILABLE) {
    return 'No se pudo obtener tu ubicación actual. Intenta nuevamente.'
  }

  if (error.code === error.TIMEOUT) {
    return 'La solicitud de ubicación tardó demasiado. Intenta otra vez.'
  }

  return 'Ocurrió un error al solicitar la ubicación.'
}

export function useGeolocation() {
  const [status, setStatus] = useState<GeoStatus>('idle')
  const [position, setPosition] = useState<GeoPosition | null>(null)
  const [error, setError] = useState<string | null>(null)

  const requestLocation = useCallback(() => {
    setStatus('loading')
    setError(null)

    return new Promise<GeoPosition>((resolve, reject) => {
      if (!navigator.geolocation) {
        const message = 'Tu navegador no soporta geolocalización.'
        setStatus('error')
        setError(message)
        reject(new Error(message))
        return
      }

      navigator.geolocation.getCurrentPosition(
        (currentPosition) => {
          const nextPosition = {
            latitud: currentPosition.coords.latitude,
            longitud: currentPosition.coords.longitude,
            precision_metros: currentPosition.coords.accuracy,
          }

          setPosition(nextPosition)
          setStatus('success')
          resolve(nextPosition)
        },
        (geoError) => {
          const message = getGeolocationErrorMessage(geoError)
          setStatus('error')
          setError(message)
          reject(new Error(message))
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 15_000,
        },
      )
    })
  }, [])

  return {
    error,
    position,
    requestLocation,
    status,
  }
}
