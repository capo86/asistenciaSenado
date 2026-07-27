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

const QR_SIZE = 240
const QR_EXPORT_SIZE = 1024
const QR_LOGO_FRAME_HEIGHT = 66
const QR_LOGO_FRAME_WIDTH = 92
const QR_LOGO_HEIGHT = 50
const QR_LOGO_WIDTH = 74
const QR_LOGO_MARK_CROP = {
  height: 900,
  width: 1330,
  x: 460,
  y: 130,
}

const qrLogoPreviewStyle = {
  height: '7.8125rem',
  left: '-1.625rem',
  top: '-0.45rem',
  width: '7.8125rem',
}

function getEventUrl(eventoId: string) {
  const origin =
    typeof window === 'undefined'
      ? 'https://asistencia.local'
      : window.location.origin

  return `${origin}/evento/${encodeURIComponent(eventoId)}`
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()

    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('No se pudo preparar el logo.'))
    image.src = src
  })
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.min(radius, width / 2, height / 2)

  context.beginPath()
  context.moveTo(x + safeRadius, y)
  context.arcTo(x + width, y, x + width, y + height, safeRadius)
  context.arcTo(x + width, y + height, x, y + height, safeRadius)
  context.arcTo(x, y + height, x, y, safeRadius)
  context.arcTo(x, y, x + width, y, safeRadius)
  context.closePath()
}

async function canvasToBrandedBlob(canvas: HTMLCanvasElement) {
  const logo = await loadImage(academiaLogo)
  const outputCanvas = document.createElement('canvas')
  const context = outputCanvas.getContext('2d')

  if (!context) {
    throw new Error('No se pudo generar la imagen del QR.')
  }

  outputCanvas.width = QR_EXPORT_SIZE
  outputCanvas.height = QR_EXPORT_SIZE
  context.imageSmoothingEnabled = false
  context.drawImage(canvas, 0, 0, QR_EXPORT_SIZE, QR_EXPORT_SIZE)
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'

  const scale = QR_EXPORT_SIZE / QR_SIZE
  const frameWidth = QR_LOGO_FRAME_WIDTH * scale
  const frameHeight = QR_LOGO_FRAME_HEIGHT * scale
  const logoWidth = QR_LOGO_WIDTH * scale
  const logoHeight = QR_LOGO_HEIGHT * scale
  const frameX = (QR_EXPORT_SIZE - frameWidth) / 2
  const frameY = (QR_EXPORT_SIZE - frameHeight) / 2
  const logoX = (QR_EXPORT_SIZE - logoWidth) / 2
  const logoY = (QR_EXPORT_SIZE - logoHeight) / 2

  context.save()
  roundedRect(
    context,
    frameX,
    frameY,
    frameWidth,
    frameHeight,
    10 * scale,
  )
  context.fillStyle = '#ffffff'
  context.fill()
  context.lineWidth = 1.5 * scale
  context.strokeStyle = '#d8d2c8'
  context.stroke()
  context.restore()

  context.drawImage(
    logo,
    QR_LOGO_MARK_CROP.x,
    QR_LOGO_MARK_CROP.y,
    QR_LOGO_MARK_CROP.width,
    QR_LOGO_MARK_CROP.height,
    logoX,
    logoY,
    logoWidth,
    logoHeight,
  )

  return new Promise<Blob>((resolve, reject) => {
    outputCanvas.toBlob((blob) => {
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
      const blob = await canvasToBrandedBlob(canvas)
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
      const blob = await canvasToBrandedBlob(canvas)
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
          <div className="mx-auto rounded-xl border bg-white p-4 shadow-sm shadow-black/10">
            <div className="relative flex size-60 items-center justify-center">
              <QRCodeCanvas
                ref={canvasRef}
                value={eventUrl}
                size={QR_SIZE}
                level="H"
                marginSize={3}
                fgColor="#1f1f1f"
                bgColor="#ffffff"
                className="block size-60"
                imageSettings={{
                  excavate: true,
                  height: QR_LOGO_FRAME_HEIGHT,
                  opacity: 0,
                  src: academiaLogo,
                  width: QR_LOGO_FRAME_WIDTH,
                }}
                title={`QR ${evento.nombre}`}
              />
              <div
                className="pointer-events-none absolute left-1/2 top-1/2 flex h-[4.125rem] w-[5.75rem] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-lg border border-zinc-200 bg-white shadow-sm"
                aria-hidden="true"
              >
                <span className="relative h-[3.125rem] w-[4.625rem] overflow-hidden">
                  <img
                    src={academiaLogo}
                    alt=""
                    className="absolute max-w-none object-contain"
                    style={qrLogoPreviewStyle}
                  />
                </span>
              </div>
            </div>
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
