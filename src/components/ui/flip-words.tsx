"use client";
// Adapted from Aceternity UI's "Flip Words" (https://ui.aceternity.com), restyled for ShaadiFund.
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** Cycles through phrases, each one arriving letter by letter and leaving in a soft blur. */
export function FlipWords({
  words,
  duration = 3200,
  className,
}: {
  words: readonly string[];
  duration?: number;
  className?: string;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (words.length < 2) return;
    const timer = setInterval(() => setIndex((current) => (current + 1) % words.length), duration);
    return () => clearInterval(timer);
  }, [words.length, duration]);

  const phrase = words[index] ?? "";

  return (
    <span className="relative inline-block" aria-live="off">
      {/* Screen readers get the whole list once, not a word changing every few seconds. */}
      <span className="sr-only">{words.join(", ")}</span>
      <AnimatePresence mode="wait">
        <motion.span
          key={phrase}
          aria-hidden="true"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16, filter: "blur(8px)" }}
          transition={{ duration: 0.35 }}
          className={cn("inline-block", className)}
        >
          {phrase.split("").map((letter, letterIndex) => (
            <motion.span
              key={`${phrase}-${letterIndex}`}
              initial={{ opacity: 0, y: 8, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ delay: letterIndex * 0.03, duration: 0.25 }}
              className="inline-block whitespace-pre"
            >
              {letter}
            </motion.span>
          ))}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
