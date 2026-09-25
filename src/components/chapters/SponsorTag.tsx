"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// A small hover badge that reveals which sponsor tool did the work right here, and what it did.
// Built for the silent demo video: hovering (cursor pause, visible on screen recording) pops
// the explanation without needing narration.

const SPONSOR: Record<string, { label: string; color: string }> = {
  flux: { label: "FLUX", color: "#2b2622" },
  nimble: { label: "Nimble", color: "#1f7a63" },
  rawtree: { label: "RawTree", color: "#7a4fc9" },
  liquid: { label: "Liquid AI", color: "#1f6fb0" },
};

export function SponsorTag({ tool, note, className = "" }: { tool: keyof typeof SPONSOR; note: string; className?: string }) {
  const s = SPONSOR[tool];
  return (
    <Tooltip>
      <TooltipTrigger
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm ${className}`}
        style={{ background: s.color }}
      >
        <span className="inline-block size-1.5 rounded-full bg-white/80" />
        {s.label}
      </TooltipTrigger>
      <TooltipContent side="top">{note}</TooltipContent>
    </Tooltip>
  );
}
