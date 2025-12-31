import { NextResponse } from 'next/server';
import { verifyAuth, pool } from '@/lib/auth';
import { supabaseAdmin } from '@/app/lib/supabase';

export async function POST(request: Request) {
    try {
        const auth = await verifyAuth(request);

        if (!auth.isAuthenticated || !auth.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = auth.user;
        const supabase = supabaseAdmin();

        const formData = await request.formData();
        const file = formData.get('file') as File;
        const threadId = formData.get('threadId') as string;
        const workspaceId = formData.get('workspaceId') as string;

        if (!file || !threadId) {
            return NextResponse.json({ error: 'Missing file or threadId' }, { status: 400 });
        }

        // 1. Sanitize file name for storage path
        const timestamp = Date.now();
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const storagePath = `${user.uid}/${threadId}/${timestamp}_${sanitizedName}`;

        // 2. Upload to Supabase Storage
        const { data: storageData, error: storageError } = await supabase.storage
            .from('sam-attachments')
            .upload(storagePath, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (storageError) {
            console.error('❌ Storage upload error:', storageError);
            return NextResponse.json({
                success: false,
                error: 'Failed to upload to storage',
                details: storageError.message
            }, { status: 500 });
        }

        // 3. Create record in database
        try {
            const query = `
                INSERT INTO sam_conversation_attachments
                (thread_id, user_id, workspace_id, file_name, file_type, file_size, mime_type, storage_path, storage_bucket, processing_status)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING *
            `;
            const values = [
                threadId,
                user.uid,
                workspaceId || null,
                file.name,
                file.type,
                file.size,
                file.type,
                storagePath,
                'sam-attachments',
                'pending'
            ];

            const dbRes = await pool.query(query, values);
            const attachment = dbRes.rows[0];

            return NextResponse.json({
                success: true,
                attachment
            });

        } catch (dbError) {
            console.error('❌ Database insert error:', dbError);
            // Cleanup storage if DB record fails
            await supabase.storage.from('sam-attachments').remove([storagePath]);
            return NextResponse.json({
                success: false,
                error: 'Failed to record attachment',
                details: dbError instanceof Error ? dbError.message : String(dbError)
            }, { status: 500 });
        }

    } catch (error) {
        console.error('❌ Attachment route error:', error);
        return NextResponse.json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
