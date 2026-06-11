# Product: Krum Studio

Krum Studio is an AI-native generative media studio. It provides a creative playground where users can run multi-modal AI generation workflows (Text-to-Image, Text-to-Video, Text-to-Audio, Image-to-Video, Image-to-Image) with real-time progress tracking.

## Core Architecture
- Generation workloads are offloaded to a dedicated Ubuntu GPU instance running **ComfyUI**
- The Next.js app dispatches prompts to ComfyUI via HTTP and tracks progress over WebSocket
- Completed assets are automatically archived to **AWS S3** and returned as signed CDN URLs

## Key User Flows
1. User configures a generation (prompt, type, model, aspect ratio) on the studio canvas
2. App dispatches to ComfyUI, receives a `prompt_id` + `clientId`
3. Client opens a WebSocket to ComfyUI and streams progress (0–100%)
4. On completion, the app calls the persist endpoint which pipes the asset to S3
5. Final asset URL is delivered back to the UI

## Environment Variables (`.env.local`)
```
COMFYUI_HTTP_URL=http://<gpu-vm>:8188
COMFYUI_WS_URL=ws://<gpu-vm>:8188/ws
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET_NAME=
```
