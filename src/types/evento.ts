export type EventoEstado = 'borrador' | 'activo' | 'finalizado' | 'cancelado'

export type Evento = {
  id: string
  nombre: string
  descripcion: string | null
  lugar: string | null
  direccion: string | null
  latitud: number
  longitud: number
  radio_metros: number
  fecha_desde: string
  fecha_hasta: string
  hora_inicio: string | null
  hora_fin: string | null
  flyer_url: string | null
  estado: EventoEstado
  creado_en: string
  modificado_en: string
  usuario_alta: string | null
  usuario_modificacion: string | null
}
