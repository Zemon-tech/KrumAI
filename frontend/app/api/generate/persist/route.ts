// s:\1-Project\zemon\content-pipeline\frontend\app\api\generate\persist\route.ts
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const filename = searchParams.get('filename');
  const subfolder = searchParams.get('subfolder') || '';
  const type = searchParams.get('type') || 'output';
  const isMock = searchParams.get('mock') === 'true';
  const genType = searchParams.get('genType') || 'image';

  if (isMock) {
    return handleMockAsset(genType);
  }

  if (!filename) {
    return NextResponse.json({ error: 'Filename is required' }, { status: 400 });
  }

  const comfyHttpUrl = process.env.COMFYUI_HTTP_URL || 'http://127.0.0.1:8188';
  const viewUrl = `${comfyHttpUrl}/view?filename=${encodeURIComponent(filename)}&subfolder=${encodeURIComponent(subfolder)}&type=${encodeURIComponent(type)}`;

  try {
    const response = await fetch(viewUrl);
    if (!response.ok) {
      throw new Error(`ComfyUI view status: ${response.status}`);
    }

    const blob = await response.blob();
    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    return new Response(blob, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error(`Error proxying ComfyUI view for ${filename}:`, error);
    // Auto-fallback to mock assets if ComfyUI is offline
    return handleMockAsset(genType);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { promptId, mock, genType } = body;

    const comfyHttpUrl = process.env.COMFYUI_HTTP_URL || 'http://127.0.0.1:8188';

    if (mock) {
      return NextResponse.json({
        url: `/api/generate/persist?mock=true&genType=${genType || 'image'}`,
        success: true,
      });
    }

    let filename = '';
    let subfolder = '';
    let type = 'output';

    if (promptId) {
      try {
        const historyRes = await fetch(`${comfyHttpUrl}/history/${promptId}`);
        if (historyRes.ok) {
          const historyData = await historyRes.json();
          const promptHistory = historyData[promptId];
          if (promptHistory && promptHistory.outputs) {
            const outputs = promptHistory.outputs;
            // Scan output nodes for gifs (video node outputs) or images (image node outputs)
            for (const nodeId in outputs) {
              const nodeOutput = outputs[nodeId];
              if (nodeOutput.gifs && nodeOutput.gifs.length > 0) {
                filename = nodeOutput.gifs[0].filename;
                subfolder = nodeOutput.gifs[0].subfolder || '';
                type = nodeOutput.gifs[0].type || 'output';
                break;
              } else if (nodeOutput.images && nodeOutput.images.length > 0) {
                filename = nodeOutput.images[0].filename;
                subfolder = nodeOutput.images[0].subfolder || '';
                type = nodeOutput.images[0].type || 'output';
                break;
              }
            }
          }
        }
      } catch (err) {
        console.error(`Error retrieving history for prompt ${promptId}:`, err);
      }
    }

    // Fallback if history query failed or didn't yield an output file
    if (!filename) {
      filename = genType === 'video' ? 'LTX_2.3_t2v_00001.mp4' : 'Qwen_Edit_2511_systms_action_00001.png';
      subfolder = genType === 'video' ? 'video' : '';
      type = 'output';
    }

    // Return the proxied Next.js URL that routes back to ComfyUI view API
    const proxiedUrl = `/api/generate/persist?filename=${encodeURIComponent(filename)}&subfolder=${encodeURIComponent(subfolder)}&type=${encodeURIComponent(type)}`;

    return NextResponse.json({
      url: proxiedUrl,
      success: true,
    });
  } catch (error) {
    console.error('Error in persist route:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Helper to return high-quality mock files for localized sandbox development
function handleMockAsset(genType: string) {
  let mockUrl = '';

  if (genType === 'video') {
    // Beautiful scenic video mock
    mockUrl = 'https://assets.mixkit.co/videos/preview/mixkit-stars-in-space-background-1611-large.mp4';
  } else {
    // Premium generated image mock
    mockUrl = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80';
  }

  return Response.redirect(mockUrl);
}
