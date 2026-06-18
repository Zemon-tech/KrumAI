import { generateText } from "ai";

export async function classifyPrompt(
  prompt: string,
  history: string,
  currentType: string,
  hasSelectedImage: boolean,
  clientProvider: any,
  targetModel: string
): Promise<"t2i" | "t2v" | "i2v" | "i2i"> {
  const classifierSystemPrompt = `You are a high-speed AI classification router for Krum Studio. Your job is to analyze the user's latest prompt, the conversation history, and whether they have a starting image selected, to determine the correct generative API mode.

Select exactly one of these modes:
- 't2i' (Text-to-Image): User wants to generate a new static image, photo, or drawing from scratch.
- 't2v' (Text-to-Video): User wants to generate a new motion video, animation, or film clip from scratch.
- 'i2v' (Image-to-Video): User has a reference image selected AND wants to animate it, make it move, or create a video from it.
- 'i2i' (Image-to-Image / Edit): User has a reference image selected AND wants to modify, edit, add/remove details, or change the style of that image.

Routing Rules:
1. If "Has Selected Image" is false, you can ONLY choose 't2i' or 't2v'. You MUST NOT choose 'i2v' or 'i2i'.
2. If "Has Selected Image" is true:
   - If the user prompt specifically asks to make the image move, animate it, or make a video out of it, choose 'i2v'.
   - If the user prompt asks to edit it, modify, add/remove/change elements of it, choose 'i2i'.
   - If the user prompt explicitly describes generating something completely new from scratch (ignoring the selected image), choose 't2i' or 't2v' accordingly.
3. Pay close attention to action/motion keywords: "video", "motion", "clip", "movie", "animate", "movement", "pan", "zoom", "dolly", "rotate", "wind", "rain" vs "image", "photo", "drawing", "paint", "still", "picture".
4. If the prompt is neutral, generic, or just continuing a request (e.g., "make it look nice", "yes", "go ahead"), return the current active mode.
5. Default to the "Current Active Mode" unless the user explicitly requests to switch mediums. For example, if the active mode is 't2v', generate a video; do not switch to 't2i' unless they explicitly ask for a still image or photo.

Respond with ONLY the exact string ('t2i', 't2v', 'i2v', or 'i2i'). Do not include any formatting, explanation, or markdown.`;

  try {
    console.log(`[Classifier] Running classification on latest prompt: "${prompt}" (hasSelectedImage: ${hasSelectedImage}, currentType: ${currentType})`);
    const result = await generateText({
      model: clientProvider.chat(targetModel),
      system: classifierSystemPrompt,
      messages: [
        {
          role: "user",
          content: `Please classify the following context:
Current Active Mode: ${currentType}
Has Selected Image: ${hasSelectedImage ? "YES" : "NO"}
Conversation History:
${history}
Latest User Prompt: "${prompt}"`,
        },
      ],
      maxOutputTokens: 10,
      temperature: 0,
    });

    const responseText = result.text.trim().toLowerCase();
    console.log(`[Classifier] Raw classification result: "${responseText}"`);
    
    if (responseText.includes("t2i")) return "t2i";
    if (responseText.includes("t2v")) return "t2v";
    if (responseText.includes("i2v")) return "i2v";
    if (responseText.includes("i2i")) return "i2i";

    // Fallback heuristic if result is unrecognized
    return fallbackHeuristics(prompt, hasSelectedImage, currentType);
  } catch (err) {
    console.error("[Classifier] Error running classifier LLM call:", err);
    return fallbackHeuristics(prompt, hasSelectedImage, currentType);
  }
}

function fallbackHeuristics(prompt: string, hasSelectedImage: boolean, currentType: string): "t2i" | "t2v" | "i2v" | "i2i" {
  const text = prompt.toLowerCase();
  
  // Broad list of motion and action words suggesting video
  const isVideoKeyword = /\b(video|motion|animate|animation|clip|movie|movement|pan|zoom|dolly|gif|move|runs|running|walks|walking|flying|flow|flowing|wind|rain|play|playing|swim|swimming|jump|jumping)\b/.test(text);
  
  // Broad list of image words suggesting still image
  const isImageKeyword = /\b(image|photo|drawing|paint|painting|still|picture|portrait|canvas|sketch|render|snapshot|photo-shoot|photograph)\b/.test(text);

  if (hasSelectedImage) {
    if (isVideoKeyword) return "i2v";
    if (currentType === "i2v" || currentType === "i2i") {
      return currentType as "i2v" | "i2i";
    }
    return "i2i"; // Default fallback when image is selected
  } else {
    if (isVideoKeyword) return "t2v";
    if (isImageKeyword) return "t2i";
    if (currentType === "t2i" || currentType === "t2v") {
      return currentType as "t2i" | "t2v";
    }
    return "t2i"; // Default fallback when no image is selected
  }
}
