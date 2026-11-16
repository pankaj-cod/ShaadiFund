"use client";
// Adapted from Aceternity UI's "3D Card Effect" (https://ui.aceternity.com), simplified for ShaadiFund.
import { useRef, type MouseEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Tilts its content gently towards the pointer. Purely decorative: it does
 * nothing on touch screens and is skipped for people who prefer reduced motion.
 */
export function TiltCard({
  children,
  className,
  strength = 28,
}: {
  children: ReactNode;
  className?: string;
  /** Larger is subtler. */
  strength?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function onMove(event: MouseEvent<HTMLDivElement>) {
    const element = ref.current;
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const { left, top, width, height } = element.getBoundingClientRect();
    const x = (event.clientX - left - width / 2) / strength;
    const y = (event.clientY - top - height / 2) / strength;
    element.style.transform = `rotateY(${x}deg) rotateX(${-y}deg)`;
  }

  function onLeave() {
    if (ref.current) ref.current.style.transform = "rotateY(0deg) rotateX(0deg)";
  }

  return (
    <div className={cn("h-full [perspective:1200px]", className)}>
      <div
        ref={ref}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        className="h-full transition-transform duration-200 ease-out [transform-style:preserve-3d]"
      >
        {children}
      </div>
    </div>
  );
}
