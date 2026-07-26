const DEFAULT_AUTH_EMAIL_DOMAIN = 'asistencia.local'

export function normalizeCedula(value: string) {
  return value.replace(/\D/g, '')
}

export function assertValidCedula(value: string) {
  const cedula = normalizeCedula(value)

  if (!/^\d{5,10}$/.test(cedula)) {
    throw new Error('Ingresa una cedula valida.')
  }

  return cedula
}

export function authEmailFromCedula(value: string) {
  const cedula = assertValidCedula(value)
  const domain =
    import.meta.env.VITE_AUTH_EMAIL_DOMAIN?.trim() || DEFAULT_AUTH_EMAIL_DOMAIN

  return `${cedula}@${domain}`
}

export function cedulaFromAuthEmail(email?: string | null) {
  return email?.split('@')[0] ?? ''
}
