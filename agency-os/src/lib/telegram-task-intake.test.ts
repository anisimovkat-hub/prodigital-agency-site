import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ service: vi.fn(), preview: vi.fn(), send: vi.fn(), answer: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: mocks.service }));
vi.mock("@/lib/telegram-task-previews", () => ({ sendTelegramTaskPreview: mocks.preview, createTelegramTaskPreviews: vi.fn(), resendOpenTelegramTaskPreviews: vi.fn() }));
vi.mock("@/lib/telegram", () => ({ sendTelegramMessage: mocks.send, answerCallbackQuery: mocks.answer }));
vi.mock("@/lib/telegram-weekly-statuses", () => ({ sendOwnerWeeklyStatusPreview: vi.fn() }));
import { handleTelegramTaskText } from "./telegram-task-intake";
import { POST } from "@/app/api/telegram/webhook/route";

type Row = Record<string, unknown>;
type Filter = [string, "eq" | "neq" | "in", unknown];
const PROJECT = "10000000-0000-4000-8000-000000000001";
const STAFF = "20000000-0000-4000-8000-000000000001";
const OWNER = "20000000-0000-4000-8000-000000000002";
const OLD_TASK = "30000000-0000-4000-8000-000000000001";
const OLD_DRAFT = "40000000-0000-4000-8000-000000000001";
const CHAT = "123";
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

/** In-memory PostgREST boundary. Deliberately emulate the old SQL edit keeping
 * status/priority, so a stale edit would overwrite the old task and fail tests.
 * No real DB, API, message delivery or production identifiers are used. */
class Database {
  tables: Record<string, Row[]> = {
    projects: [{ id: PROJECT, name: "ESTT", aliases: [], stage: "active", responsible_id: STAFF, clients: null }],
    profiles: [{ id: STAFF, full_name: "Илона", aliases: ["Илоне"], is_active: true }, { id: OWNER, full_name: "Катерина", aliases: [], is_active: true }],
    project_members: [], project_responsibles: [],
    telegram_bot_settings: [{ setting_key: "owner_chat_id", setting_value: CHAT }],
    tasks: [{ id: OLD_TASK, project_id: PROJECT, assignee_id: STAFF, creator_id: OWNER, title: "Прежняя задача", description: "Прежнее описание", due_date: "2026-10-20", status: "paused", priority: "high", owner_approval_pending: false }],
    telegram_task_drafts: [{ id: OLD_DRAFT, task_id: OLD_TASK, review_chat_id: CHAT, status: "editing", expires_at: null, updated_at: "2026-10-27T06:00:00Z" }],
    telegram_task_intakes: [], telegram_intake_messages: [],
  };
  writes: { table: string; values: Row; filters: Filter[] }[] = [];
  rpcCalls: { name: string; args: Row }[] = [];
  createdTasks = 0;
  editedTasks = 0;
  beforeDraftRelease: (() => void) | null = null;
  commitResult: unknown = undefined;

  from(table: string) {
    const filters: Filter[] = [];
    let values: Row | null = null, limit = Infinity, order: { column: string; ascending: boolean } | null = null;
    const execute = () => {
      if (table === "telegram_task_drafts" && values?.status === "cancelled" && this.beforeDraftRelease) {
        const hook = this.beforeDraftRelease; this.beforeDraftRelease = null; hook();
      }
      let rows = this.tables[table].filter((row) => filters.every(([key, op, value]) => op === "eq" ? row[key] === value : op === "neq" ? row[key] !== value : (value as unknown[]).includes(row[key])));
      if (order) { const sorting = order; rows = [...rows].sort((a, b) => String(a[sorting.column] ?? "").localeCompare(String(b[sorting.column] ?? "")) * (sorting.ascending ? 1 : -1)); }
      rows = rows.slice(0, limit);
      if (values) {
        this.writes.push({ table, values: clone(values), filters: clone(filters) });
        for (const row of rows) Object.assign(row, clone(values));
      }
      return rows.map((row) => table === "tasks" ? clone({ ...row, projects: this.tables.projects.find((p) => p.id === row.project_id) ?? null }) : clone(row));
    };
    const query = {
      select: () => query,
      eq: (column: string, value: unknown) => { filters.push([column, "eq", value]); return query; },
      neq: (column: string, value: unknown) => { filters.push([column, "neq", value]); return query; },
      in: (column: string, value: unknown[]) => { filters.push([column, "in", value]); return query; },
      order: (column: string, options: { ascending: boolean }) => { order = { column, ...options }; return query; },
      limit: (value: number) => { limit = value; return query; },
      update: (value: Row) => { values = value; return query; },
      maybeSingle: async () => { const rows = execute(); return { data: rows[0] ?? null, error: rows.length > 1 ? { code: "multiple" } : null }; },
      single: async () => { const rows = execute(); return { data: rows[0] ?? null, error: rows.length !== 1 ? { code: "missing" } : null }; },
      then: (resolve: (value: { data: Row[]; error: null }) => unknown) => Promise.resolve({ data: execute(), error: null }).then(resolve),
    };
    return query;
  }

