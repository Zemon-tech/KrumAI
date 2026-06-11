import Link from "next/link";
import { SparklesIcon, ZapIcon, ImageIcon, VideoIcon, MusicIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-background font-sans px-6">
      <main className="flex flex-col items-center gap-8 text-center max-w-lg">
        {/* Logo */}
        <div className="flex items-center gap-2.5 select-none">
          <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
            <SparklesIcon className="size-6 text-primary" />
          </div>
          <span className="text-2xl font-bold tracking-tight">Krum Studio</span>
        </div>

        {/* Headline */}
        <div className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight leading-tight">
            AI-Native Generative Studio
          </h1>
          <p className="text-muted-foreground text-base leading-relaxed">
            Generate images, video, and audio with ComfyUI at GPU speed.
            Real-time progress, S3-backed asset management, all in one canvas.
          </p>
        </div>

        {/* Mode badges */}
        <div className="flex flex-wrap gap-2 justify-center">
          {[
            { icon: <ImageIcon className="size-3.5" />, label: "Text → Image", color: "text-violet-400" },
            { icon: <VideoIcon className="size-3.5" />, label: "Text → Video", color: "text-blue-400" },
            { icon: <MusicIcon className="size-3.5" />, label: "Text → Audio", color: "text-emerald-400" },
            { icon: <VideoIcon className="size-3.5" />, label: "Image → Video", color: "text-blue-400" },
          ].map(({ icon, label, color }) => (
            <Badge key={label} variant="outline" className={`gap-1.5 text-xs ${color}`}>
              {icon}
              {label}
            </Badge>
          ))}
        </div>

        {/* CTA */}
        <div className="flex gap-3">
          <Button asChild size="lg" className="gap-2">
            <Link href="/playground">
              <ZapIcon className="size-4" />
              Open Studio
            </Link>
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Requires ComfyUI running at{" "}
          <code className="bg-muted px-1 py-0.5 rounded text-xs">COMFYUI_HTTP_URL</code>
          {" "}and AWS S3 credentials in{" "}
          <code className="bg-muted px-1 py-0.5 rounded text-xs">.env.local</code>
        </p>
      </main>
    </div>
  );
}
