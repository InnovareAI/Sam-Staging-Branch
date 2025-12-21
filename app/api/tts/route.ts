import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
    try {
        const { text, voice = 'echo' } = await request.json();

        if (!text) {
            return NextResponse.json(
                { error: 'No text provided' },
                { status: 400 }
            );
        }

        // Generate speech using OpenAI TTS
        const mp3 = await openai.audio.speech.create({
            model: 'tts-1',
            voice: voice as 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer',
            input: text,
            speed: 1.0,
        });

        // Get the audio as a buffer
        const buffer = Buffer.from(await mp3.arrayBuffer());

        // Return audio as MP3
        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'audio/mpeg',
                'Content-Length': buffer.length.toString(),
            },
        });
    } catch (error) {
        console.error('TTS error:', error);
        return NextResponse.json(
            { error: 'Failed to generate speech', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
