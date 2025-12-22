import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
    try {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: 'OpenAI API key not configured' },
                { status: 500 }
            );
        }

        const openai = new OpenAI({ apiKey });
        const formData = await request.formData();
        const audioFile = formData.get('audio') as File;

        if (!audioFile) {
            console.error('[Transcribe API] No audio file received in formData');
            return NextResponse.json(
                { error: 'No audio file provided' },
                { status: 400 }
            );
        }

        console.log(`[Transcribe API] Received file: ${audioFile.name}, size: ${audioFile.size}, type: ${audioFile.type}`);

        // Convert to the format Whisper expects
        const transcription = await openai.audio.transcriptions.create({
            file: audioFile,
            model: 'whisper-1',
            language: 'en', // Can be made dynamic
            response_format: 'text',
        });

        console.log(`[Transcribe API] Success. Length: ${transcription.length}`);

        return NextResponse.json({
            text: transcription,
            success: true
        });
    } catch (error: any) {
        console.error('[Transcribe API] Critical Error:', error);
        if (error?.response) {
            console.error('[Transcribe API] OpenAI Response:', error.response.data);
        }
        return NextResponse.json(
            { error: 'Failed to transcribe audio', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
