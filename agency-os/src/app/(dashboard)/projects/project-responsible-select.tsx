"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import {
  updateProjectResponsibles,
  type ProjectResponsiblesFormState,
} from "@/app/(dashboard)/projects/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

type Profile = { id: string; full_name: string };

type ProjectResponsibleSelectProps = {
  projectId: string;
  projectName: string;
  profiles: Profile[];
  selectedResponsibles: Profile[];
};

export function ProjectResponsibleSelect({
  projectId,
  projectName,
  profiles,
  selectedResponsibles,
}: ProjectResponsibleSelectProps) {
  const [state, formAction, pending] = useActionState<
    ProjectResponsiblesFormState,
    FormData
  >(updateProjectResponsibles, undefined);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [selectedIds, setSelectedIds] = useState(
    () => selectedResponsibles.map((profile) => profile.id),
  );

  useEffect(() => {
    if (state?.success) detailsRef.current?.removeAttribute("open");
  }, [state]);

  const selectedNames = profiles
    .filter((profile) => selectedIds.includes(profile.id))
    .map((profile) => profile.full_name);
  const label = selectedNames.length ? selectedNames.join(", ") : "Не назначен";

  function toggleProfile(profileId: string) {
    setSelectedIds((current) =>
      current.includes(profileId)
        ? current.filter((id) => id !== profileId)
        : [...current, profileId],
    );
  }

  return (
    <details ref={detailsRef} className="relative min-w-44">
      <summary
        className="flex h-8 cursor-pointer list-none items-center justify-between gap-2 rounded-md px-2 text-left text-sm text-neutral-800 outline-none transition-colors hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-neutral-400 [&::-webkit-details-marker]:hidden"
        aria-label={`Изменить ответственных проекта «${projectName}»`}
        title={label}
      >
        <span className="max-w-52 truncate">{label}</span>
        <span aria-hidden="true" className="text-neutral-400">⌄</span>
      </summary>

      <form
        action={formAction}
        className="absolute z-20 mt-1 w-72 rounded-lg border border-neutral-200 bg-white p-3 shadow-lg"
      >
        <input type="hidden" name="id" value={projectId} />
        <p className="mb-2 text-xs font-medium text-neutral-500">
          Ответственные
        </p>
        <div className="max-h-56 space-y-1 overflow-y-auto">
          {profiles.map((profile) => {
            const checked = selectedIds.includes(profile.id);
            return (
              <label
                key={profile.id}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-neutral-50"
              >
                <Checkbox
                  checked={checked}
                  disabled={pending}
                  onChange={() => toggleProfile(profile.id)}
                />
                <span>{profile.full_name}</span>
              </label>
            );
          })}
        </div>
        {selectedIds.map((profileId) => (
          <input key={profileId} type="hidden" name="responsible_ids" value={profileId} />
        ))}
        <div className="mt-3 flex items-center gap-2">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Сохраняем..." : "Сохранить"}
          </Button>
          <span aria-live="polite" className="text-xs text-red-600">
            {state?.error ?? ""}
          </span>
        </div>
      </form>
    </details>
  );
}
