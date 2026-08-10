export const PROJECT_LOGO_BY_ID: Record<string, string> = {
  "89131769-59f2-4f56-988b-0aa86da6e2ff": "/project-logos/vfla.svg",
  "48a4c2ee-7e5b-4200-a876-0c43b84a637c": "/project-logos/leaders-first.png",
  "c83829ad-df22-45a7-91a7-01dc3c94ceb9": "/project-logos/dr-bakers.svg",
  "80ab2a07-259c-45fc-b449-9ec7238f9f15": "/project-logos/ansaligy.svg",
  "c5c2bbf1-4ea6-4e49-b469-1416710d7dbd": "/project-logos/estt.svg",
  "e5a66e71-b972-4fbb-b5f4-68c8614916b6": "/project-logos/kolvika.svg",
  "fc238ccb-2568-4045-b08d-fef82143cfb9": "/project-logos/paks.svg",
  "8774888c-5148-44cd-85a2-084956ad89d9": "/project-logos/team-trip.png",
  "d210b7e7-480f-4260-881c-cde4e3522b5e": "/project-logos/vard.svg",
  "a2abaaa6-d3f2-40bf-8757-60f408dc7b7d": "/project-logos/system-r.svg",
  "4f74caf4-c640-41f8-b263-5dea5047e2de": "/project-logos/coral-travel.svg",
  "d6c28a21-dbe6-478f-a30e-e02ffc2a08be": "/project-logos/polaris.svg",
};

export function projectLogoUrl(
  projectId: string | null | undefined,
  explicitLogoUrl?: string | null,
): string | null {
  const explicit = explicitLogoUrl?.trim();
  if (explicit) return explicit;
  if (!projectId) return null;
  return PROJECT_LOGO_BY_ID[projectId] ?? null;
}
