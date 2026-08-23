import sharp from 'sharp';
import { logger } from '../utils/logger';

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

// Check if mime type is processable image
export function isProcessableImage(mimeType: string): boolean {
  return ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/tiff'].includes(mimeType);
}

// Check if mime type is video (for future FFmpeg processing)
export function isVideo(mimeType: string): boolean {
  return mimeType.startsWith('video/');
}
