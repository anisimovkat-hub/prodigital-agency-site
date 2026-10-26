import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { createEmployee } from "@/app/(dashboard)/employees/actions";

function database({ user = "owner-id" as string | null, role = "owner", names = [] as string[], lookupError = false, inserted = true, insertError = null as { code: string } | null } = {}) {
  const inserts: unknown[] = [];
  const from = vi.fn((table: string) => {
    if (table !== "profiles") throw new Error(`Unexpected write target: ${table}`);
    return {
      select: (fields: string) => fields === "role"
        ? { eq: () => ({ maybeSingle: async () => ({ data: { role }, error: null }) }) }
        : Promise.resolve({ data: names.map((full_name, i) => ({ id: String(i), full_name })), error: lookupError ? { message: "offline" } : null }),
      insert: (values: unknown) => {
        inserts.push(values);
        return { select: () => ({ maybeSingle: async () => ({ data: inserted ? { id: "employee-id", full_name: "Виолетта" } : null, error: insertError }) }) };
      },
    };
  });
  mocks.createClient.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: user ? { id: user } : null } }) }, from });
  return { from, inserts };
}

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

describe("manual employee creation", () => {
  beforeEach(() => vi.resetAllMocks());

  it("creates an assignable profile without an auth account, contact details or invitation", async () => {
    const db = database();
    const result = await createEmployee(undefined, form({ full_name: "  Виолетта  ", role: "owner", id: "attacker-chosen", auth_user_id: "owner-id" }));
    expect(db.inserts).toEqual([{ full_name: "Виолетта", position_title: null, role: "specialist", is_manual: true, auth_user_id: null, is_active: true }]);
    expect(result).toEqual({ employee: { id: "employee-id", name: "Виолетта" } });
    expect(db.from.mock.calls.every(([table]) => table === "profiles")).toBe(true);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/tasks");
  });

  it.each(["specialist", "pm", "viewer"])("blocks creation by a %s", async role => {
    const db = database({ role });
    expect(await createEmployee(undefined, form({ full_name: "Виолетта" }))).toHaveProperty("error");
    expect(db.inserts).toEqual([]);
  });

  it("requires a signed-in owner and valid name", async () => {
    const db = database({ user: null });
    expect(await createEmployee(undefined, form({ full_name: "Виолетта" }))).toHaveProperty("error");
    expect(await createEmployee(undefined, form({ full_name: "   " }))).toHaveProperty("error");
    expect(db.inserts).toEqual([]);
  });

  it("does not duplicate a profile or write when duplicate checking failed", async () => {
    let db = database({ names: ["виолетта"] });
    expect(await createEmployee(undefined, form({ full_name: "Виолетта" }))).toHaveProperty("error");
    expect(db.inserts).toEqual([]);
    db = database({ lookupError: true });
    expect(await createEmployee(undefined, form({ full_name: "Виолетта" }))).toHaveProperty("error");
    expect(db.inserts).toEqual([]);
  });

  it("does not announce success without a confirmed inserted row", async () => {
    database({ inserted: false });
    expect(await createEmployee(undefined, form({ full_name: "Виолетта" }))).toHaveProperty("error");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
