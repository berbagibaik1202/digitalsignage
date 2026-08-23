import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { db } from '../database/mysql';

/** Standard paginated response shape */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Run a query and return typed rows */
export async function query<T extends RowDataPacket[] = RowDataPacket[]>(
  sql: string,
  params?: any[]
): Promise<T> {
  const [rows] = await db.execute(sql, params || []);
  return rows as T;
}

/** Run an INSERT/UPDATE/DELETE and return the result header */
export async function execute(
  sql: string,
  params?: any[]
): Promise<ResultSetHeader> {
  const [result] = await db.execute(sql, params || []);
  return result as ResultSetHeader;
}

/** Fetch a single row or null */
export async function queryOne<T extends RowDataPacket = RowDataPacket>(
  sql: string,
  params?: any[]
): Promise<T | null> {
  const rows = await query<T[]>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/** Tenant-scoped paginated list */
export async function paginatedQuery<T extends RowDataPacket = RowDataPacket>(
  baseSql: string,
  countSql: string,
  params: any[],
  page: number = 1,
  limit: number = 20
): Promise<PaginatedResult<T>> {
  const offset = (Math.max(1, page) - 1) * limit;

  const [countResult] = await db.execute(countSql, params);
  const total = (countResult as any)[0]?.total ?? 0;

  const data = await query<T[]>(
    `${baseSql} LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
