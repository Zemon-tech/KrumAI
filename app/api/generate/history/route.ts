import { NextResponse } from "next/server";

/**
 * Queries ComfyUI's /history/{prompt_id} endpoint to retrieve execution results.
 * Used primarily for Branch 1 (style_extract) to get the OllamaVision text output,
 * but also works for getting output filenames from image generation branches.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const promptId = searchParams.get("prompt_id");

    if (!promptId) {
      return NextResponse.json(
        { error: "prompt_id query parameter is required" },
        { status: 400 }
      );
    }

    const comfyHttpUrl = process.env.COMFYUI_HTTP_URL || "http://127.0.0.1:8188";
    const historyUrl = `${comfyHttpUrl}/history/${promptId}`;

    console.log(`Fetching history from ComfyUI: ${historyUrl}`);

    const response = await fetch(historyUrl);

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch history from ComfyUI: ${response.statusText}` },
        { status: 500 }
      );
    }

    const history = await response.json();

    // ComfyUI returns { [prompt_id]: { outputs: { [node_id]: { ... } }, status: {...} } }
    const promptHistory = history[promptId];

    if (!promptHistory) {
      return NextResponse.json(
        { error: "Prompt not found in history. Generation may still be in progress." },
        { status: 404 }
      );
    }

    if (promptHistory.status?.status_str === "error") {
      return NextResponse.json(
        { error: "Generation failed.", details: promptHistory.status },
        { status: 500 }
      );
    }

    const outputs = promptHistory.outputs || {};

    // Extract text outputs (from ShowText|pysssss node — node "11" in style_extract)
    // The ShowText node stores its output in outputs[node_id].text
    let extractedText: string | null = null;
    for (const nodeId of Object.keys(outputs)) {
      const nodeOutput = outputs[nodeId];
      if (nodeOutput.text && Array.isArray(nodeOutput.text)) {
        extractedText = nodeOutput.text.join("\n");
        break;
      }
    }

    // Extract image outputs (from SaveImageS3 nodes)
    // SaveImageS3 returns s3_image_paths in its output
    let imageOutputs: string[] = [];
    for (const nodeId of Object.keys(outputs)) {
      const nodeOutput = outputs[nodeId];
      // SaveImageS3 returns result as s3_image_paths
      if (nodeOutput.images && Array.isArray(nodeOutput.images)) {
        for (const img of nodeOutput.images) {
          if (img.filename) {
            imageOutputs.push(img.filename);
          }
        }
      }
      // Also check for text results that look like S3 paths
      if (nodeOutput.text && Array.isArray(nodeOutput.text)) {
        for (const text of nodeOutput.text) {
          if (typeof text === "string" && (text.includes("outputs/") || text.includes("s3://"))) {
            imageOutputs.push(text);
          }
        }
      }
    }

    return NextResponse.json({
      prompt_id: promptId,
      status: promptHistory.status?.status_str || "completed",
      extractedText,
      imageOutputs,
      rawOutputs: outputs,
    });
  } catch (error: any) {
    console.error("Error fetching history:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
