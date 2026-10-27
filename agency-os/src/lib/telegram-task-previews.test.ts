import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const mocks = vi.hoisted(() => ({ client: vi.fn(), send: vi.fn(), recipient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: mocks.client }));
vi.mock("@/lib/telegram", () => ({ sendTelegramMessage: mocks.send }));
vi.mock("@/lib/telegram-recipient", () => ({ resolveTelegramRecipientChatId: mocks.recipient }));
import { createTelegramTaskPreviews } from "./telegram-task-previews";

// In-memory data boundary: exercise real selection, formatting and draft lifecycle.
// No Telegram, credentials or production database are used by these tests.
let tables: Record<string, Row[]>;
let nextId: number;
class Query {
  private filters: ((row: Row) => boolean)[] = [];
  private patch: Row | null = null;
  private addition: Row | null = null;
  constructor(private table: string) {}
  select() { return this; }
  eq(key: string, value: unknown) { this.filters.push((r) => r[key] === value); return this; }
  in(key: string, values: unknown[]) { this.filters.push((r) => values.includes(r[key])); return this; }
  not(key: string, op: string, value: unknown) {
    const values = op === "in" ? String(value).slice(1, -1).split(",") : [];
    this.filters.push((r) => op === "in" ? !values.includes(String(r[key])) : r[key] != null);
    return this;
  }
  update(patch: Row) { this.patch = patch; return this; }
  insert(addition: Row) { this.addition = addition; return this; }
  private execute() {
    if (this.addition) {
      const row = { id: `draft-${nextId++}`, ...this.addition }; tables[this.table].push(row);
      this.addition = null; return [row];
    }
    const rows = tables[this.table].filter((r) => this.filters.every((matches) => matches(r)));
    if (this.patch) rows.forEach((r) => Object.assign(r, this.patch));
    return rows;
  }
  async maybeSingle() { return { data: this.execute()[0] ?? null, error: null }; }
  async single() { return this.maybeSingle(); }
  then(resolve: (result: { data: Row[]; error: null }) => unknown) { return Promise.resolve({ data: this.execute(), error: null }).then(resolve); }
}
const now = new Date("2026-10-27T06:00:00Z"); // 09:00 Moscow.
const task = (id: string, changes: Row = {}): Row => ({
  id, title: "Подготовить отчёт", description: "Добавить лиды", due_date: "2026-10-28",
  assignee_id: "ilona", status: "todo", owner_approval_pending: false, workstream: null,
  projects: { name: "Team Trip" }, assignee: { full_name: "Илона" }, ...changes,
});
const draft = (status: string, changes: Row = {}): Row => ({ id: "existing", task_id: "eligible", source_date: "2026-10-28", status, review_message_id: 99, expires_at: null, ...changes });

beforeEach(() => {
  vi.clearAllMocks(); nextId = 1;
  tables = { tasks: [], telegram_task_drafts: [], telegram_bot_settings: [{ setting_key: "owner_chat_id", setting_value: "owner-test-chat" }] };
  mocks.client.mockReturnValue({ from: (table: string) => new Query(table), rpc: vi.fn().mockResolvedValue({ data: 0, error: null }) });
  mocks.recipient.mockImplementation(async (id: string) => id === "ilona" ? "staff-test-chat" : null);
  mocks.send.mockResolvedValue({ message_id: 100 });
});

