import sharp from 'sharp';
import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';
import ffmpegPath from 'ffmpeg-static';
import { logger } from '../utils/logger';

const execFileAsync = promisify(execFile);

// Process image: generate thumbnail
export async function processImage(buffer: Buffer): Promise<{ thumbnail: Buffer; width: number; height: number }> {
  try {
    const metadata = await sharp(buffer).metadata();
    const width = metadata.width || 0;
    const height = metadata.height || 0;

    // Generate thumbnail (max 400px wide, maintain aspect ratio)
    const thumbnail = await sharp(buffer)
      .resize(400, 400, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 80 })
      .toBuffer();

    return { thumbnail, width, height };
  } catch (err) {
    logger.error('Image processing failed:', err);
    // Return empty thumbnail on error
    return { thumbnail: Buffer.alloc(0), width: 0, height: 0 };
  }
}

// Get image dimensions without full processing
export async function getImageDimensions(buffer: Buffer): Promise<{ width: number; height: number }> {
  try {
    const metadata = await sharp(buffer).metadata();
    return { width: metadata.width || 0, height: metadata.height || 0 };
  } catch {
    return { width: 0, height: 0 };
  }
}

export async function processVideoThumbnail(buffer: Buffer): Promise<Buffer> {
  if (!ffmpegPath) {
    throw new Error('FFmpeg binary is unavailable');
  }

  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'signage-video-'));
  const inputPath = path.join(directory, 'source');
  const outputPath = path.join(directory, 'thumbnail.jpg');

  try {
    await fs.writeFile(inputPath, buffer);
    await execFileAsync(ffmpegPath, [
      '-y',
      '-ss', '0.1',
      '-i', inputPath,
      '-frames:v', '1',
      '-vf', 'scale=400:-2',
      '-q:v', '4',
      outputPath,
    ]);
    return await fs.readFile(outputPath);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

// Check if mime type is processable image
export function isProcessableImage(mimeType: string): boolean {
  return ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/tiff'].includes(mimeType);
}

export function isVideo(mimeType: string): boolean {
  return mimeType.startsWith('video/');
}
