"use client";

import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { deleteDreamAction, reorderDreamsAction } from "@/app/(couple)/actions";
import { DreamForm } from "@/components/dream/dream-form";
import { FormMessage } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { FundingProgress } from "@/components/ui/funding-progress";
import { DREAM_CATEGORY_LABELS, MAX_DREAMS_PER_WEDDING } from "@/modules/dream/dream.schema";
import type { DreamDTO } from "@/modules/wedding/wedding.types";

type Mode = { kind: "list" } | { kind: "new" } | { kind: "edit"; id: string };

export function DreamsManager({ dreams }: { dreams: DreamDTO[] }) {
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const backToList = () => setMode({ kind: "list" });

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    const ids = dreams.map((dream) => dream.id);
    const moved = ids[index];
    const swapped = ids[target];
    if (!moved || !swapped) return;
    ids[index] = swapped;
    ids[target] = moved;
    setBusyId(moved);
    setError(null);
    const result = await reorderDreamsAction(ids);
    setBusyId(null);
    if (!result.ok) setError(result.message);
  }

  async function remove(id: string) {
    setBusyId(id);
    setError(null);
    const result = await deleteDreamAction(id);
    setBusyId(null);
    setConfirmDeleteId(null);
    if (!result.ok) setError(result.message);
  }

  return (
    <section aria-labelledby="dreams-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="dreams-heading" className="text-h2">
          Your dreams
        </h2>
        {mode.kind === "list" && dreams.length < MAX_DREAMS_PER_WEDDING ? (
          <Button onClick={() => setMode({ kind: "new" })}>
            <Plus aria-hidden="true" />
            Add a dream
          </Button>
        ) : null}
      </div>

      {error ? (
        <div className="mt-4">
          <FormMessage tone="error">{error}</FormMessage>
        </div>
      ) : null}

      {mode.kind === "new" ? (
        <div className="bg-card shadow-soft mt-6 rounded-xl border p-6">
          <h3 className="text-h3 mb-5">New dream</h3>
          <DreamForm submitLabel="Add dream" onSaved={backToList} onCancel={backToList} />
        </div>
      ) : null}

      {dreams.length === 0 && mode.kind === "list" ? (
        <div className="bg-card mt-6 rounded-xl border border-dashed p-10 text-center">
          <p className="font-heading text-h3 italic">No dreams yet</p>
          <p className="text-muted-foreground mx-auto mt-2 max-w-sm">
            Add the first thing you would love your guests to help you experience together.
          </p>
        </div>
      ) : null}

      <ul className="mt-6 grid gap-4">
        {dreams.map((dream, index) =>
          mode.kind === "edit" && mode.id === dream.id ? (
            <li key={dream.id} className="bg-card shadow-soft rounded-xl border p-6">
              <h3 className="text-h3 mb-5">Edit dream</h3>
              <DreamForm
                dream={dream}
                submitLabel="Save changes"
                onSaved={backToList}
                onCancel={backToList}
              />
            </li>
          ) : (
            <li
              key={dream.id}
              className="bg-card shadow-soft grid gap-5 rounded-xl border p-5 sm:grid-cols-[9rem_1fr]"
              aria-busy={busyId === dream.id}
            >
              <div className="bg-accent relative aspect-[4/3] overflow-hidden rounded-md">
                {dream.coverImage ? (
                  <Image
                    src={dream.coverImage.url}
                    alt=""
                    fill
                    unoptimized
                    sizes="144px"
                    className="object-cover"
                  />
                ) : null}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="eyebrow">{DREAM_CATEGORY_LABELS[dream.category]}</p>
                  {!dream.isActive ? (
                    <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-medium">
                      Hidden
                    </span>
                  ) : null}
                </div>
                <h3 className="text-h3 mt-2">{dream.title}</h3>
                <FundingProgress
                  className="mt-4"
                  label={dream.title}
                  fundedPaise={dream.fundedPaise}
                  targetPaise={dream.targetPaise}
                />
                <p className="text-muted-foreground mt-2 text-sm">
                  {dream.contributionCount === 1
                    ? "1 contribution"
                    : `${dream.contributionCount} contributions`}
                </p>

                {confirmDeleteId === dream.id ? (
                  <div
                    className="mt-4 flex flex-wrap items-center gap-3"
                    role="alertdialog"
                    aria-label="Confirm removal"
                  >
                    <p className="text-sm">
                      {dream.contributionCount > 0
                        ? "Remove this dream from your page? Its contributions stay on record."
                        : "Delete this dream?"}
                    </p>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={busyId === dream.id}
                      onClick={() => remove(dream.id)}
                    >
                      Yes, remove
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteId(null)}>
                      Keep it
                    </Button>
                  </div>
                ) : (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setMode({ kind: "edit", id: dream.id })}
                    >
                      <Pencil aria-hidden="true" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      aria-label={`Move ${dream.title} up`}
                      disabled={index === 0 || busyId !== null}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp aria-hidden="true" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      aria-label={`Move ${dream.title} down`}
                      disabled={index === dreams.length - 1 || busyId !== null}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Delete ${dream.title}`}
                      onClick={() => setConfirmDeleteId(dream.id)}
                    >
                      <Trash2 aria-hidden="true" />
                      Delete
                    </Button>
                  </div>
                )}
              </div>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}
