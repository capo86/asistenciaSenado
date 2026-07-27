export type Asistencia = {
  id: string
  evento_id: string
  cedula: string
  departamento: string | null
  device_id: string | null
  distrito: string | null
  email: string | null
  nombre_completo: string | null
  telefono: string | null
  fecha_local: string
  latitud: number
  longitud: number
  distancia_metros: number | null
  dentro_del_cuadrante: boolean
  ip_address: string | null
  user_agent: string | null
  creado_en: string
}
