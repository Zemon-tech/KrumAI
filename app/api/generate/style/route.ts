import { NextResponse } from "next/server";
import { parseStyleGraph, StyleReverseSettings } from "@/lib/comfyGraphParser";
import { getFilenameFromKey } from "@/lib/s3Client";
import { checkRateLimit, incrementRateLimit } from "@/lib/rateLimit";

export async function POST(request: Request) {
  try {
    // Rate limiting check
    const rateLimitResult = checkRateLimit();
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: `Daily generation limit reached (${rateLimitResult.limit}). Try again tomorrow.` },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { type, styleImageKey, contentImageKey, prompt, width, height, turboMode, steps, guidance } = body;

    // Validate required fields
    if (!type || !["style_extract", "style_generate", "style_transfer"].includes(type)) {
      return NextResponse.json(
        { error: "Invalid type. Must be style_extract, style_generate, or style_transfer." },
        { status: 400 }
      );
    }

    if (!styleImageKey && type !== "style_generate") {
      return NextResponse.json(
        { error: "styleImageKey is required for style_extract and style_transfer." },
        { status: 400 }
      );
    }

    if (type === "style_transfer" && !contentImageKey) {
      return NextResponse.json(
        { error: "contentImageKey is required for style_transfer." },
        { status: 400 }
      );
    }

    if (type === "style_generate" && !prompt) {
      return NextResponse.json(
        { error: "prompt is required for style_generate." },
        { status: 400 }
      );
    }

    // Build settings for the graph parser
    // ComfyS3 LoadImageS3 expects just the filename relative to S3_INPUT_DIR
    const settings: StyleReverseSettings = {
      type,
      styleImageKey: styleImageKey ? getFilenameFromKey(styleImageKey) : "",
      contentImageKey: contentImageKey ? getFilenameFromKey(contentImageKey) : undefined,
      prompt,
      width: width || 1024,
      height: height || 1024,
      turboMode: turboMode !== undefined ? turboMode : true,
      steps,
      guidance,
    };

    // Parse the workflow graph
    let graph: Record<string, any>;
    try {
      graph = parseStyleGraph(settings);
    } catch (err: any) {
      return NextResponse.json(
        { error: err.message || "Failed to parse style workflow graph" },
        { status: 400 }
      );
    }

    // Dispatch to ComfyUI
    const comfyHttpUrl = process.env.COMFYUI_HTTP_URL || "http://127.0.0.1:8188";
    const clientId = crypto.randomUUID();

    console.log(`[Style ${type}] Dispatching to ComfyUI at ${comfyHttpUrl}/prompt with client ID: ${clientId}`);

    const response = await fetch(`${comfyHttpUrl}/prompt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        prompt: graph,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Style ${type}] ComfyUI error:`, errorText);
      return NextResponse.json(
        { error: `ComfyUI Server Error: ${errorText}` },
        { status: 500 }
      );
    }

    const data = await response.json();
    const wsUrl = comfyHttpUrl.replace(/^http/, "ws") + "/ws";

    // Increment rate limit counter on successful dispatch
    incrementRateLimit();

    return NextResponse.json({
      prompt_id: data.prompt_id,
      client_id: clientId,
      ws_url: wsUrl,
      type,
    });
  } catch (error: any) {
    console.error("Error in style dispatch api:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
