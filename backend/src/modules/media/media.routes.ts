import { Router, Request, Response } from 'express';
import multer from 'multer';
import { query, queryOne, execute, paginatedQuery } from '../../services/query';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/permission.middleware';
import { RowDataPacket } from 'mysql2';
import {
  uploadFile,
  deleteFile,
  getPresignedUrl,
  getFileStream,
  generateStorageKey,
} from '../../services/storage';
import { isProcessableImage, isVideo } from '../../services/media-processor';
import { getMediaQueue } from '../../workers/queue';

const router = Router();

// File upload config — max 500MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
      'video/mp4', 'video/webm', 'video/quicktime',
      'audio/mpeg', 'audio/wav',
      'application/pdf',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  },
});

interface MediaRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  filename: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  storage_key: string;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  thumbnail_key: string | null;
  status: string;
  uploaded_by: number | null;
  created_at: Date;
  updated_at: Date;
}

// ─── POST /api/v1/media/upload ──────────────────────────────────
router.post('/media/upload', authenticate, requireRole('super_admin', 'admin', 'editor'), upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }

    const tenantId = req.user!.tenantId;
    const file = req.file;

    // Generate storage key
    const storageKey = generateStorageKey(tenantId, file.originalname);

    // Upload to MinIO
    await uploadFile(storageKey, file.buffer, file.mimetype);

    // Store metadata in DB
    const result = await execute(
      `INSERT INTO media (tenant_id, filename, original_name, mime_type, file_size, storage_key, status, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, 'PROCESSING', ?)`,
      [tenantId, `${Date.now()}-${file.originalname}`, file.originalname, file.mimetype, file.size, storageKey, req.user!.id]
    );

    const mediaId = result.insertId;

    // Queue background processing job for thumbnails
    if (isProcessableImage(file.mimetype) || isVideo(file.mimetype)) {
      try {
        const queue = getMediaQueue();
        await queue.add('process-media', {
          tenantId,
          mediaId,
          storageKey,
          mimeType: file.mimetype,
          originalName: file.originalname,
        }, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: true,
          removeOnFail: false,
        });
      } catch (err) {
        // Queue might not be available (no Redis) — mark as READY anyway
        console.warn('Queue not available, skipping background processing:', err);
        await execute(
          `UPDATE media SET status = 'READY' WHERE id = ? AND tenant_id = ?`,
          [mediaId, tenantId]
        );
      }
    } else {
      // Non-processable file type — mark as READY immediately
      await execute(
        `UPDATE media SET status = 'READY' WHERE id = ? AND tenant_id = ?`,
        [mediaId, tenantId]
      );
    }

    // Generate presigned URL for immediate use
    const fileUrl = await getPresignedUrl(storageKey);

    const media = await queryOne<MediaRow>('SELECT * FROM media WHERE id = ?', [mediaId]);

    res.status(201).json({ media, file_url: fileUrl });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// ─── GET /api/v1/media ──────────────────────────────────────────
router.get('/media', authenticate, requireRole('super_admin', 'admin', 'editor', 'viewer'), async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const search = (req.query.search as string) || '';
    const mimeType = (req.query.type as string) || '';
    const tenantId = req.user!.tenantId;

    let whereClause = 'WHERE tenant_id = ?';
    const params: unknown[] = [tenantId];

    if (search) {
      whereClause += ' AND (original_name LIKE ? OR filename LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (mimeType) {
      whereClause += ' AND mime_type LIKE ?';
      params.push(`${mimeType}%`);
    }

    const result = await paginatedQuery<MediaRow>(
      `SELECT * FROM media ${whereClause} ORDER BY created_at DESC`,
      `SELECT COUNT(*) AS total FROM media ${whereClause}`,
      params,
      page,
      limit
    );

    // Generate presigned URLs for each media item
    const dataWithUrls = await Promise.all(
      (result.data || []).map(async (item) => {
        try {
          const fileUrl = await getPresignedUrl(item.storage_key, 3600); // 1 hour
          const thumbnailUrl = item.thumbnail_key
            ? await getPresignedUrl(item.thumbnail_key, 3600)
            : null;
          return { ...item, file_url: fileUrl, thumbnail_url: thumbnailUrl };
        } catch {
          return { ...item, file_url: null, thumbnail_url: null };
        }
      })
    );

    res.json({ ...result, data: dataWithUrls });
  } catch (err) {
    console.error('List media error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/v1/media/:id ──────────────────────────────────────
router.get('/media/:id', authenticate, requireRole('super_admin', 'admin', 'editor', 'viewer'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    const media = await queryOne<MediaRow>(
      'SELECT * FROM media WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );

    if (!media) {
      res.status(404).json({ error: 'Media not found' });
      return;
    }

    // Generate presigned URLs
    const fileUrl = await getPresignedUrl(media.storage_key, 3600);
    const thumbnailUrl = media.thumbnail_key
      ? await getPresignedUrl(media.thumbnail_key, 3600)
      : null;

    res.json({ media: { ...media, file_url: fileUrl, thumbnail_url: thumbnailUrl } });
  } catch (err) {
    console.error('Get media error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/v1/media/file/:id ────────────────────────────────
// Stream file directly from MinIO
router.get('/media/file/:id', authenticate, requireRole('super_admin', 'admin', 'editor', 'viewer'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    const media = await queryOne<MediaRow>(
      'SELECT * FROM media WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );

    if (!media) {
      res.status(404).json({ error: 'Media not found' });
      return;
    }

    // Stream file from MinIO
    const stream = await getFileStream(media.storage_key);

    res.setHeader('Content-Type', media.mime_type);
    res.setHeader('Content-Length', media.file_size);
    res.setHeader('Cache-Control', 'public, max-age=86400');

    // Pipe stream to response
    const chunks: Buffer[] = [];
    stream.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on('end', () => {
      res.send(Buffer.concat(chunks));
    });
    stream.on('error', (err) => {
      console.error('Stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to stream file' });
      }
    });
  } catch (err) {
    console.error('File serve error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /api/v1/media/:id ───────────────────────────────────
router.delete('/media/:id', authenticate, requireRole('super_admin', 'admin', 'editor'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    const media = await queryOne<MediaRow>(
      'SELECT * FROM media WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );

    if (!media) {
      res.status(404).json({ error: 'Media not found' });
      return;
    }

    // Delete from MinIO
    await deleteFile(media.storage_key);

    // Delete thumbnail if exists
    if (media.thumbnail_key) {
      try {
        await deleteFile(media.thumbnail_key);
      } catch {
        // Thumbnail might not exist yet
      }
    }

    // Delete from DB
    await execute('DELETE FROM media WHERE id = ? AND tenant_id = ?', [id, tenantId]);

    res.json({ message: 'Media deleted' });
  } catch (err) {
    console.error('Delete media error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/v1/media/stats ────────────────────────────────────
router.get('/media-stats', authenticate, async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;

    const stats = await queryOne<RowDataPacket>(
      `SELECT
        COUNT(*) AS total_files,
        COALESCE(SUM(file_size), 0) AS total_size_bytes,
        COUNT(CASE WHEN mime_type LIKE 'image/%' THEN 1 END) AS images,
        COUNT(CASE WHEN mime_type LIKE 'video/%' THEN 1 END) AS videos,
        COUNT(CASE WHEN mime_type LIKE 'audio/%' THEN 1 END) AS audio
       FROM media WHERE tenant_id = ?`,
      [tenantId]
    );

    res.json({ stats });
  } catch (err) {
    console.error('Media stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
