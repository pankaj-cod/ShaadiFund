"use client";
// Adapted from Aceternity UI (https://ui.aceternity.com), restyled to ShaadiFund's design tokens.
import { motion, stagger, useAnimate } from "motion/react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

/**
 * Reveals text word by word. Renders only inline elements, so it can sit inside
 * a heading, and inherits colour, size and weight from its parent.
 */
export function TextGenerateEffect({
  words,
  className,
  duration = 0.6,
}: {
  words: string;
  className?: string;
  duration?: number;
}) {
  const [scope, animate] = useAnimate<HTMLSpanElement>();

  useEffect(() => {
    void animate("span", { opacity: 1, filter: "blur(0px)" }, { duration, delay: stagger(0.12) });
  }, [animate, duration, words]);

  return (
    <motion.span ref={scope} className={cn("inline", className)}>
      {words.split(" ").map((word, index) => (
        <motion.span
          key={`${word}-${index}`}
          className="inline-block opacity-0"
          style={{ filter: "blur(8px)" }}
        >
          {word}
          {"\u00a0"}
        </motion.span>
      ))}
    </motion.span>
  );
}
