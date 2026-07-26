import { useMemo, useRef } from 'react'
import { CheckCircle2, Copy, Download, QrCode, Share2 } from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import { toast } from 'sonner'

import academiaLogo from '../../../nuevo_Mesa de trabajo 1.png'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { Evento } from '@/types/evento'

type EventQrCardProps = {
  evento: Evento
}

function getEventUrl(eventoId: string) {
  const origin =
    typeof window === 'undefined'
      ? 'https://asistencia.local'
      : window.location.origin

  return `${origin}/evento/${encodeURIComponent(eventoId)}`
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('No se pudo generar la imagen del QR.'))
        return
      }

      resolve(blob)
    }, 'image/png')
  })
}

export function EventQrCard({ evento }: EventQrCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const eventUrl = useMemo(() => getEventUrl(evento.id), [evento.id])

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(eventUrl)
      toast.success('Enlace copiado', {
        description: 'Ya puedes compartir el acceso al formulario.',
      })
    } catch (error) {
      toast.error('No se pudo copiar', {
        description:
          error instanceof Error ? error.message : 'Copia el enlace manualmente.',
      })
    }
  }

  async function downloadQr() {
    const canvas = canvasRef.current

    if (!canvas) {
      toast.error('QR no disponible')
      return
    }

    try {
      const blob = await canvasToBlob(canvas)
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')

      link.href = objectUrl
      link.download = `qr-${evento.id}.png`
      link.click()
      URL.revokeObjectURL(objectUrl)
      toast.success('QR descargado')
    } catch (error) {
      toast.error('No se pudo descargar', {
        description:
          error instanceof Error ? error.message : 'Intenta compartir el enlace.',
      })
    }
  }

  async function shareQr() {
    const canvas = canvasRef.current

    if (!canvas) {
      toast.error('QR no disponible')
      return
    }

    try {
      const blob = await canvasToBlob(canvas)
      const file = new File([blob], `qr-${evento.id}.png`, {
        type: 'image/png',
      })

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          text: evento.nombre,
          title: 'QR de asistencia',
        })
        toast.success('QR compartido')
        return
      }

      if (navigator.share) {
        await navigator.share({
          text: evento.nombre,
          title: 'QR de asistencia',
          url: eventUrl,
        })
        toast.success('Enlace compartido')
        return
      }

      await copyLink()
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }

      toast.error('No se pudo compartir', {
        description:
          error instanceof Error ? error.message : 'Intenta copiar el enlace.',
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="size-5 text-[var(--institutional-gold)]" />
          QR del evento
        </CardTitle>
        <CardDescription>
          Acceso directo al formulario publico de asistencia.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <div className="mx-auto rounded-lg border bg-white p-3 shadow-sm">
            <QRCodeCanvas
              ref={canvasRef}
              value={eventUrl}
              size={208}
              level="H"
              marginSize={2}
              fgColor="#1f1f1f"
              bgColor="#ffffff"
              imageSettings={{
                excavate: true,
                height: 44,
                src: academiaLogo,
                width: 44,
              }}
              title={`QR ${evento.nombre}`}
            />
          </div>

          <div className="rounded-md border bg-muted/35 p-3 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
              {evento.nombre}
            </p>
            <p className="mt-2 break-all text-xs text-muted-foreground">
              {eventUrl}
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <Button type="button" onClick={shareQr}>
              <Share2 />
              Compartir
            </Button>
            <Button type="button" variant="outline" onClick={copyLink}>
              <Copy />
              Copiar
            </Button>
            <Button type="button" variant="outline" onClick={downloadQr}>
              <Download />
              PNG
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
