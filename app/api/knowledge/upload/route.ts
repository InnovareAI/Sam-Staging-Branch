import { NextRequest, NextResponse } from 'next/server';
import { supabaseKnowledge } from '@/lib/supabase-knowledge';

async function extractText(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());

  if (file.type === 'application/pdf') {
    const pdfParse = (await import('pdf-parse')).default;
    const pdfData = await pdfParse(buffer);
    return pdfData.text;
  }

  return new TextDecoder().decode(buffer);
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const workspaceId = formData.get('workspace_id') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID is required' },
        { status: 400 }
      );
    }

    // Read file content
    const text = await extractText(file);
    
    // Create knowledge base entry
    const title = file.name.replace(/\.[^/.]+$/, ''); // Remove file extension
    const category = 'uploaded'; // Default category for uploads
    const tags = ['document', 'uploaded'];
    
    const result = await supabaseKnowledge.addKnowledgeItem({
      workspace_id: workspaceId,
      title,
      category,
      content: text,
      tags,
      version: '1.0',
      is_active: true
    });

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Knowledge upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload document' }, 
      { status: 500 }
    );
  }
}