  async rpc(name: string, args: Row = {}) {
    this.rpcCalls.push({ name, args: clone(args) });
    if (name === "expire_telegram_intake_drafts") return { data: 0, error: null };
    if (name === "start_telegram_task_intake") {
      const receipt = this.tables.telegram_intake_messages.find((r) => r.chat_id === args.p_chat_id && r.message_id === args.p_message_id);
      if (receipt) return { data: receipt.intake_id, error: null };
      const id = `50000000-0000-4000-8000-${String(this.tables.telegram_task_intakes.length + 1).padStart(12, "0")}`;
      this.tables.telegram_task_intakes.push({ id, chat_id: args.p_chat_id, source_message_id: args.p_message_id, items: clone(args.p_items), edit_draft_id: args.p_edit_draft_id ?? null, current_index: 0, revision: 0, choices: [], pending_field: null, status: "pending" });
      this.tables.telegram_intake_messages.push({ chat_id: args.p_chat_id, message_id: args.p_message_id, intake_id: id });
      return { data: id, error: null };
    }
    if (name === "commit_telegram_intake_item") {
      if (this.commitResult !== undefined) return { data: this.commitResult, error: null };
      const intake = this.tables.telegram_task_intakes.find((r) => r.id === args.p_intake_id)!;
      const item = (intake.items as Row[])[args.p_index as number];
      if (item.taskId) return { data: item.taskId, error: null };
      let task: Row;
      if (intake.edit_draft_id) {
        const draft = this.tables.telegram_task_drafts.find((r) => r.id === intake.edit_draft_id)!;
        task = this.tables.tasks.find((r) => r.id === draft.task_id)!;
        this.editedTasks++;
      } else {
        task = { id: `60000000-0000-4000-8000-${String(++this.createdTasks).padStart(12, "0")}`, status: "todo", priority: "medium", owner_approval_pending: true, creator_id: OWNER };
        this.tables.tasks.push(task);
      }
      Object.assign(task, { project_id: item.projectId, assignee_id: item.assigneeId, title: item.title, description: item.description, due_date: item.dueDate });
      item.taskId = task.id;
      return { data: task.id, error: null };
    }
    throw new Error(`Unexpected fixture RPC ${name}`);
  }
}

