# SPEC.md: AI-Native Generative Studio Architecture Spec

## 1. Executive Summary
This document defines the architectural specification for an AI-Native Creative Studio application built using Next.js, the Vercel AI SDK, and a dedicated Ubuntu GPU instance running ComfyUI via its programmatic API. The platform delivers real-time execution tracking for multi-modal generations (Text-to-Image, Text-to-Video, Text-to-Audio, Image-to-Video, Image-to-Image) and automatically archives all generated creative assets into an AWS S3 bucket.

---

## 2. Technical Stack
* **Frontend Framework:** Next.js 15+ (App Router, Client-side heavy canvas for playground orchestration).
* **UI Components & Streaming:** Vercel AI SDK (`ai` package) utilizing `createStreamableValue` and UI state synchronization.
* **Backend & Orchestration:** Serverless-compatible Next.js Server Actions / Route Handlers.
* **Generation Engine:** ComfyUI API runner running asynchronously on an Ubuntu VM with dedicated GPU capabilities.
* **Storage Infrastructure:** AWS S3 (via `@aws-sdk/client-s3`) for persistent asset hosting.

---

## 3. System Flow & Architecture
Because generation workloads are long-running, the system uses a **Decoupled Asynchronous Polling/WebSocket** approach to keep server-side endpoints stateless and immune to gateway timeout constraints.

```
[ Client Browser ] ---- 1. Dispatch Form Data ----> [ Next.js Server Action ]
|                                                    |
|                                           2. Dynamic Graph Parsing
|                                           3. Dispatch to ComfyUI /prompt
|                                                    |
|<--- 4. Return unique prompt_id & ClientID ---------+
|
|==== 5. Establish direct WebSocket connection ====> [ ComfyUI VM (/ws) ]
|                                                    |
|<--- 6. Stream progress notifications (0-100%) -----+
|
|==== 7. Signal generation complete ===============> [ Next.js S3 Webhook ]
|
1. Fetch local bytes
2. Stream upload to S3
|
<=== 10. Deliver final signed S3 asset URL to Client ==============+

```

---

## 4. Component Requirements & Implementations

### A. Dynamic Workflow Parser & Input Mapping
The backend must read structural ComfyUI JSON schema configurations. The agent must not assume hardcoded Node IDs. Instead, implement a recursive lookup mapping schema to pinpoint and overwrite input targets dynamically:

```typescript
// Example Target Node Contract
interface ComfyNode {
  class_type: string;
  inputs: Record<string, any>;
}

// Target mapping definitions
const NODE_TARGETS = {
  PROMPT: 'CLIPTextEncode',
  MODEL: 'CheckpointLoaderSimple',
  LATENT_SIZE: 'EmptyLatentImage',
  IMAGE_LOADER: 'LoadImage'
};

```

* **Task:** Build a helper module `comfyGraphParser.ts` that searches for nodes corresponding to `class_type`, replacing standard placeholders safely before executing the prompt dispatch.

### B. Next.js Route Handlers & S3 Pipelines

Create two high-priority operational API paths:

1. **`/api/generate/dispatch` (POST):**
* Validates user payload (prompt, generation type, model configuration, aspect ratio).
* Loads corresponding base workflow JSON file.
* Injects dynamic runtime variables via the graph parser.
* Issues an HTTP POST request to your ComfyUI VM endpoint `/prompt` with a newly generated `client_id`.
* Returns the resulting `prompt_id` back to the UI interface.


2. **`/api/generate/persist` (POST):**
* Accepts a body containing `{ filename: string, subfolder: string, type: string }`.
* Queries the ComfyUI endpoint `/view?filename=${filename}&subfolder=${subfolder}&type=${type}` to retrieve raw asset buffers directly from your GPU node (Method 1).
* Instantiates an AWS S3 `PutObjectCommand` utilizing a streaming pipeline to move the file bytes straight to your designated bucket repository.
* Returns the finalized, public AWS S3 structural CDN asset string.



### C. Client Playground & WebSocket Progress Monitor

The user dashboard acts as a centralized command panel tracking the WebSocket states.

* **WebSocket Protocol Integration:** Establish direct connections using `new WebSocket('ws://<YOUR_GPU_VM>:8188/ws?clientId=' + clientId)`.
* **Message Processing Logic:**
* Listen to events of `type: "progress"`. Read `value` and `max` variables to evaluate the execution completion percentage using: Progress = (value / max) * 100
* Listen to events of `type: "executing"` where `data.node === null` and `data.prompt_id === currentPromptId`. This confirms total processing completion.
* Trigger an automatic internal callback directly to your backend endpoint `/api/generate/persist` to safely transition files off local VM disk space over to cloud asset storage.



---

## 5. Directory Structure Draft

Ensure your generative repository structure follows this design:

```
src/
├── app/
│   ├── api/
│   │   └── generate/
│   │       ├── dispatch/route.ts   # Hands off inputs to ComfyUI
│   │       └── persist/route.ts    # Pipes ComfyUI data into AWS S3
│   └── playground/
│       └── page.tsx                # Studio canvas dashboard UI
├── components/
│   └── GenerationCanvas.tsx        # Render canvas and media players
├── lib/
│   ├── comfy-templates/
│   │   ├── t2i.json                # Dev-mode API exported configuration graphs
│   │   ├── t2v.json
│   │   ├── i2v.json
│   │   └── t2a.json
│   ├── comfyGraphParser.ts         # Runtime modifier logic
│   └── s3Client.ts                 # AWS S3 connection setup

```

---

## 6. Testing & Acceptance Parameters

* **Sandbox Isolation:** The application will run locally on localhost without a wedding database or security middlewares during the phase-one test sequence.
* **Variable Environment Configs:** All configurations must live cleanly within local configurations (`.env.local`):
* `COMFYUI_HTTP_URL=http://192.168.1.144:8188` (or your Ubuntu VM public endpoint)
* `COMFYUI_WS_URL=ws://192.168.1.144:8188/ws`
* `AWS_ACCESS_KEY_ID=your_key`
* `AWS_SECRET_ACCESS_KEY=your_secret`
* `AWS_S3_BUCKET_NAME=your_bucket`


* **Execution Safety:** If a network drop happens during generation, the application interface must gracefully inform the user and close dangling WebSocket listeners cleanly.
