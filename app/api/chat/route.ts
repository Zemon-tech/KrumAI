import { NextResponse } from "next/server";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText, ModelMessage } from "ai";
import {
  t2iChat,
  t2vChat,
  i2vChat,
  i2iChat,
  classifyPrompt,
} from "@/lib/prompts";

export async function POST(request: Request) {
  let llmProvider = "llamacpp";
  try {
    const body = await request.json();
    const { messages, settings, hasSelectedImage, selectedAssetPrompt } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Conversation messages list is required" },
        { status: 400 }
      );
    }

    const currentSettings = settings || {
      type: "t2i",
      model: "flux-dev",
      steps: 25,
      guidance: 6.0,
      width: 1024,
      height: 1024,
      llmProvider: "llamacpp",
    };

    const currentType = currentSettings.type || "t2i";
    llmProvider = currentSettings.llmProvider || "llamacpp";
    const apiKey = process.env.OPENROUTER_API_KEY;
    const modelName = process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash";

    let clientProvider;
    let targetModel;

    // Set up the LLM provider client
    if (llmProvider === "llamacpp") {
      const baseURL = process.env.LLAMACPP_API_URL || "http://127.0.0.1:8080/v1";
      targetModel = process.env.LLAMACPP_MODEL_NAME || "local-model";
      
      clientProvider = createOpenAI({
        baseURL: baseURL,
        apiKey: "no-key-required",
      });
    } else {
      // Fallback if OpenRouter is chosen but key is unconfigured
      if (!apiKey || apiKey === "your_openrouter_api_key_here" || apiKey.trim() === "") {
        return new Response("⚠️ **API Key Missing:** Please add your `OPENROUTER_API_KEY` to the `.env.local` file to start chatting, or switch to **Llama.cpp (Local)** in Generator Settings.", { status: 400 });
      }

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

    // Extract user request history to classify
    const lastUserMessage = messages[messages.length - 1]?.content || "";
    const historySlice = messages.slice(-5, -1);
    const historyText = historySlice
      .map((m: any) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n");

    // Run classification to determine which API model matches user intent
    const detectedType = await classifyPrompt(
      lastUserMessage,
      historyText,
      currentType,
      !!hasSelectedImage,
      clientProvider,
      targetModel
    );

    console.log(`[Chat API] Prompt routed to: ${detectedType} (originally: ${currentType})`);

    // Pick system prompt based on classification
    let systemPrompt = t2iChat;
    if (detectedType === "t2v") {
      systemPrompt = t2vChat;
    } else if (detectedType === "i2v") {
      systemPrompt = i2vChat;
    } else if (detectedType === "i2i") {
      systemPrompt = i2iChat;
    }

    if (selectedAssetPrompt) {
      systemPrompt = `${systemPrompt}\n\n---
## CONTEXT - CURRENTLY SELECTED ASSET:
The user has selected a previously generated asset.
Original Prompt of the selected asset: "${selectedAssetPrompt}"
You MUST design the final prompt and parameters in a series/continuation of what was already generated.
- If editing (i2i), refer to this original prompt and describe only the modifications relative to it.
- If animating (i2v), use this original prompt to understand the starting visual layout, and focus your motion prompt on how this scene changes/moves.
- Keep the visual style, characters, and composition consistent with this original prompt unless the user explicitly requests otherwise.`;
    }

    const formattedMessages: ModelMessage[] = messages.map((m: any) => {
      if (m.role === "user") {
        return {
          role: "user" as const,
          content: String(m.content),
        };
      }
      return {
        role: "assistant" as const,
        content: String(m.content),
      };
    });

    console.log(`Routing Chat request to ${llmProvider} (${targetModel})`);

    const result = await streamText({
      model: clientProvider.chat(targetModel),
      system: systemPrompt,
      messages: formattedMessages,
    });

    return result.toTextStreamResponse({
      headers: {
        "x-detected-type": detectedType,
      },
    });

  } catch (error: any) {
    console.error("Error in chat api route:", error);
    
    const errMsg = error.message || "";
    const isConnRefused = errMsg.includes("ECONNREFUSED") || errMsg.includes("fetch failed");

    let reply = "⚠️ **Error:** Failed to communicate with the selected LLM provider.";
    if (isConnRefused) {
      if (llmProvider === "llamacpp") {
        reply = `⚠️ **Llama.cpp Connection Refused:** Could not connect to your local model server at \`${process.env.LLAMACPP_API_URL || "http://127.0.0.1:8080/v1"}\`. Please verify your Llama.cpp server is running and its API URL is configured correctly.`;
      } else {
        reply = "⚠️ **Connection Refused:** Could not connect to the OpenRouter API. Please check your internet connection.";
      }
    } else {
      reply = `⚠️ **LLM Error:** ${error.message || "An unexpected error occurred during reasoning."}`;
    }

    return new Response(reply, { status: 500 });
  }
}
