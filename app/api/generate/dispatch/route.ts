import { NextResponse } from "next/server";
import { parseGraph } from "@/lib/comfyGraphParser";
import { enhancePrompt } from "@/lib/promptEnhancer";
import fs from "fs";
import path from "path";

async function uploadToComfyUI(buffer: Buffer, originalFilename: string): Promise<string> {
  const comfyHttpUrl = process.env.COMFYUI_HTTP_URL || "http://127.0.0.1:8188";
  
  // Use a standard multi-part form payload to upload the image
  const formData = new FormData();
  const fileBlob = new Blob([new Uint8Array(buffer)]);
  formData.append("image", fileBlob, originalFilename);

  const response = await fetch(`${comfyHttpUrl}/upload/image`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Failed to upload image to ComfyUI: ${response.statusText}`);
  }

  const data = await response.json();
  return data.name; // ComfyUI saved filename
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prompt, settings, inputImageFilename, selectedAssetPrompt } = body;

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    if (!settings || !settings.type) {
      return NextResponse.json(
        { error: "Invalid generator settings" },
        { status: 400 }
      );
    }

    // Handle input image ingestion if present
    let comfyImageName = inputImageFilename;
    if (inputImageFilename) {
      try {
        if (inputImageFilename.startsWith("http://") || inputImageFilename.startsWith("https://")) {
          console.log(`Downloading external input image: ${inputImageFilename}`);
          const fetchRes = await fetch(inputImageFilename);
          if (fetchRes.ok) {
            const buffer = Buffer.from(await fetchRes.arrayBuffer());
            const urlPath = new URL(inputImageFilename).pathname;
            const basename = path.basename(urlPath) || "input_image.png";
            comfyImageName = await uploadToComfyUI(buffer, basename);
          } else {
            console.warn(`Failed to fetch external input image: ${fetchRes.statusText}`);
          }
        } else if (inputImageFilename.startsWith("/")) {
          // Local public or generated folder image
          const localPath = path.join(process.cwd(), "public", inputImageFilename);
          console.log(`Loading local input image: ${localPath}`);
          if (fs.existsSync(localPath)) {
            const buffer = fs.readFileSync(localPath);
            comfyImageName = await uploadToComfyUI(buffer, path.basename(localPath));
          } else {
            console.warn(`Local input image path does not exist: ${localPath}`);
          }
        }
      } catch (ingestError: any) {
        console.error("Error ingesting input image to ComfyUI:", ingestError);
        // Continue anyway or return error
      }
    }

    let finalPrompt = prompt;
    let updatedSettings = { ...settings };

    if (settings.useEnhancer !== false) {
      // Call OpenRouter to enhance the prompt and settings
      const enhancement = await enhancePrompt(prompt, settings, selectedAssetPrompt);
      finalPrompt = enhancement.enhancedPrompt;
      updatedSettings = {
        ...settings,
        steps: enhancement.steps,
        guidance: enhancement.guidance,
        width: enhancement.width,
        height: enhancement.height,
        // Video-specific fields (only present for t2v / i2v)
        ...(enhancement.duration !== undefined && { duration: enhancement.duration }),
        ...(enhancement.fps !== undefined && { fps: enhancement.fps }),
      };
    }

    // Clean up settings for image generation models (t2i, i2i) to avoid sending video-specific parameters
    if (updatedSettings.type === "t2i" || updatedSettings.type === "i2i") {
      delete updatedSettings.duration;
      delete updatedSettings.fps;
    }

    // Dynamic graph parsing based on settings
    let graph: Record<string, any>;
    try {
      graph = parseGraph(finalPrompt, updatedSettings, comfyImageName);
    } catch (err: any) {
      return NextResponse.json(
        { error: err.message || "Failed to parse workflow graph" },
        { status: 400 }
      );
    }

    const comfyHttpUrl = process.env.COMFYUI_HTTP_URL || "http://127.0.0.1:8188";
    const clientId = crypto.randomUUID();

    console.log(`Dispatching prompt to ComfyUI at ${comfyHttpUrl}/prompt with client ID: ${clientId}`);

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
      return NextResponse.json(
        { error: `ComfyUI Server Error: ${errorText}` },
        { status: 500 }
      );
    }

    const data = await response.json();
    const wsUrl = comfyHttpUrl.replace(/^http/, "ws") + "/ws";

    return NextResponse.json({
      prompt_id: data.prompt_id,
      client_id: clientId,
      ws_url: wsUrl,
      enhanced_prompt: settings.useEnhancer !== false ? finalPrompt : undefined,
      settings: updatedSettings,
    });
  } catch (error: any) {
    console.error("Error in dispatch api:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
