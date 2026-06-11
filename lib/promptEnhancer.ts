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

export async function enhancePrompt(
  prompt: string,
  settings: GenSettings
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

    const systemPrompt = `You are a prompt engineering expert for generative models (Flux image generator, Qwen image editor, and LTX video generator).
Your task is to take a raw user prompt, generation type, and settings, and enhance it:
1. Write a highly detailed, visually descriptive, and rich version of the prompt (the "enhancedPrompt"). Enhance lighting, textures, camera placement, style, and mood to make it look premium.
2. Maintain the core subject of the user's request.
3. Optimize model settings (steps, guidance CFG scale, and aspect ratio width/height) if you feel the user's settings can be adjusted to better implement the style of the prompt. 
   - Note: For video outputs (type: t2v or i2v), width is typically 768 and height is 512. For image outputs, it is typically 1024x1024 or standard aspect ratios.
   - For steps and guidance, pick optimal values for the selected generation type (e.g. Flux likes steps: 20-30 and guidance: 3.5-6.0; LTX Video likes steps: 10-25).
   - If the user's parameters are already optimal or you do not need to change them, return them as is.

Return a JSON object conforming to the schema.`;

    const userInstructions = `User Raw Prompt: "${prompt}"
Generation Type: "${settings.type}"
Current Settings:
- Steps: ${settings.steps}
- Guidance Scale: ${settings.guidance}
- Width: ${settings.width}
- Height: ${settings.height}
- Model: ${settings.model}`;

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
      duration: settings.duration,
      fps: settings.fps,
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
