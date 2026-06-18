import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

export interface GenSettings {
  type: string;
  model: string;
  steps: number;
  guidance: number;
  width: number;
  height: number;
  duration?: number;
  fps?: number;
  llmProvider?: "openrouter" | "llamacpp";
}

export interface EnhancementResult {
  enhancedPrompt: string;
  steps: number;
  guidance: number;
  width: number;
  height: number;
  duration?: number;
  fps?: number;
}
import { t2iEnhancer, t2vEnhancer, i2vEnhancer, i2iEnhancer } from "./prompts";

const SYSTEM_PROMPTS: Record<string, string> = {
  t2i: t2iEnhancer,
  t2v: t2vEnhancer,
  i2v: i2vEnhancer,
  i2i: i2iEnhancer,
};

export async function enhancePrompt(
  prompt: string,
  settings: GenSettings,
  selectedAssetPrompt?: string
): Promise<EnhancementResult> {
  const llmProvider = settings.llmProvider || "llamacpp";
  const apiKey = process.env.OPENROUTER_API_KEY;
  const modelName = process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash";

  // Check if OpenRouter is chosen but bypass is needed because of missing credentials
  if (llmProvider === "openrouter" && (!apiKey || apiKey === "your_openrouter_api_key_here" || apiKey.trim() === "")) {
    console.warn("OPENROUTER_API_KEY is not configured or is a placeholder. Bypassing prompt enhancement.");
    return {
      enhancedPrompt: prompt,
      steps: settings.steps,
      guidance: settings.guidance,
      width: settings.width,
      height: settings.height,
      duration: settings.duration,
      fps: settings.fps,
    };
  }

  try {
    let clientProvider;
    let targetModel;

    const systemPrompt = SYSTEM_PROMPTS[settings.type] || SYSTEM_PROMPTS.t2i;

    let userInstructions = `User Raw Prompt: "${prompt}"
Generation Type: "${settings.type}"
Current Settings:
- Steps: ${settings.steps}
- Guidance Scale: ${settings.guidance}
- Width: ${settings.width}
- Height: ${settings.height}
- Model: ${settings.model}${settings.duration !== undefined ? `\n- Duration (seconds): ${settings.duration}` : ""}${settings.fps !== undefined ? `\n- FPS: ${settings.fps}` : ""}`;

    if (selectedAssetPrompt) {
      userInstructions += `\n\n---
Selected Asset Original Prompt (the asset previously generated and currently selected): "${selectedAssetPrompt}"
Important context: The user is modifying or animating the selected asset. You MUST build your enhanced prompt in a series of what was already generated.
- If editing (i2i), refer to this original prompt and describe only the modifications relative to it, requesting to keep all other elements unchanged.
- If animating (i2v), use this original prompt as the initial framing/scene visual layout, and focus your motion description on camera movement and subject movement starting from that visual state.`;
    }

    if (llmProvider === "llamacpp") {
      const baseURL = process.env.LLAMACPP_API_URL || "http://127.0.0.1:8080/v1";
      targetModel = process.env.LLAMACPP_MODEL_NAME || "local-model";
      
      console.log(`Sending prompt to local Llama.cpp server at ${baseURL} using model ${targetModel} for enhancement...`);
      
      clientProvider = createOpenAI({
        baseURL: baseURL,
        apiKey: "no-key-required",
      });
    } else {
      console.log(`Sending prompt to OpenRouter model ${modelName} for enhancement...`);
      targetModel = modelName;
      
      clientProvider = createOpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: apiKey,
        headers: {
          "HTTP-Referer": "https://krumstudio.com",
          "X-Title": "Krum Studio",
        },
      });
    }

    const { object } = await generateObject({
      model: clientProvider.chat(targetModel),
      schema: z.object({
        enhancedPrompt: z.string().describe("The visually rich, detailed, and stylized prompt."),
        steps: z.number().optional().describe("Optimized inference steps."),
        guidance: z.number().optional().describe("Optimized CFG guidance scale."),
        width: z.number().optional().describe("Optimized canvas width (multiples of 8 or 16)."),
        height: z.number().optional().describe("Optimized canvas height (multiples of 8 or 16)."),
        duration: z.number().optional().describe("Optimized video duration in seconds (up to 100 seconds). Only optimize and return this if generation type is t2v or i2v."),
        fps: z.number().optional().describe("Optimized video frames per second (typically 24, 25, or 30). Only optimize and return this if generation type is t2v or i2v."),
      }),
      system: systemPrompt,
      prompt: userInstructions,
    });

    console.log(`Successfully enhanced prompt via ${llmProvider}:`, object);

    return {
      enhancedPrompt: object.enhancedPrompt,
      steps: object.steps ?? settings.steps,
      guidance: object.guidance ?? settings.guidance,
      width: object.width ?? settings.width,
      height: object.height ?? settings.height,
      duration: object.duration ?? settings.duration,
      fps: object.fps ?? settings.fps,
    };
  } catch (err) {
    console.error(`Failed to enhance prompt via ${llmProvider}:`, err);
    // Return original values on failure so the pipeline continues
    return {
      enhancedPrompt: prompt,
      steps: settings.steps,
      guidance: settings.guidance,
      width: settings.width,
      height: settings.height,
      duration: settings.duration,
      fps: settings.fps,
    };
  }
}
