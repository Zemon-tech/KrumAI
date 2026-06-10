// s:\1-Project\zemon\content-pipeline\frontend\app\api\generate\dispatch\route.ts
import { NextResponse } from 'next/server';
import { ComfyGraph, parseComfyGraph } from '@/lib/comfyGraphParser';

// Dynamic imports of the templates
import qwenImageTemplate from '@/lib/comfy-templates/qwen_image_workflow.json';
import ltxTemplate from '@/lib/comfy-templates/ltx.json';

const TEMPLATES: Record<string, ComfyGraph> = {
  image: qwenImageTemplate as unknown as ComfyGraph,
  video: ltxTemplate as unknown as ComfyGraph,
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { prompt, negativePrompt, type, model, aspect, duration, frameRate, quality } = body;

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const genType = type || 'image';
    const template = TEMPLATES[genType];
    if (!template) {
      return NextResponse.json({ error: `Invalid generation type: ${genType}` }, { status: 400 });
    }

    // Determine dimensions based on aspect ratio preset
    let width = 1024;
    let height = 1024;
    if (aspect === '16:9') {
      width = 1216;
      height = 684;
    } else if (aspect === '9:16') {
      width = 684;
      height = 1216;
    } else if (aspect === '4:3') {
      width = 1152;
      height = 864;
    }

    // Parse and update template nodes dynamically
    const parsedPrompt = parseComfyGraph(template, {
      prompt,
      negativePrompt,
      modelName: model,
      width,
      height,
      duration: duration ? Number(duration) : undefined,
      frameRate: frameRate ? Number(frameRate) : undefined,
      qualityPreset: quality,
    });

    const clientId = body.clientId || crypto.randomUUID();
    const comfyHttpUrl = process.env.COMFYUI_HTTP_URL || 'http://127.0.0.1:8188';

    // Dispatch to ComfyUI API endpoint /prompt
    try {
      const response = await fetch(`${comfyHttpUrl}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          prompt: parsedPrompt,
        }),
      });

      if (!response.ok) {
        throw new Error(`ComfyUI response status: ${response.status}`);
      }

      const data = await response.json();
      return NextResponse.json({
        prompt_id: data.prompt_id,
        client_id: clientId,
        mock: false,
      });
    } catch (apiError) {
      console.warn('ComfyUI server unavailable. Falling back to development mock mode:', apiError);
      
      // Fallback mock dispatch for sandboxed / offline development
      const mockPromptId = `mock-${crypto.randomUUID()}`;
      return NextResponse.json({
        prompt_id: mockPromptId,
        client_id: clientId,
        mock: true,
        message: 'Running in development mock mode (ComfyUI server unreachable)',
      });
    }
  } catch (error) {
    console.error('Error dispatching ComfyUI generation:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
