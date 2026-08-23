import { Router, Request, Response } from 'express';
import { query, queryOne, execute, paginatedQuery } from '../../services/query';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/permission.middleware';
import { RowDataPacket } from 'mysql2';

const router = Router();

interface PlaylistRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  name: string;
  description: string | null;
  loop_playback: boolean;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
}

interface PlaylistItemRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  playlist_id: number;
  media_id: number;
  sort_order: number;
  duration_seconds: number | null;
  transition: string;
  created_at: Date;
  // Joined fields
  original_name?: string;
  mime_type?: string;
  file_size?: number;
  thumbnail_key?: string | null;
}

// ─── GET /api/v1/playlists ──────────────────────────────────────
router.get('/playlists', authenticate, requireRole('super_admin', 'admin', 'editor', 'viewer'), async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const search = (req.query.search as string) || '';
    const tenantId = req.user!.tenantId;

    let whereClause = 'WHERE p.tenant_id = ?';
    const params: unknown[] = [tenantId];

    if (search) {
      whereClause += ' AND (p.name LIKE ? OR p.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    const result = await paginatedQuery<PlaylistRow>(
      `SELECT p.*,
        (SELECT COUNT(*) FROM playlist_items pi WHERE pi.playlist_id = p.id) AS item_count
       FROM playlists p
       ${whereClause}
       ORDER BY p.created_at DESC`,
      `SELECT COUNT(*) AS total FROM playlists p ${whereClause}`,
      params,
      page,
      limit
    );

    res.json(result);
  } catch (err) {
    console.error('List playlists error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/v1/playlists/:id ──────────────────────────────────
router.get('/playlists/:id', authenticate, requireRole('super_admin', 'admin', 'editor', 'viewer'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    const playlist = await queryOne<PlaylistRow>(
      'SELECT * FROM playlists WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );

    if (!playlist) {
      res.status(404).json({ error: 'Playlist not found' });
      return;
    }

    // Get playlist items with media info
    const items = await query<PlaylistItemRow[]>(
      `SELECT pi.*, m.original_name, m.mime_type, m.file_size, m.thumbnail_key
       FROM playlist_items pi
       LEFT JOIN media m ON pi.media_id = m.id
       WHERE pi.playlist_id = ? AND pi.tenant_id = ?
       ORDER BY pi.sort_order ASC`,
      [id, tenantId]
    );

    res.json({ playlist, items });
  } catch (err) {
    console.error('Get playlist error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/v1/playlists ─────────────────────────────────────
router.post('/playlists', authenticate, requireRole('super_admin', 'admin', 'editor'), async (req: Request, res: Response) => {
  try {
    const { name, description, loop_playback } = req.body;
    const tenantId = req.user!.tenantId;

    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }

    const result = await execute(
      'INSERT INTO playlists (tenant_id, name, description, loop_playback, created_by) VALUES (?, ?, ?, ?, ?)',
      [tenantId, name, description || null, loop_playback !== false, req.user!.id]
    );

    const playlist = await queryOne<PlaylistRow>(
      'SELECT * FROM playlists WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({ playlist });
  } catch (err) {
    console.error('Create playlist error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PUT /api/v1/playlists/:id ──────────────────────────────────
router.put('/playlists/:id', authenticate, requireRole('super_admin', 'admin', 'editor'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;
    const { name, description, loop_playback } = req.body;

    const existing = await queryOne(
      'SELECT id FROM playlists WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );

    if (!existing) {
      res.status(404).json({ error: 'Playlist not found' });
      return;
    }

    await execute(
      `UPDATE playlists SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        loop_playback = COALESCE(?, loop_playback)
       WHERE id = ? AND tenant_id = ?`,
      [name, description, loop_playback, id, tenantId]
    );

    const playlist = await queryOne<PlaylistRow>(
      'SELECT * FROM playlists WHERE id = ?',
      [id]
    );

    res.json({ playlist });
  } catch (err) {
    console.error('Update playlist error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /api/v1/playlists/:id ───────────────────────────────
router.delete('/playlists/:id', authenticate, requireRole('super_admin', 'admin', 'editor'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    const existing = await queryOne(
      'SELECT id FROM playlists WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );

    if (!existing) {
      res.status(404).json({ error: 'Playlist not found' });
      return;
    }

    // Delete items first
    await execute('DELETE FROM playlist_items WHERE playlist_id = ? AND tenant_id = ?', [id, tenantId]);
    await execute('DELETE FROM playlists WHERE id = ? AND tenant_id = ?', [id, tenantId]);

    res.json({ message: 'Playlist deleted' });
  } catch (err) {
    console.error('Delete playlist error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/v1/playlists/:id/items ───────────────────────────
// Add item to playlist
router.post('/playlists/:id/items', authenticate, requireRole('super_admin', 'admin', 'editor'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;
    const { media_id, duration_seconds, transition } = req.body;

    if (!media_id) {
      res.status(400).json({ error: 'media_id is required' });
      return;
    }

    const playlist = await queryOne(
      'SELECT id FROM playlists WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
    if (!playlist) {
      res.status(404).json({ error: 'Playlist not found' });
      return;
    }

    const media = await queryOne(
      'SELECT id FROM media WHERE id = ? AND tenant_id = ?',
      [media_id, tenantId]
    );
    if (!media) {
      res.status(404).json({ error: 'Media not found' });
      return;
    }

    // Get next sort_order
    const maxOrder = await queryOne<RowDataPacket>(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM playlist_items WHERE playlist_id = ?',
      [id]
    );

    const result = await execute(
      `INSERT INTO playlist_items (tenant_id, playlist_id, media_id, sort_order, duration_seconds, transition)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [tenantId, id, media_id, (maxOrder as any).next_order, duration_seconds || null, transition || 'none']
    );

    const item = await queryOne(
      `SELECT pi.*, m.original_name, m.mime_type, m.file_size, m.thumbnail_key
       FROM playlist_items pi
       LEFT JOIN media m ON pi.media_id = m.id
       WHERE pi.id = ?`,
      [result.insertId]
    );

    res.status(201).json({ item });
  } catch (err) {
    console.error('Add playlist item error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /api/v1/playlists/:playlistId/items/:itemId ──────────
router.delete('/playlists/:playlistId/items/:itemId', authenticate, requireRole('super_admin', 'admin', 'editor'), async (req: Request, res: Response) => {
  try {
    const { playlistId, itemId } = req.params;
    const tenantId = req.user!.tenantId;

    const existing = await queryOne(
      'SELECT id FROM playlist_items WHERE id = ? AND playlist_id = ? AND tenant_id = ?',
      [itemId, playlistId, tenantId]
    );

    if (!existing) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    await execute('DELETE FROM playlist_items WHERE id = ? AND tenant_id = ?', [itemId, tenantId]);

    res.json({ message: 'Item removed' });
  } catch (err) {
    console.error('Delete playlist item error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PUT /api/v1/playlists/:id/reorder ──────────────────────────
// Reorder items: expects { item_ids: [3, 1, 2] }
router.put('/playlists/:id/reorder', authenticate, requireRole('super_admin', 'admin', 'editor'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;
    const { item_ids } = req.body;

    if (!Array.isArray(item_ids)) {
      res.status(400).json({ error: 'item_ids array is required' });
      return;
    }

    const playlist = await queryOne(
      'SELECT id FROM playlists WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
    if (!playlist) {
      res.status(404).json({ error: 'Playlist not found' });
      return;
    }

    // Update sort_order for each item
    for (let i = 0; i < item_ids.length; i++) {
      await execute(
        'UPDATE playlist_items SET sort_order = ? WHERE id = ? AND playlist_id = ? AND tenant_id = ?',
        [i, item_ids[i], id, tenantId]
      );
    }

    res.json({ message: 'Reordered' });
  } catch (err) {
    console.error('Reorder playlist items error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
