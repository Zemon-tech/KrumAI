import { StudioLayout } from "@/components/studio/studio-layout";

export const metadata = {
  title: "Playground — Krum Studio",
};

export default function PlaygroundPage() {
  // flex-1 fills the body flex column set in layout.tsx
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <StudioLayout />
    </div>
  );
}
