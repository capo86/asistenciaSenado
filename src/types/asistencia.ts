export type Asistencia = {
  id: string
  evento_id: string
  cedula: string
  nombre_completo: string | null
  latitud: number
  longitud: number
  distancia_metros: number | null
  dentro_del_cuadrante: boolean
  ip_address: string | null
  creado_en: string
}
