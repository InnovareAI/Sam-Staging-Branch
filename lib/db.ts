/**
 * PostgreSQL connection pool
 * Supports both Cloud SQL (via Unix socket) and direct connection (via DATABASE_URL)
 * This file only exports the database pool - no Next.js dependencies
 */

import { Pool, PoolConfig } from 'pg';

// Determine connection configuration
function getPoolConfig(): PoolConfig {
    // Priority 1: DATABASE_URL (works everywhere - local dev, Netlify, Cloud Run)
    const databaseUrl = process.env.DATABASE_URL;
    if (databaseUrl) {
        return {
            connectionString: databaseUrl,
            ssl: { rejectUnauthorized: false }
        };
    }

    // Priority 2: Cloud SQL via Unix socket (Cloud Run production)
    const instanceConnectionName = process.env.CLOUD_SQL_CONNECTION_NAME;
    const dbUser = process.env.DB_USER || 'postgres';
    const dbPassword = process.env.DB_PASSWORD;
    const dbName = process.env.DB_NAME || 'sam_prod';

    if (instanceConnectionName && dbPassword) {
        return {
            user: dbUser,
            password: dbPassword,
            database: dbName,
            host: `/cloudsql/${instanceConnectionName}`,
        };
    }

    // Priority 3: Cloud SQL via public IP
    const dbHost = process.env.DB_HOST;
    if (dbHost && dbPassword) {
        return {
            user: dbUser,
            password: dbPassword,
            database: dbName,
            host: dbHost,
            port: 5432,
            ssl: { rejectUnauthorized: false }
        };
    }

    // Build time fallback - return empty config
    // This allows build to succeed even without database
    console.warn('⚠️ No database configuration found - using dummy pool');
    return {
        connectionString: 'postgresql://localhost:5432/dev',
    };
}

// Initialize PostgreSQL connection pool
export const pool = new Pool(getPoolConfig());

// Helper for running queries with automatic typing
export async function query<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }> {
    const result = await pool.query(text, params);
    return { rows: result.rows, rowCount: result.rowCount ?? 0 };
}

// Connection test
export async function testConnection(): Promise<boolean> {
    try {
        const result = await pool.query('SELECT NOW()');
        console.log('✅ Database connected:', result.rows[0].now);
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error);
        return false;
    }
}
