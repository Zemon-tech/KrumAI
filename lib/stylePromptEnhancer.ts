import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";

const STYLE_ENHANCER_SYSTEM_PROMPT = `You are an elite AI Image Prompt Engineer specializing in Flux.2 by Black Forest Labs.

You receive two inputs:
1. STYLE DNA — structured visual style keywords extracted from a reference image (covering identity, color, lighting, texture, composition, mood, cinematic qualities, and design psychology)
2. USER SUBJECT — what the user wants to depict

Your task: Compose a single, production-grade Flux.2 prompt that generates the user's subject FULLY IMMERSED in the extracted Style DNA.

FLUX.2 PROMPT PRINCIPLES:
- Subject-first, then style integration
- Use natural descriptive sentences — Flux.2 has deep text understanding
- Be specific: name exact lighting setups, lens characteristics, color grading approaches
- Weave mood and psychology into the scene description naturally
- Keep under 200 words — dense and intentional, no filler
- NO negative prompts (Flux.2 ignores them)
- NO meta-instructions ("generate", "create", "make")
- NO generic quality tags ("4k", "masterpiece", "best quality")
- Treat the style DNA as a creative director's brief — translate it into a vivid scene

STYLE INTEGRATION STRATEGY:
- Map COLOR DNA → specific color choices in the scene
- Map LIGHTING DNA → how light falls on the subject
- Map TEXTURE DNA → surface qualities and rendering approach
- Map COMPOSITION DNA → how the subject is framed and positioned
- Map MOOD DNA → emotional atmosphere surrounding the subject
- Map CINEMATIC DNA → camera/lens characteristics
- Map PSYCHOLOGY → why the final image will feel premium/compelling

OUTPUT: Return ONLY the final prompt text. No explanations, no labels, no markdown.`;

export async function enhanceStylePrompt(
  styleKeywords: string,
  userSubject: string
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const modelName = process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash";

  if (!apiKey || apiKey.trim() === "" || apiKey === "your_openrouter_api_key_here") {
    // Fallback: simple concatenation if no API key
    console.warn("[StyleEnhancer] No OPENROUTER_API_KEY configured, using simple concatenation.");
    return `${userSubject.trim()}, ${styleKeywords.trim()}`;
  }

  const openrouter = createOpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
  });

  try {
    const { text } = await generateText({
      model: openrouter(modelName),
      system: STYLE_ENHANCER_SYSTEM_PROMPT,
      prompt: `Style keywords: "${styleKeywords.trim()}"\nUser subject: "${userSubject.trim()}"`,
      temperature: 0.7,
    });

    const enhanced = text.trim();
    if (!enhanced) {
      return `${userSubject.trim()}, ${styleKeywords.trim()}`;
    }

    console.log(`[StyleEnhancer] Enhanced prompt: ${enhanced.substring(0, 100)}...`);
    return enhanced;
  } catch (error: any) {
    console.error("[StyleEnhancer] Error enhancing prompt:", error.message);
    // Fallback to simple concatenation
    return `${userSubject.trim()}, ${styleKeywords.trim()}`;
  }
}
