import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';
import { getStorageBucket } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
    try {
        const { userId, workspaceId: authWorkspaceId } = await verifyAuth(request);

        const formData = await request.formData();
        const file = formData.get('file') as File;
        const threadId = formData.get('threadId') as string;
        const workspaceId = formData.get('workspaceId') as string || authWorkspaceId;

        if (!file || !threadId) {
            return NextResponse.json({ error: 'Missing file or threadId' }, { status: 400 });
        }

        // 1. Sanitize file name for storage path
        const timestamp = Date.now();
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const storagePath = `sam-attachments/${userId}/${threadId}/${timestamp}_${sanitizedName}`;

        // 2. Upload to Firebase Storage
        const bucket = getStorageBucket();
        const fileBuffer = Buffer.from(await file.arrayBuffer());

        const fileRef = bucket.file(storagePath);
        await fileRef.save(fileBuffer, {
            metadata: {
                contentType: file.type,
                cacheControl: 'public, max-age=3600',
            },
        });

        // 3. Get the public URL (or signed URL if bucket is private)
        // For public bucket:
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

        // 4. Create record in database
        try {
            const query = `
                INSERT INTO sam_conversation_attachments
                (thread_id, user_id, workspace_id, file_name, file_type, file_size, mime_type, storage_path, storage_bucket, processing_status)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING *
            `;
            const values = [
                threadId,
                userId,
                workspaceId || null,
                file.name,
                file.type,
                file.size,
                file.type,
                storagePath,
                'firebase-storage',
                'pending'
            ];

            const dbRes = await pool.query(query, values);
            const attachment = dbRes.rows[0];

            return NextResponse.json({
                success: true,
                attachment: {
                    ...attachment,
                    url: publicUrl
                }
            });

        } catch (dbError) {
            console.error('❌ Database insert error:', dbError);
            // Cleanup storage if DB record fails
            try {
                await fileRef.delete();
            } catch (deleteError) {
                console.error('Failed to cleanup file after DB error:', deleteError);
            }
            return NextResponse.json({
                success: false,
                error: 'Failed to record attachment',
                details: dbError instanceof Error ? dbError.message : String(dbError)
            }, { status: 500 });
        }

    } catch (error) {
        if ((error as AuthError).code) {
            const authError = error as AuthError;
            return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
        }
        console.error('❌ Attachment route error:', error);
        return NextResponse.json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}

// GET endpoint to retrieve attachment with signed URL
export async function GET(request: NextRequest) {
    try {
        const { userId } = await verifyAuth(request);

        const { searchParams } = new URL(request.url);
        const attachmentId = searchParams.get('id');

        if (!attachmentId) {
            return NextResponse.json({ error: 'Missing attachment ID' }, { status: 400 });
        }

        // Get attachment from database
        const { rows } = await pool.query(
            `SELECT * FROM sam_conversation_attachments
             WHERE id = $1 AND user_id = $2`,
            [attachmentId, userId]
        );

        if (rows.length === 0) {
            return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
        }

        const attachment = rows[0];

        // Generate signed URL for private access (valid for 1 hour)
        const bucket = getStorageBucket();
        const fileRef = bucket.file(attachment.storage_path);

        const [signedUrl] = await fileRef.getSignedUrl({
            action: 'read',
            expires: Date.now() + 60 * 60 * 1000, // 1 hour
        });

        return NextResponse.json({
            success: true,
            attachment: {
                ...attachment,
                url: signedUrl
            }
        });

    } catch (error) {
        if ((error as AuthError).code) {
            const authError = error as AuthError;
            return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
        }
        console.error('❌ Get attachment error:', error);
        return NextResponse.json({
            success: false,
            error: 'Internal server error'
        }, { status: 500 });
    }
}

// DELETE endpoint to remove attachment
export async function DELETE(request: NextRequest) {
    try {
        const { userId } = await verifyAuth(request);

        const { searchParams } = new URL(request.url);
        const attachmentId = searchParams.get('id');

        if (!attachmentId) {
            return NextResponse.json({ error: 'Missing attachment ID' }, { status: 400 });
        }

        // Get attachment from database (verify ownership)
        const { rows } = await pool.query(
            `SELECT * FROM sam_conversation_attachments
             WHERE id = $1 AND user_id = $2`,
            [attachmentId, userId]
        );

        if (rows.length === 0) {
            return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
        }

        const attachment = rows[0];

        // Delete from Firebase Storage
        const bucket = getStorageBucket();
        const fileRef = bucket.file(attachment.storage_path);

        try {
            await fileRef.delete();
        } catch (storageError) {
            console.warn('File may already be deleted:', storageError);
        }

        // Delete from database
        await pool.query(
            'DELETE FROM sam_conversation_attachments WHERE id = $1',
            [attachmentId]
        );

        return NextResponse.json({
            success: true,
            message: 'Attachment deleted'
        });

    } catch (error) {
        if ((error as AuthError).code) {
            const authError = error as AuthError;
            return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
        }
        console.error('❌ Delete attachment error:', error);
        return NextResponse.json({
            success: false,
            error: 'Internal server error'
        }, { status: 500 });
    }
}
