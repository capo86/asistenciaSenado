import type { Evento } from '@/types/evento'

export type EventoAvailability = {
  isActiveToday: boolean
  label: string
  message: string
  today: string
}

export function getTodayDateValue(date = new Date()) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)

  return offsetDate.toISOString().slice(0, 10)
}

export function formatDateValue(value: string) {
  return new Intl.DateTimeFormat('es-PY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`))
}

export function formatDateRange(fechaDesde: string, fechaHasta: string) {
  if (fechaDesde === fechaHasta) {
    return formatDateValue(fechaDesde)
  }

  return `${formatDateValue(fechaDesde)} - ${formatDateValue(fechaHasta)}`
}

export function getEventoAvailability(evento: Evento): EventoAvailability {
  const today = getTodayDateValue()

  if (evento.estado !== 'activo') {
    return {
      isActiveToday: false,
      label: 'No activo',
      message: 'El evento no se encuentra en estado activo.',
      today,
    }
  }

  if (today < evento.fecha_desde) {
    return {
      isActiveToday: false,
      label: 'Proximo',
      message: `El evento inicia el ${formatDateValue(evento.fecha_desde)}.`,
      today,
    }
  }

  if (today > evento.fecha_hasta) {
    return {
      isActiveToday: false,
      label: 'Finalizado',
      message: `El evento finalizo el ${formatDateValue(evento.fecha_hasta)}.`,
      today,
    }
  }

  return {
    isActiveToday: true,
    label: 'Activo hoy',
    message: 'El evento esta activo para la fecha de hoy.',
    today,
  }
}
