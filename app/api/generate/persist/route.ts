import { NextResponse } from "next/server";
import { getPublicOutputUrl } from "@/lib/s3Client";
import fs from "fs";
import path from "path";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { filename, subfolder, type, source } = body;

    if (!filename) {
      return NextResponse.json(
        { error: "Filename is required" },
        { status: 400 }
      );
    }

    // If source is "s3", the file is already in S3 — just return the public URL
    if (source === "s3") {
      // Construct the public S3 URL for the output
      // SaveImageS3 stores files in the S3_OUTPUT_DIR prefix
      const s3Key = `outputs/${filename}`;
      const publicUrl = getPublicOutputUrl(s3Key);
      console.log(`Asset already in S3, returning public URL: ${publicUrl}`);
      return NextResponse.json({
        url: publicUrl,
        source: "s3",
        success: true,
      });
    }

    // Default: fetch from ComfyUI's local view endpoint and save locally (legacy behavior)

    const comfyHttpUrl = process.env.COMFYUI_HTTP_URL || "http://127.0.0.1:8188";
    
    // Construct the URL to query ComfyUI's view endpoint
    const urlParams = new URLSearchParams({
      filename,
      subfolder: subfolder || "",
      type: type || "output",
    });
    
    const comfyViewUrl = `${comfyHttpUrl}/view?${urlParams.toString()}`;
    console.log(`Fetching generated asset from ComfyUI view endpoint: ${comfyViewUrl}`);

    const fileResponse = await fetch(comfyViewUrl);
    if (!fileResponse.ok) {
      return NextResponse.json(
        { error: `Failed to fetch asset from ComfyUI: ${fileResponse.statusText}` },
        { status: 500 }
      );
    }

    const arrayBuffer = await fileResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Save locally to public/generated directory
    const publicDir = path.join(process.cwd(), "public");
    const generatedDir = path.join(publicDir, "generated");

    // Ensure directories exist
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir);
    }
    if (!fs.existsSync(generatedDir)) {
      fs.mkdirSync(generatedDir);
    }

    // Write file to public/generated
    const destinationPath = path.join(generatedDir, filename);
    fs.writeFileSync(destinationPath, buffer);

    console.log(`Successfully persisted asset locally to: ${destinationPath}`);

    // Return the relative URL served by Next.js
    const relativeUrl = `/generated/${filename}`;

    return NextResponse.json({
      url: relativeUrl,
      success: true
    });
  } catch (error: any) {
    console.error("Error in persist api:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