describe("09:00 Moscow owner drafts — regression", () => {
  it("selects only tomorrow's assigned active tasks and sends to the owner", async () => {
    tables.tasks.push(task("eligible"), task("today", { due_date: "2026-10-27" }), task("unassigned", { assignee_id: null }), task("done", { status: "done" }), task("cancelled", { status: "cancelled" }), task("paused", { status: "paused" }), task("unbound", { assignee_id: "unbound" }));
    expect(await createTelegramTaskPreviews(now)).toEqual({ created: 1, skipped: null });
    expect(mocks.send).toHaveBeenCalledTimes(1);
    const [chat, text, buttons] = mocks.send.mock.calls[0];
    expect(chat).toBe("owner-test-chat");
    expect(text).toContain("Team Trip // Подготовить отчёт");
    expect(text).toContain("28.10 (СР)");
    expect(buttons[0].map((b: { callback_data: string }) => b.callback_data)).toEqual(["tg:send:draft-1", "tg:edit:draft-1"]);
    expect(tables.telegram_task_drafts).toHaveLength(1);
    expect(tables.telegram_task_drafts[0]).toMatchObject({ task_id: "eligible", source_date: "2026-10-28", recipient_chat_id: "staff-test-chat", review_chat_id: "owner-test-chat", expires_at: null });
    expect(tables.tasks).toHaveLength(7);
    expect(tables.tasks[0]).toMatchObject({ status: "todo", owner_approval_pending: false });
  });
  it("does not resend a successful morning draft on a repeated cron run", async () => {
    tables.tasks.push(task("eligible"));
    await createTelegramTaskPreviews(now);
    expect(await createTelegramTaskPreviews(now)).toEqual({ created: 0, skipped: null });
    expect(mocks.send).toHaveBeenCalledTimes(1); expect(tables.telegram_task_drafts).toHaveLength(1);
  });
  it.each(["sent", "sending", "cancelled", "editing", "pending_approval"])("does not resend an existing %s draft", async (status) => {
    tables.tasks.push(task("eligible")); tables.telegram_task_drafts.push(draft(status));
    expect((await createTelegramTaskPreviews(now)).created).toBe(0);
    expect(mocks.send).not.toHaveBeenCalled();
    expect(tables.tasks[0].status).toBe("todo");
  });
  it("retries a failed draft using its existing row", async () => {
    tables.tasks.push(task("eligible")); tables.telegram_task_drafts.push(draft("failed"));
    expect((await createTelegramTaskPreviews(now)).created).toBe(1);
    expect(tables.telegram_task_drafts).toHaveLength(1);
    expect(tables.telegram_task_drafts[0]).toMatchObject({ id: "existing", status: "pending_approval", expires_at: null });
  });
  it("keeps a failed delivery retryable without creating another CRM task", async () => {
    tables.tasks.push(task("eligible")); mocks.send.mockRejectedValueOnce(new Error("network unavailable"));
    await expect(createTelegramTaskPreviews(now)).rejects.toThrow("Owner preview delivery failed");
    expect(tables.telegram_task_drafts[0].status).toBe("failed");
    expect((await createTelegramTaskPreviews(now)).created).toBe(1);
    expect(tables.telegram_task_drafts).toHaveLength(1); expect(tables.tasks).toHaveLength(1);
  });
  it("uses Moscow tomorrow across the UTC day boundary", async () => {
    tables.tasks.push(task("eligible", { due_date: "2026-10-29" }));
    expect((await createTelegramTaskPreviews(new Date("2026-10-27T21:30:00Z"))).created).toBe(1);
    expect(tables.telegram_task_drafts[0].source_date).toBe("2026-10-29");
  });
  it("only refreshes a pending draft when explicitly requested by the owner", async () => {
    tables.tasks.push(task("eligible")); tables.telegram_task_drafts.push(draft("pending_approval"));
    expect((await createTelegramTaskPreviews(now, { refreshPending: true })).created).toBe(1);
    expect(tables.telegram_task_drafts).toHaveLength(1);
  });
  it("skips delivery when the owner is not paired", async () => {
    tables.telegram_bot_settings = []; tables.tasks.push(task("eligible"));
    expect(await createTelegramTaskPreviews(now)).toEqual({ created: 0, skipped: "owner_not_paired" });
    expect(mocks.send).not.toHaveBeenCalled(); expect(tables.telegram_task_drafts).toHaveLength(0);
  });
});
