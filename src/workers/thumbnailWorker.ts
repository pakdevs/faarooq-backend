// Simple on-demand thumbnail generation worker placeholder.
// In production you might run this as a separate process consuming a queue.
// Here we expose a function that could be imported or invoked via a small CLI.

import sharp from 'sharp'
import path from 'path'
import fs from 'fs'

export interface ThumbnailJob {
  sourcePath: string // absolute path to original file
  destPath: string // absolute path for thumbnail
  maxSize: number // max width/height
}

export async function generateThumbnail(
  job: ThumbnailJob
): Promise<{ width: number; height: number }> {
  const { sourcePath, destPath, maxSize } = job
  if (!fs.existsSync(sourcePath)) throw new Error('source_missing')
  await fs.promises.mkdir(path.dirname(destPath), { recursive: true })
  const image = sharp(sourcePath)
  const meta = await image.metadata()
  await image
    .resize({ width: maxSize, height: maxSize, fit: 'inside', withoutEnlargement: true })
    .toFile(destPath)
  return { width: meta.width || 0, height: meta.height || 0 }
}

if (require.main === module) {
  // rudimentary CLI: node dist/workers/thumbnailWorker.js <src> <dest> [maxSize]
  const [src, dest, sizeArg] = process.argv.slice(2)
  if (!src || !dest) {
    console.error('Usage: node thumbnailWorker.js <src> <dest> [maxSize=512]')
    process.exit(1)
  }
  const maxSize = sizeArg ? parseInt(sizeArg, 10) : 512
  generateThumbnail({ sourcePath: src, destPath: dest, maxSize })
    .then((r) => {
      console.log('thumbnail_done', r)
    })
    .catch((e) => {
      console.error('thumbnail_failed', e)
      process.exit(2)
    })
}