let db: Database;
beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-29T12:00:00Z"));
  vi.stubEnv("VERCEL_ENV", "production"); vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "test-only-secret");
  db = new Database(); mocks.service.mockImplementation(() => db);
  mocks.preview.mockResolvedValue(true); mocks.send.mockResolvedValue({ message_id: 1 });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe("text intake against stale editing contexts", () => {
  it.each(["paused", "done", "cancelled"])("preserves the %s morning task and creates a separate todo owner draft", async (status) => {
    db.tables.tasks[0].status = status;
    const old = clone(db.tables.tasks[0]);
    await handleTelegramTaskText(CHAT, 101, "Илоне ESTT завтра отчёт");
    expect(db.tables.tasks[0]).toEqual(old);
    expect(db.editedTasks).toBe(0); expect(db.createdTasks).toBe(1);
    expect(db.tables.tasks[1]).toMatchObject({ status: "todo", priority: "medium", title: "отчёт", assignee_id: STAFF, owner_approval_pending: true });
    expect(db.tables.telegram_task_drafts[0].status).toBe("cancelled");
    expect(db.tables.telegram_task_intakes[0]).toMatchObject({ edit_draft_id: null, current_index: 1, status: "complete" });
    expect(mocks.preview).toHaveBeenCalledWith(db.tables.tasks[1].id, { refreshPending: true });
    expect(db.rpcCalls.some((call) => call.name === "cancel_telegram_task_draft")).toBe(false);
    expect(db.writes.find((write) => write.table === "telegram_task_drafts")?.filters).toEqual(expect.arrayContaining([
      ["id", "eq", OLD_DRAFT], ["task_id", "eq", OLD_TASK], ["review_chat_id", "eq", CHAT], ["status", "eq", "editing"],
    ]));
  });

  it.each(["paused", "finished"])("does not edit an apparently active task in a %s project", async (stage) => {
    db.tables.projects.push({ id: "10000000-0000-4000-8000-000000000002", name: "Другой проект", aliases: [], stage, responsible_id: STAFF });
    db.tables.tasks[0].project_id = db.tables.projects[1].id; db.tables.tasks[0].status = "todo";
    const old = clone(db.tables.tasks[0]);
    await handleTelegramTaskText(CHAT, 101, "Илоне ESTT завтра отчёт");
    expect(db.tables.tasks[0]).toEqual(old); expect(db.editedTasks).toBe(0); expect(db.createdTasks).toBe(1);
    expect(db.tables.telegram_task_drafts[0].status).toBe("cancelled");
  });

  it("preserves legitimate active edits and passes their existing draft to the shared preview", async () => {
    db.tables.tasks[0].status = "todo";
    await handleTelegramTaskText(CHAT, 101, "срок завтра");
    expect(db.createdTasks).toBe(0); expect(db.editedTasks).toBe(1);
    expect(db.tables.tasks[0]).toMatchObject({ title: "Прежняя задача", status: "todo", priority: "high", due_date: "2026-10-30" });
    expect(db.tables.telegram_task_drafts[0].status).toBe("editing");
    expect(mocks.preview).toHaveBeenCalledWith(OLD_TASK, { refreshPending: true, existingDraftId: OLD_DRAFT });
  });

  it("closes a pending clarification of the stale edit before treating the new text as a new task", async () => {
    const old = clone(db.tables.tasks[0]);
    db.tables.telegram_task_intakes.push({ id: "50000000-0000-4000-8000-000000000001", chat_id: CHAT,
      source_message_id: 100, items: [{ title: "Старая правка" }], edit_draft_id: OLD_DRAFT,
      current_index: 0, revision: 0, choices: [], pending_field: "title", status: "pending" });
    await handleTelegramTaskText(CHAT, 101, "Илоне ESTT завтра отчёт");
    expect(db.tables.tasks[0]).toEqual(old); expect(db.editedTasks).toBe(0); expect(db.createdTasks).toBe(1);
    expect(db.tables.telegram_task_intakes[0]).toMatchObject({ status: "cancelled", revision: 1 });
    expect(db.tables.telegram_task_intakes[1]).toMatchObject({ status: "complete", edit_draft_id: null });
  });

  it("does not replay a stored edit intake into a task that has since paused", async () => {
    const old = clone(db.tables.tasks[0]);
    const id = "50000000-0000-4000-8000-000000000001";
    db.tables.telegram_task_intakes.push({ id, chat_id: CHAT, source_message_id: 100,
      items: [{ title: "Не перезаписывать", source: "", projectId: PROJECT, assigneeId: STAFF, dueDate: null, deadlineKnown: true }],
      edit_draft_id: OLD_DRAFT, current_index: 0, revision: 0, choices: [], pending_field: null, status: "pending" });
    db.tables.telegram_intake_messages.push({ chat_id: CHAT, message_id: 100, intake_id: id });
    await expect(handleTelegramTaskText(CHAT, 100, "retry")).rejects.toThrow("Editing target is no longer operational");
    expect(db.tables.tasks[0]).toEqual(old); expect(db.editedTasks).toBe(0);
    expect(db.rpcCalls.some((call) => call.name === "commit_telegram_intake_item")).toBe(false);
    expect(mocks.preview).not.toHaveBeenCalled();
  });

  it("resumes an already committed active edit after its draft left editing without another task update", async () => {
    db.tables.tasks[0].status = "todo"; db.tables.telegram_task_drafts[0].status = "pending_approval";
    const id = "50000000-0000-4000-8000-000000000001";
    const old = clone(db.tables.tasks[0]);
    db.tables.telegram_task_intakes.push({ id, chat_id: CHAT, source_message_id: 100,
      items: [{ taskId: OLD_TASK, title: "Прежняя задача", source: "", projectId: PROJECT, assigneeId: STAFF, dueDate: null, deadlineKnown: true }],
      edit_draft_id: OLD_DRAFT, current_index: 0, revision: 0, choices: [], pending_field: null, status: "pending" });
    db.tables.telegram_intake_messages.push({ chat_id: CHAT, message_id: 100, intake_id: id });
    await handleTelegramTaskText(CHAT, 100, "retry");
    expect(db.tables.tasks[0]).toEqual(old); expect(db.editedTasks).toBe(0); expect(db.createdTasks).toBe(0);
    expect(db.tables.telegram_task_intakes[0]).toMatchObject({ status: "complete", current_index: 1 });
    expect(mocks.preview).toHaveBeenCalledWith(OLD_TASK, { refreshPending: true, existingDraftId: OLD_DRAFT });
  });

  it("stops if the editing draft changed concurrently instead of overriding its new state", async () => {
    const old = clone(db.tables.tasks[0]);
    db.beforeDraftRelease = () => { db.tables.telegram_task_drafts[0].status = "sent"; };
    await expect(handleTelegramTaskText(CHAT, 101, "Илоне ESTT завтра отчёт")).rejects.toThrow("Editing context changed before release");
    expect(db.tables.tasks[0]).toEqual(old); expect(db.createdTasks).toBe(0); expect(db.editedTasks).toBe(0);
    expect(db.tables.telegram_task_drafts[0].status).toBe("sent"); expect(mocks.preview).not.toHaveBeenCalled();
  });

  it("does not advance or create the next task after false preview; retry uses the persisted task id", async () => {
    db.tables.telegram_task_drafts = []; mocks.preview.mockResolvedValue(false);
    await expect(handleTelegramTaskText(CHAT, 101, "Илоне ESTT завтра отчёт\nИлоне ESTT завтра проверить рекламу")).rejects.toThrow("Owner task preview was not confirmed");
    expect(db.createdTasks).toBe(1);
    const session = db.tables.telegram_task_intakes[0];
    expect(session).toMatchObject({ current_index: 0, revision: 0, status: "pending" });
    expect((session.items as Row[])[0].taskId).toBe(db.tables.tasks[1].id);
    expect((session.items as Row[])[0].previewed).toBeUndefined();
    expect(db.writes.filter((write) => write.table === "telegram_task_intakes")).toEqual([]);
    await expect(handleTelegramTaskText(CHAT, 101, "Илоне ESTT завтра отчёт")).rejects.toThrow("Owner task preview was not confirmed");
    expect(db.createdTasks).toBe(1);
    mocks.preview.mockResolvedValue(true);
    await handleTelegramTaskText(CHAT, 101, "ignored duplicate contents");
    expect(db.createdTasks).toBe(2); expect(session.status).toBe("complete"); expect(session.current_index).toBe(2);
  });

  it.each([null, "", "not-a-uuid"])("rejects an unconfirmed RPC task id (%j) before preview or state advancement", async (value) => {
    db.tables.telegram_task_drafts = []; db.commitResult = value;
    await expect(handleTelegramTaskText(CHAT, 101, "Илоне ESTT завтра отчёт")).rejects.toThrow("Task commit was not confirmed");
    expect(mocks.preview).not.toHaveBeenCalled();
    expect(db.tables.telegram_task_intakes[0]).toMatchObject({ current_index: 0, status: "pending" });
  });
});

