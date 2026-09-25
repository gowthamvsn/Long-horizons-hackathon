"use client";

import type { Book } from "@/lib/types";
import { cn } from "@/lib/utils";

// FLUX cover when we have one; otherwise a painted-paper placeholder in the same spirit.

const WASH: Record<string, string> = {
  space: "radial-gradient(circle at 30% 25%, #f6e7c8 0 8%, transparent 9%), radial-gradient(circle at 70% 70%, #9fb3cf 0, transparent 55%), linear-gradient(160deg, #3f4f74, #6f8fb0 60%, #c9b7d6)",
  dinosaurs: "radial-gradient(circle at 75% 20%, #f7e3b5 0 10%, transparent 11%), radial-gradient(ellipse at 30% 90%, #8fae84 0, transparent 60%), linear-gradient(170deg, #d9e6cf, #a9c29a 55%, #6f9468)",
  other: "linear-gradient(160deg, #f2dfc8, #d9b48f)",
};

function wash(topic: string) {
  if (/space|rocket|planet|star|moon|comet|mars/i.test(topic)) return WASH.space;
  if (/dino|saur|fossil|rex/i.test(topic)) return WASH.dinosaurs;
  return WASH.other;
}

export function Cover({ book, className }: { book: Book; className?: string }) {
  return (
    <div className={cn("relative aspect-[3/4] overflow-hidden rounded-r-md rounded-l-sm book-shadow", className)}>
      {book.cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={book.cover} alt={book.title} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0" style={{ background: wash(book.topic) }}>
          <div className="absolute inset-x-4 bottom-5 font-display text-lg leading-tight text-white/95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
            {book.title}
          </div>
        </div>
      )}
      {/* spine */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-2 bg-gradient-to-r from-black/20 to-transparent" />
    </div>
  );
}
