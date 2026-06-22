import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

const PRESET_STYLE_INJECTIONS: Record<string, string> = {
  photorealistic: "Style: High-end commercial photography. Shot on Hasselblad X2D. 80mm lens. f/2.8 aperture. Natural realistic lighting. Authentic skin textures. Premium commercial photography. Shallow depth of field. Accurate colors.",
  cinematic: "Style: Cinematic film still. Shot using anamorphic cinema lenses. Dramatic practical lighting. Volumetric atmosphere. Film-quality contrast. Natural lens characteristics. Visual storytelling.",
  product: "Style: Premium luxury product photography. Professional studio lighting. Clean reflections. Perfect edge definition. Commercial advertising quality. Minimal distractions.",
  social_media: "Style: Modern social media design. Strong visual hierarchy. Bold focal point. Clear communication. High engagement design. Professional layout.",
  typography: "Style: Professional graphic design. Typography is the primary focus. All text must be perfectly spelled, fully readable, professionally typeset, well aligned, high contrast, visually balanced.",
  editorial: "Style: Luxury editorial photography. Fashion magazine quality. Premium composition. Elegant posing. Sophisticated lighting. Luxury color grading.",
  concept_art: "Style: AAA concept art. Large-scale visual design. Rich environmental storytelling. Epic composition. Advanced atmosphere. High-detail worldbuilding."
};

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

  // User-Facing Parameters (Safe)
  prompt?: string;
  negativePrompt?: string;
  qualityLevel?: "Draft" | "Standard" | "High" | "Ultra";
  styleStrength?: number;
  promptEnhancement?: number;
  creativity?: number;
  detailLevel?: number;
  faceDetail?: number;
  lightingStyle?: "Auto" | "Natural" | "Studio" | "Cinematic" | "Golden Hour" | "Dramatic";
  cameraType?: "Auto" | "Smartphone" | "DSLR" | "Cinema" | "Macro";
  aspectRatio?: "Auto" | "1:1" | "16:9" | "9:16" | "3:2" | "4:5";
  resolution?: "Auto" | "HD" | "2K" | "4K";
  colorStyle?: "Natural" | "Vibrant" | "Muted" | "Filmic";
  sharpness?: number;
  realism?: number;
  upscaleOutput?: boolean;
  upscaleFactor?: "1x" | "2x" | "4x";
  turboMode?: boolean;
  presetStyle?: string;
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

    if (settings.negativePrompt) userInstructions += `\n- Negative Prompt: ${settings.negativePrompt}`;
    if (settings.qualityLevel) userInstructions += `\n- Quality Level: ${settings.qualityLevel}`;
    if (settings.styleStrength !== undefined) userInstructions += `\n- Style Strength: ${settings.styleStrength}/100`;
    if (settings.promptEnhancement !== undefined) userInstructions += `\n- Prompt Enhancement: ${settings.promptEnhancement}/100`;
    if (settings.creativity !== undefined) userInstructions += `\n- Creativity: ${settings.creativity}/100`;
    if (settings.detailLevel !== undefined) userInstructions += `\n- Detail Level: ${settings.detailLevel}/100`;
    if (settings.faceDetail !== undefined) userInstructions += `\n- Face Detail: ${settings.faceDetail}/100`;
    if (settings.lightingStyle) userInstructions += `\n- Lighting Style: ${settings.lightingStyle}`;
    if (settings.cameraType) userInstructions += `\n- Camera Type: ${settings.cameraType}`;
    if (settings.colorStyle) userInstructions += `\n- Color Style: ${settings.colorStyle}`;
    if (settings.sharpness !== undefined) userInstructions += `\n- Sharpness: ${settings.sharpness}/100`;
    if (settings.realism !== undefined) userInstructions += `\n- Realism: ${settings.realism}/100`;
    if (settings.upscaleOutput !== undefined) userInstructions += `\n- Upscale Output: ${settings.upscaleOutput}`;
    if (settings.upscaleFactor) userInstructions += `\n- Upscale Factor: ${settings.upscaleFactor}`;
    if (settings.turboMode !== undefined) userInstructions += `\n- Turbo Mode: ${settings.turboMode}`;
    if (settings.presetStyle && settings.presetStyle !== "none") {
      const injection = PRESET_STYLE_INJECTIONS[settings.presetStyle];
      if (injection) {
        userInstructions += `\n- Selected Preset Style Name: ${settings.presetStyle.toUpperCase()}`;
        userInstructions += `\n- Style Prompt Guidelines to inject: "${injection}"`;
      }
    }

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