describe("edit callback for stopped work", () => {
  const request = () => new Request("https://example.test/api/telegram/webhook", { method: "POST", headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": "test-only-secret" }, body: JSON.stringify({ callback_query: { id: "synthetic-callback", from: { id: 123 }, data: `tg:edit:${OLD_DRAFT}`, message: { message_id: 1, chat: { id: 123, type: "private" } } } }) });
  it.each(["paused", "done", "cancelled"])("refuses %s before setting editing", async (status) => {
    db.tables.tasks[0].status = status; db.tables.telegram_task_drafts[0].status = "pending_approval";
    expect((await POST(request())).status).toBe(200);
    expect(db.tables.telegram_task_drafts[0].status).toBe("pending_approval");
    expect(mocks.answer).toHaveBeenCalledWith("synthetic-callback", expect.stringContaining("остановлены"));
    expect(mocks.send).not.toHaveBeenCalled(); expect(db.editedTasks).toBe(0);
  });
  it("refuses a stopped project but preserves an active edit callback", async () => {
    db.tables.tasks[0].status = "todo"; db.tables.telegram_task_drafts[0].status = "pending_approval";
    db.tables.projects[0].stage = "finished";
    await POST(request()); expect(db.tables.telegram_task_drafts[0].status).toBe("pending_approval");
    expect(mocks.send).not.toHaveBeenCalled();
    db.tables.projects[0].stage = "active";
    await POST(request()); expect(db.tables.telegram_task_drafts[0].status).toBe("editing");
    expect(mocks.send).toHaveBeenCalledWith(CHAT, expect.stringContaining("Пришлите новый текст"));
  });
});
