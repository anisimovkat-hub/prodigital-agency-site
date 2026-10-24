import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), redirect: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { addClient } from "@/app/(dashboard)/clients/actions";
import { addProject } from "@/app/(dashboard)/projects/actions";

const clientId = "00000000-0000-4000-8000-000000000001";
const projectId = "00000000-0000-4000-8000-000000000002";

function database({ insertId = projectId as string | null, stagesError = null as { message: string } | null } = {}) {
  const inserts: { table: string; values: unknown }[] = [];
  const updates: { table: string; values: unknown; id: string }[] = [];
  mocks.createClient.mockResolvedValue({
    from: (table: string) => ({
      insert: (values: unknown) => {
        inserts.push({ table, values });
        return { select: () => ({ maybeSingle: async () => ({ data: insertId ? { id: insertId } : null, error: null }) }) };
      },
      select: () => ({ eq: async () => ({ data: stagesError ? null : [{ stage: "active" }], error: stagesError }) }),
      update: (values: unknown) => ({ eq: (_key: string, id: string) => {
        updates.push({ table, values, id });
        return { select: () => ({ maybeSingle: async () => ({ data: { id }, error: null }) }) };
      } }),
    }),
  });
  return { inserts, updates };
}

function form(values: Record<string, string>) {
  const result = new FormData();
  for (const [key, value] of Object.entries(values)) result.set(key, value);
  return result;
}

describe("client → project creation", () => {
  beforeEach(() => vi.resetAllMocks());

  it("opens the saved client's card so the next step is adding its first project", async () => {
    database({ insertId: clientId });
    await addClient(undefined, form({ name: "Новый клиент", status: "active" }));
    expect(mocks.redirect).toHaveBeenCalledWith(`/clients/${clientId}?new=1`);
  });

  it("does not navigate after an unconfirmed insert", async () => {
    database({ insertId: null });
    const result = await addClient(undefined, form({ name: "Новый клиент", status: "active" }));
    expect(result?.errors.name).toBeDefined();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("links a new project to its client and refreshes that client's project list", async () => {
    const db = database();
    const result = await addProject(undefined, form({ name: "Инструменты", client_id: clientId, health: "green", stage: "active" }));
    expect(db.inserts).toEqual([{ table: "projects", values: expect.objectContaining({ name: "Инструменты", client_id: clientId }) }]);
    expect(db.updates).toEqual([{ table: "clients", id: clientId, values: { status: "active" } }]);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/clients/${clientId}`);
    expect(result).toMatchObject({ success: true, createdProject: { id: projectId, name: "Инструменты" } });
  });

  it("does not archive the client if its project stages could not be read", async () => {
    const db = database({ stagesError: { message: "Нет соединения" } });
    const result = await addProject(undefined, form({ name: "Инструменты", client_id: clientId, health: "green", stage: "active" }));
    expect(db.updates).toEqual([]);
    expect(result).toMatchObject({ success: true, createdProject: { id: projectId }, warning: expect.stringContaining("Нет соединения") });
  });
});
