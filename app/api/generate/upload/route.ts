import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("image") as File;

    if (!file) {
      return NextResponse.json(
        { error: "Image file is required" },
        { status: 400 }
      );
    }

    const comfyHttpUrl = process.env.COMFYUI_HTTP_URL || "http://127.0.0.1:8188";
    
    // Prepare form data to send to ComfyUI
    const comfyFormData = new FormData();
    comfyFormData.append("image", file, file.name);

    console.log(`Forwarding uploaded image to ComfyUI upload endpoint at ${comfyHttpUrl}/upload/image`);
    
    const response = await fetch(`${comfyHttpUrl}/upload/image`, {
      method: "POST",
      body: comfyFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `ComfyUI Upload Error: ${errorText}` },
        { status: 500 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error in upload api:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
