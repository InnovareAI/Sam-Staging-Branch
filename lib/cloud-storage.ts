/**
 * Cloud Storage utility for file uploads
 * Replaces Supabase Storage with Google Cloud Storage
 */

import { getStorageBucket } from '@/lib/firebase-admin';

const BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'sam-documents-storage';

export interface UploadResult {
    success: boolean;
    path?: string;
    publicUrl?: string;
    error?: string;
}

/**
 * Upload a file to Cloud Storage
 */
export async function uploadFile(
    buffer: Buffer,
    fileName: string,
    contentType: string,
    folder: string = 'documents'
): Promise<UploadResult> {
    try {
        const bucket = getStorageBucket();
        const filePath = `${folder}/${Date.now()}-${fileName}`;
        const file = bucket.file(filePath);

        await file.save(buffer, {
            metadata: {
                contentType,
            },
        });

        // Make the file publicly accessible (optional)
        // await file.makePublic();

        // Generate a signed URL for access (valid for 7 days)
        const [signedUrl] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        return {
            success: true,
            path: filePath,
            publicUrl: signedUrl,
        };
    } catch (error) {
        console.error('Cloud Storage upload error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Upload failed',
        };
    }
}

/**
 * Download a file from Cloud Storage
 */
export async function downloadFile(filePath: string): Promise<Buffer | null> {
    try {
        const bucket = getStorageBucket();
        const file = bucket.file(filePath);
        const [contents] = await file.download();
        return contents;
    } catch (error) {
        console.error('Cloud Storage download error:', error);
        return null;
    }
}

/**
 * Delete a file from Cloud Storage
 */
export async function deleteFile(filePath: string): Promise<boolean> {
    try {
        const bucket = getStorageBucket();
        const file = bucket.file(filePath);
        await file.delete();
        return true;
    } catch (error) {
        console.error('Cloud Storage delete error:', error);
        return false;
    }
}

/**
 * Get a signed URL for a file
 */
export async function getSignedUrl(filePath: string, expiresInMs: number = 3600000): Promise<string | null> {
    try {
        const bucket = getStorageBucket();
        const file = bucket.file(filePath);
        const [signedUrl] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + expiresInMs,
        });
        return signedUrl;
    } catch (error) {
        console.error('Cloud Storage signed URL error:', error);
        return null;
    }
}
