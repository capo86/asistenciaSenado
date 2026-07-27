export type Persona = {
  cedula: string
  contacto: {
    email_mask: string | null
    registrado: boolean
    telefono_mask: string | null
  } | null
  nombre: string | null
  apellido: string | null
  nombre_completo: string
}
