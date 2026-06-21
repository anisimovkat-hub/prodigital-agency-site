"use client";

import { useState } from "react";

import { formatDate } from "@/lib/format";
import { NOTE_TYPE_LABEL } from "@/lib/labels";
import type { Enums } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

const NOTE_TYPES: Enums<"note_type">[] = [
  "hypothesis",
  "risk",
  "history",
  "client_note",
];

type Note = {
  id: string;
  type: Enums<"note_type">;
  body: string;
  status: string | null;
  created_at: string | null;
  author: { full_name: string } | null;
};

export function NotesTabs({ notes }: { notes: Note[] }) {
  const [active, setActive] = useState<Enums<"note_type">>("hypothesis");
  const filtered = notes.filter((note) => note.type === active);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 border-b border-neutral-200">
        {NOTE_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setActive(type)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active === type
                ? "border-neutral-900 text-neutral-900"
                : "border-transparent text-neutral-500 hover:text-neutral-800",
            )}
          >
            {NOTE_TYPE_LABEL[type]}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {filtered.length === 0 && (
          <p className="text-sm text-neutral-400">Записей нет.</p>
        )}
        {filtered.map((note) => (
          <div
            key={note.id}
            className="rounded-md border border-neutral-200 p-3 text-sm"
          >
            <div className="flex items-center justify-between text-xs text-neutral-400">
              <span>{note.author?.full_name ?? "—"}</span>
              <span>{formatDate(note.created_at)}</span>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-neutral-800">
              {note.body}
            </p>
            {note.status && (
              <p className="mt-1 text-xs text-neutral-500">
                Статус: {note.status}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
