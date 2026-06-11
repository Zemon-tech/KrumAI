import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const generatedDir = path.join(process.cwd(), "public", "generated");
    
    if (!fs.existsSync(generatedDir)) {
      return NextResponse.json([]);
    }

    const files = fs.readdirSync(generatedDir);
    const assets = files.map((filename) => {
      const filePath = path.join(generatedDir, filename);
      const stat = fs.statSync(filePath);
      
      const ext = path.extname(filename).toLowerCase();
      let type: "image" | "video" | "audio" = "image";
      
      if ([".mp4", ".mov", ".avi", ".webm"].includes(ext)) {
        type = "video";
      } else if ([".mp3", ".wav", ".ogg", ".aac"].includes(ext)) {
        type = "audio";
      }

      return {
        id: `gen-fs-${stat.ino || filename}`,
        name: filename,
        type,
        url: `/generated/${filename}`,
        createdAt: stat.birthtime || stat.mtime || new Date(),
        model: type === "video" ? "LTX Video" : ext.includes("png") ? "Flux Dev" : "Qwen Edit",
        prompt: "Generated creative asset"
      };
    });

    // Sort by creation time descending (newest first)
    assets.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return NextResponse.json(assets);
  } catch (error: any) {
    console.error("Error fetching generated assets list:", error);
    return NextResponse.json([]);
  }
}
