import type { Disc, Track } from '../types'
import { accentFor, INK } from '../lib/colors'
import { fitText, FONT } from './textures'
import { moodLabel, songMoods } from '../lib/songMood'
import { songMoodKey } from '../lib/songMoodQueue'

export function drawTrackList(
  ctx: CanvasRenderingContext2D, w: number, h: number, disc: Disc,
  tracks: Track[] | null, error: string | null, offset: number,
) {
  const pad = w * 0.055
  const header = h * 0.18
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = '#fff7e8'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = accentFor(disc.id)
  ctx.fillRect(0, 0, w, header)
  ctx.fillStyle = INK
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  fitText(ctx, disc.title, w - pad * 2, w * 0.055)
  ctx.fillText(disc.title, pad, header * 0.4)
  ctx.font = `700 ${w * 0.028}px ${FONT}`
  ctx.fillText('TRACK LIST', pad, header * 0.78)

  const message = !disc.tracksAvailable ? 'Track list unavailable from Spotify'
    : error ? 'Could not load the track list'
      : !tracks ? 'Loading tracks…' : !tracks.length ? 'No tracks in this collection' : null
  if (message) {
    ctx.textAlign = 'center'
    fitText(ctx, message, w - pad * 2, w * 0.045)
    ctx.fillText(message, w / 2, h * 0.55)
  } else {
    const rowH = h * 0.12
    // Draw only the visible rows, wrapping indices so the first follows the last without a gap.
    const start = Math.floor(offset) - 1
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, header, w, h * 0.91 - header)
    ctx.clip()
    for (let row = start; row < start + 9; row++) {
      const index = ((row % tracks!.length) + tracks!.length) % tracks!.length
      const track = tracks![index]
      const y = header + h * 0.055 + (row - offset) * rowH
      ctx.textAlign = 'left'
      ctx.font = `700 ${w * 0.035}px ${FONT}`
      ctx.fillText(String(index + 1).padStart(2, '0'), pad, y)
      const nameX = w * 0.15
      const nameWidth = w * 0.62
      ctx.font = `800 ${w * 0.047}px ${FONT}`
      ellipsis(ctx, track.name, nameX, y, nameWidth)
      ctx.globalAlpha = 0.65
      ctx.font = `600 ${w * 0.031}px ${FONT}`
      ellipsis(ctx, track.artists, nameX, y + rowH * 0.37, nameWidth - w * 0.12)
      ctx.globalAlpha = 1
      ctx.textAlign = 'right'
      ctx.font = `500 ${w * 0.025}px ${FONT}`
      ctx.fillText(moodLabel(songMoods.get(songMoodKey(track))).text, w - pad, y + rowH * 0.37)
      const seconds = Math.max(0, Math.floor(track.durationMs / 1000))
      ctx.textAlign = 'right'
      ctx.font = `600 ${w * 0.033}px ${FONT}`
      ctx.fillText(`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`, w - pad, y)
    }
    ctx.restore()
  }
  ctx.textAlign = 'center'
  ctx.font = `600 ${w * 0.028}px ${FONT}`
  ctx.fillText(`${tracks?.length ?? disc.trackCount} tracks`, w / 2, h * 0.955)
  ctx.strokeStyle = INK
  ctx.lineWidth = Math.max(4, w / 100)
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth)
}

function ellipsis(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, width: number) {
  let clipped = text
  while (clipped.length && ctx.measureText(clipped).width > width) clipped = clipped.slice(0, -1)
  if (clipped !== text) {
    while (clipped.length && ctx.measureText(clipped + '…').width > width) clipped = clipped.slice(0, -1)
    clipped += '…'
  }
  ctx.fillText(clipped, x, y)
}
