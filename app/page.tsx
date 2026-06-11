import { StudioLayout } from "@/components/studio/studio-layout";

export const metadata = {
  title: "Krum Studio — AI-Native Generative Studio",
};

export default function Home() {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <StudioLayout />
    </div>
  );
}
