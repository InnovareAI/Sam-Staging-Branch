import { NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';

export async function POST(request: Request) {
    try {
        const supabase = await createSupabaseRouteClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

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
        const storagePath = `${user.id}/${threadId}/${timestamp}_${sanitizedName}`;

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
        const { data: attachment, error: dbError } = await supabase
            .from('sam_conversation_attachments')
            .insert({
                thread_id: threadId,
                user_id: user.id,
                workspace_id: workspaceId || null,
                file_name: file.name,
                file_type: file.type,
                file_size: file.size,
                mime_type: file.type,
                storage_path: storagePath,
                storage_bucket: 'sam-attachments',
                processing_status: 'pending'
            })
            .select()
            .single();

        if (dbError) {
            console.error('❌ Database insert error:', dbError);
            // Cleanup storage if DB record fails
            await supabase.storage.from('sam-attachments').remove([storagePath]);
            return NextResponse.json({
                success: false,
                error: 'Failed to record attachment',
                details: dbError.message
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            attachment
        });

    } catch (error) {
        console.error('❌ Attachment route error:', error);
        return NextResponse.json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
