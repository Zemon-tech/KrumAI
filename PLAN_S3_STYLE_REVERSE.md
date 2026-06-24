# Plan: S3-Backed Style Reverse-Engineering Workflow

## Context

KrumStudio is a Next.js 16 AI-native generative studio that communicates with a remote ComfyUI instance on a GPU VM. The existing pipeline supports t2i (Flux), i2i (Qwen-Image-Edit), and t2v/i2v (LTX Video) via API-exported workflow templates, dynamic graph parsing, and WebSocket-based progress tracking.

Currently, images are uploaded to ComfyUI's local filesystem via its `/upload/image` endpoint, and outputs are fetched from ComfyUI's `/view` endpoint and persisted to the Next.js server's local `public/generated/` directory.

We want to integrate a **Style Reverse-Engineering workflow** that has 3 branches:

1. **STYLE → TEXT**: Feeds a style reference image into a vision LLM (Ollama/qwen2.5vl:7b on the VM) to extract a text description of the visual style (lighting, palette, lens, mood, etc.)
2. **STYLE → NEW IMAGE (Flux.2)**: Uses the extracted style text + a user-provided subject prompt to generate a brand new image in that style via Flux.2.
3. **STYLE TRANSFER (Qwen-Image-Edit)**: Takes both a style reference image and a content image, directly repaints the content in the style of the reference — no text prompt needed.

All image I/O will be routed through **AWS S3** because ComfyUI runs on a remote VM and we need a shared, accessible storage layer. Users upload from their local machine, ComfyUI reads inputs from S3 and writes outputs to S3.

### Current Tech Stack
- **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS, Vercel AI SDK
- **Backend:** Next.js Route Handlers (serverless-compatible)
- **Generation Engine:** ComfyUI on Ubuntu GPU VM (HTTP API + WebSocket)
- **Vision LLM:** Ollama (qwen2.5vl:7b) running locally on the same VM
- **Existing workflows:** api_flux.json (t2i), api_qwen.json (i2i), api_video.json (t2v/i2v)
- **No cloud storage implemented yet** (SPEC.md mentions S3 but no code exists)

### Relevant Files
- `app/api/generate/dispatch/route.ts` — dispatches prompts to ComfyUI
- `app/api/generate/persist/route.ts` — fetches outputs from ComfyUI, saves locally
- `app/api/generate/upload/route.ts` — proxies image uploads to ComfyUI
- `app/api/generate/assets/route.ts` — lists generated assets from local filesystem
- `lib/comfyGraphParser.ts` — dynamic workflow graph manipulation
- `lib/comfy-templates/` — API-format workflow JSON templates
- `style_reverse_engineer_workflow (1).json` — source workflow to convert to API format

---

## Constraints

### Technical
- ComfyUI must read/write S3 directly (no proxying through Next.js for image bytes)
- Frontend uploads directly to S3 via presigned URLs (fastest, no server bandwidth bottleneck)
- The Ollama vision LLM runs on the ComfyUI VM — its text output must be returned to the client
- The style reverse-engineering workflow uses nodes not in the standard ComfyUI install:
  - **ComfyUI-Ollama** (stavsap) — OllamaVision captioner
  - **ComfyUI (pysssss)** — ShowText node
  - **ComfyS3** (TemryL) — LoadImageS3 / SaveImageS3 nodes
- Workflow must be converted from "graph format" to "API format" for programmatic dispatch
- The 3 branches share input images but produce different output types (text vs image)

### Cost / Budget (Post July 2025 AWS Free Tier Model)
- **AWS changed its Free Tier on July 15, 2025.** The old per-service limits (5 GB S3 storage, 2,000 PUTs/month, etc.) no longer apply to accounts created after that date.
- **New model:** $200 in credits ($100 at signup + up to $100 via onboarding activities). Credits are shared across ALL AWS services. Credits expire 12 months from account creation.
- **Free Plan:** Lasts 6 months or until credits exhausted (whichever comes first). Account locks if credits run out without upgrading to Paid Plan.
- **S3 is NOT in the "Always Free" tier.** All S3 usage is deducted from your $200 credit pool.
- **Always Free data transfer:** 100 GB/month data transfer OUT to internet persists even after credits expire.
- **S3 Standard pricing (deducted from credits):**
  - Storage: $0.023 per GB/month
  - PUT/POST/COPY/LIST requests: $0.005 per 1,000 requests
  - GET/SELECT requests: $0.0004 per 1,000 requests
