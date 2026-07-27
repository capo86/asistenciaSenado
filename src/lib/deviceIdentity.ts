const DEVICE_ID_KEY = 'asistencia-device-id'

let inMemoryDeviceId: string | null = null

function createDeviceId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  const randomPart = Math.random().toString(36).slice(2)

  return `device-${Date.now()}-${randomPart}`
}

export function getAttendanceDeviceId() {
  if (typeof window === 'undefined') {
    return createDeviceId()
  }

  if (inMemoryDeviceId) {
    return inMemoryDeviceId
  }

  try {
    const currentValue = window.localStorage.getItem(DEVICE_ID_KEY)

    if (currentValue) {
      inMemoryDeviceId = currentValue

      return currentValue
    }

    const nextValue = createDeviceId()

    window.localStorage.setItem(DEVICE_ID_KEY, nextValue)
    inMemoryDeviceId = nextValue

    return nextValue
  } catch {
    inMemoryDeviceId = createDeviceId()

    return inMemoryDeviceId
  }
}
