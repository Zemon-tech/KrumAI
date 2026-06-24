import { NextResponse } from "next/server";
import { generatePresignedUploadUrl, generateInputKey } from "@/lib/s3Client";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { filename, contentType } = body;

    if (!filename) {
      return NextResponse.json(
        { error: "Filename is required" },
        { status: 400 }
      );
    }

    if (!contentType || !contentType.startsWith("image/")) {
      return NextResponse.json(
        { error: "A valid image content type is required (e.g., image/png)" },
        { status: 400 }
      );
    }

    // Generate a unique S3 key for this upload
    const s3Key = generateInputKey(filename);

    // Generate presigned URL (expires in 5 minutes)
    const uploadUrl = await generatePresignedUploadUrl(s3Key, contentType);

    return NextResponse.json({
      uploadUrl,
      s3Key,
    });
  } catch (error: any) {
    console.error("Error generating presigned URL:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate presigned URL" },
      { status: 500 }
    );
  }
}