- **Estimated cost for this project:** ~$0.30/month at 600 runs/month (20/day). With $200 credits, this project alone could run for years without exhausting them.
- **Main risk:** Credits are shared across all services. If other AWS services (EC2, Lambda, etc.) consume credits, S3 budget shrinks.
- Must implement lifecycle policies to auto-delete old objects (prevent unbounded growth)
- Must set up AWS Budget alarm before any code touches S3
- Application-level rate limiting to prevent accidental overuse
- Keep data transfer out under 100 GB/month (the only "Always Free" limit that matters — ~20,000 image views at 5 MB each)

### Infrastructure
- S3 bucket region must match (or be close to) the GPU VM region for lowest latency
- Two scoped IAM users: one for Next.js (presign only), one for ComfyUI VM (read inputs, write outputs)
- No public ListBucket permission — objects accessed by known keys only
- Outputs will be publicly readable (simple public-read ACL or bucket policy on `outputs/*` prefix)
- Inputs will be private (accessible only via presigned URLs or ComfyUI's IAM credentials)

### Workflow-Specific
- Branch 1 (Style → Text) does NOT produce an image output — it returns a text string
- Branch 2 (Style → New Image) needs the text output from Branch 1 as input (user pastes or we chain)
- Branch 3 (Style Transfer) requires 2 input images (style ref + content image)
- All branches share the same style reference image upload
- The OllamaVision node needs HTTP connectivity to `http://127.0.0.1:11434` on the VM (Ollama server)

---

## TODO

### Phase 0: AWS Infrastructure Setup
- [ ] Create S3 bucket (`krumai-assets`) in the same region as GPU VM
- [ ] Configure bucket policy: `outputs/*` prefix is public-read, `inputs/*` is private
- [ ] Add CORS configuration for presigned URL uploads from localhost
- [ ] Create lifecycle rule: auto-delete objects after 30 days
- [ ] Create IAM user for Next.js (limited to `s3:PutObject` on inputs, `s3:GetObject` on outputs)
- [ ] Create IAM user for ComfyUI VM (limited to `s3:GetObject` on inputs, `s3:PutObject` on outputs)
- [ ] Set up AWS Budget alarm (zero-spend budget — alerts when credits depleted and real charges begin)
- [ ] Verify credit balance in AWS Console → Billing → Credits
- [ ] Note: Free Plan expires after 6 months or when credits exhausted — upgrade to Paid Plan before expiry if needed

### Phase 1: ComfyUI VM Setup
- [ ] Install ComfyS3 custom node on the VM (`git clone` into `custom_nodes/`)
- [ ] Install `boto3` in ComfyUI's Python environment
- [ ] Configure AWS credentials as environment variables on the VM
- [ ] Verify ComfyS3 nodes appear in ComfyUI Manager and work manually
- [ ] Verify Ollama is running and accessible at `http://127.0.0.1:11434`
- [ ] Verify ComfyUI-Ollama custom node is installed

### Phase 2: Workflow Template Conversion
- [ ] Convert `style_reverse_engineer_workflow (1).json` from graph format to API format
- [ ] Split into 3 sub-templates (or one template with toggleable branches):
  - `api_style_extract.json` — Branch 1 (Style → Text via Ollama)
  - `api_style_generate.json` — Branch 2 (Style text + subject → Flux.2 image)
  - `api_style_transfer.json` — Branch 3 (Style image + Content image → Qwen output)
- [ ] Replace `LoadImage` nodes with `LoadImageS3` nodes (bucket + key inputs)
- [ ] Replace `SaveImage` nodes with `SaveImageS3` nodes (bucket + prefix inputs)
- [ ] For Branch 1: determine how to capture OllamaVision text output from ComfyUI execution
  - Option A: Use ComfyUI's history API to retrieve the text value after execution
  - Option B: Add a SaveTextS3 or webhook node to push the text result
- [ ] Place finalized templates in `lib/comfy-templates/`

### Phase 3: Next.js Backend
- [ ] Install `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`
- [ ] Create `lib/s3Client.ts` — shared S3 client instance + helper functions
- [ ] Create `app/api/storage/presign/route.ts` — generates presigned PUT URLs for input images
  - Accepts: `{ filename, contentType }`
  - Returns: `{ uploadUrl, s3Key, publicUrl (for outputs) }`
  - Presigned URL expires in 5 minutes
- [ ] Add `style_extract`, `style_generate`, `style_transfer` cases to `comfyGraphParser.ts`
  - Injects S3 bucket name and keys into LoadImageS3/SaveImageS3 nodes
  - Injects prompt text for Branch 2
  - Injects Ollama settings for Branch 1
- [ ] Update `/api/generate/dispatch` to handle the new generation types
- [ ] Create `/api/generate/history/route.ts` — queries ComfyUI `/history/{prompt_id}` to retrieve text outputs from Branch 1
- [ ] Update `/api/generate/persist` to handle S3-based outputs:
  - For style_generate and style_transfer: construct public S3 URL (no fetch needed)
  - For style_extract: fetch text from ComfyUI history API
- [ ] Add daily rate limiting counter (simple file-based or in-memory for single user)

### Phase 4: Frontend
- [ ] Create upload component with direct-to-S3 presigned URL upload + progress bar
- [ ] Create Style Reverse-Engineering panel/page in the playground:
  - Upload area for "Style Reference Image" (shared across branches)
  - Upload area for "Content Image" (Branch 3 only)
  - "Extract Style" button (Branch 1) — shows extracted text in a copyable textarea
  - "Generate in Style" button (Branch 2) — subject prompt input + generate
  - "Transfer Style" button (Branch 3) — triggers style transfer
- [ ] Wire up WebSocket progress tracking for image generation branches
- [ ] Display results: text output for Branch 1, image preview for Branches 2 & 3
- [ ] Show usage counter / remaining generations indicator

### Phase 5: Testing & Polish
- [ ] End-to-end test: upload → S3 → ComfyUI → S3 → display for each branch
- [ ] Verify lifecycle policy is correctly configured (test with a short expiry)
- [ ] Confirm budget alarm fires on test usage
- [ ] Error handling: S3 upload failures, ComfyUI timeouts, Ollama not responding
- [ ] Clean up: remove the graph-format workflow JSON from project root

---

## Acceptance Criteria

### Functional
- [ ] User can upload a style reference image from their local machine; it lands in S3 `inputs/` prefix within 2 seconds for a typical image (< 5 MB)
- [ ] User can upload a content image (for Branch 3) using the same flow
- [ ] **Branch 1 (Style → Text):** User clicks "Extract Style" → ComfyUI runs OllamaVision on the S3 image → text description is returned and displayed in the UI within 30 seconds
- [ ] **Branch 2 (Style → New Image):** User provides extracted style text + subject prompt → Flux.2 generates an image → output is saved to S3 and displayed in the UI
- [ ] **Branch 3 (Style Transfer):** User has both images uploaded → clicks "Transfer Style" → Qwen-Image-Edit produces output → saved to S3 and displayed in the UI
- [ ] Generated output images are publicly accessible via their S3 URL (no auth required to view)
- [ ] WebSocket progress tracking works for Branches 2 and 3 (same as existing t2i/i2i flows)
- [ ] All 3 branches can be triggered independently from the same UI panel

### Non-Functional
- [ ] No image bytes are proxied through the Next.js server (presigned upload for inputs, direct S3 reads for outputs)
- [ ] S3 usage stays within free tier for normal usage (< 20 generations/day)
- [ ] Objects are auto-deleted after 30 days (lifecycle policy verified)
- [ ] AWS Budget alarm is active and will notify before any billing occurs
- [ ] Rate limiting prevents more than a configurable max (e.g., 50) generations per day
- [ ] IAM permissions follow principle of least privilege (no wildcard actions, no delete permissions)
- [ ] Application gracefully handles: S3 upload timeout, ComfyUI unreachable, Ollama not responding

### Developer Experience
- [ ] All configuration is in `.env.local` (no hardcoded bucket names, regions, or credentials)
- [ ] New workflow templates are cleanly separated in `lib/comfy-templates/`
- [ ] `comfyGraphParser.ts` handles the new types without breaking existing t2i/i2i/t2v flows
- [ ] The plan can be executed incrementally — each phase is independently verifiable

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  USER BROWSER                                                        │
│                                                                      │
│  1. Select image(s) from local filesystem                            │
│  2. POST /api/storage/presign → receive presigned URL + s3Key        │
│  3. PUT image directly to S3 (XHR with progress tracking)            │
│  4. POST /api/generate/dispatch { type, s3Keys, prompt? }            │
│  5. Receive prompt_id + ws_url                                       │
│  6. Connect WebSocket for progress (Branches 2 & 3)                  │
│  7. On completion:                                                   │
│     - Branch 1: GET /api/generate/history/{prompt_id} → text         │
│     - Branch 2/3: Construct public S3 output URL → display image     │
└──────────┬───────────────────────────────────────────┬──────────────┘
           │                                           │
     presigned PUT                              WebSocket /ws
           │                                           │
           ▼                                           ▼
┌─────────────────────┐                 ┌─────────────────────────────┐
│  AWS S3              │                 │  COMFYUI GPU VM              │
│                      │  LoadImageS3    │                              │
│  inputs/             │ ◄───────────── │  ComfyS3 custom node         │
│    {ts}_{file}.png   │                 │  ComfyUI-Ollama node         │
│                      │  SaveImageS3    │  Ollama (qwen2.5vl:7b)       │
│  outputs/            │ ◄───────────── │                              │
│    {pid}_{file}.png  │                 │  Models: Flux.2, Qwen-Edit   │
└─────────────────────┘                 └─────────────────────────────┘
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| S3 credits exhausted by other services | Zero-spend budget alarm + weekly credit balance check |
| ComfyS3 node doesn't support our S3 region or auth method | Test on VM before writing any frontend code (Phase 1) |
| Ollama text output can't be retrieved programmatically | Fall back to ComfyUI `/history` API which stores all node outputs |
| Presigned URL expires before large upload completes | Set 5-min expiry (sufficient for < 50 MB); add retry logic |
| Workflow conversion from graph → API format has errors | Manually test dispatch via curl before wiring up the full pipeline |
| VM goes down mid-generation | WebSocket disconnect handler + user-friendly error in UI |
| Free Plan expires (6 months) before project is done | Upgrade to Paid Plan before expiry — credits still last 12 months on Paid |

---

## Cost & Credit Guardrails (Post July 2025 Model)

| Protection | What it does |
|-----------|-------------|
| Zero-spend budget | Emails you the instant real billing charges appear (when credits exhausted) |
| Credit tracking | Check AWS Console → Billing → Credits regularly to monitor remaining balance |
| Lifecycle rule (30-day) | Auto-deletes old objects — storage never grows unbounded |
| IAM least privilege | No delete permission, no list-bucket, no wildcard |
| CORS locked to localhost | No random domains can upload to your bucket |
| App rate limit (Phase 3) | Code-level cap at 50 generations/day |
| Data transfer < 100 GB/month | Stay within the "Always Free" egress limit (~20,000 image views at 5 MB) |

**Credit consumption estimate:**

| Component | Monthly (600 runs) | Cost |
|-----------|-------------------|------|
| Storage (~12 GB with lifecycle) | 12 GB x $0.023 | $0.28 |
| PUT requests (~2,400) | 2,400 x $0.005/1000 | $0.012 |
| GET requests (~3,600) | 3,600 x $0.0004/1000 | $0.001 |
| Data transfer OUT | Within 100 GB/month Always Free | $0.00 |
| **Monthly total** | | **~$0.30** |
| **Annual total** | | **~$3.60** |

**$200 credits = ~55 years of S3 usage at this rate.** The real risk is accidentally spending credits on OTHER AWS services.

---

## Environment Variables Required

```env
# AWS S3
AWS_ACCESS_KEY_ID=<nextjs-iam-user-key>
AWS_SECRET_ACCESS_KEY=<nextjs-iam-user-secret>
AWS_REGION=<region-matching-vm>
AWS_S3_BUCKET_NAME=krumai-assets

# ComfyUI (existing)
COMFYUI_HTTP_URL=http://<vm-ip>:8188

# Rate Limiting
MAX_DAILY_GENERATIONS=50
```

On the ComfyUI VM (separate credentials):
```bash
export AWS_ACCESS_KEY_ID=<comfy-iam-user-key>
export AWS_SECRET_ACCESS_KEY=<comfy-iam-user-secret>
export AWS_DEFAULT_REGION=<region>
```
