import { NextResponse } from "next/server";
import { enhanceStylePrompt } from "@/lib/stylePromptEnhancer";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { styleKeywords, userSubject } = body;

    if (!userSubject || !userSubject.trim()) {
      return NextResponse.json(
        { error: "userSubject is required" },
        { status: 400 }
      );
    }

    if (!styleKeywords || !styleKeywords.trim()) {
      return NextResponse.json(
        { error: "styleKeywords is required. Run Branch 1 (Extract Style) first." },
        { status: 400 }
      );
    }

    const enhancedPrompt = await enhanceStylePrompt(styleKeywords, userSubject);

    return NextResponse.json({
      enhancedPrompt,
      original: {
        styleKeywords,
        userSubject,
      },
    });
  } catch (error: any) {
    console.error("Error in style-enhance api:", error);
    return NextResponse.json(
      { error: error.message || "Failed to enhance prompt" },
      { status: 500 }
    );
  }
}
