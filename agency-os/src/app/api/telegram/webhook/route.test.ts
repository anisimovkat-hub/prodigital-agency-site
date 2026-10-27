import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  send: vi.fn(), answer: vi.fn(), intake: vi.fn(), choice: vi.fn(), voice: vi.fn(), previews: vi.fn(), resend: vi.fn(),
  rpc: vi.fn(), from: vi.fn(),
}));
vi.mock("@/lib/telegram", () => ({ sendTelegramMessage: mocks.send, answerCallbackQuery: mocks.answer }));
vi.mock("@/lib/telegram-task-intake", () => ({ handleTelegramTaskText: mocks.intake, handleTelegramIntakeChoice: mocks.choice, queueTelegramVoice: mocks.voice }));
vi.mock("@/lib/telegram-task-previews", () => ({ createTelegramTaskPreviews: mocks.previews, resendOpenTelegramTaskPreviews: mocks.resend, sendTelegramTaskPreview: vi.fn() }));
vi.mock("@/lib/telegram-weekly-statuses", () => ({ sendOwnerWeeklyStatusPreview: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({ from: mocks.from, rpc: mocks.rpc }) }));
import { POST } from "./route";

function request(body: unknown, secret = "webhook-test-only") {
  return new Request("https://example.test/api/telegram/webhook", { method: "POST", headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": secret }, body: JSON.stringify(body) });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "webhook-test-only");
  mocks.rpc.mockResolvedValue({ data: 0, error: null });
  mocks.send.mockResolvedValue({ message_id: 1 });
  mocks.intake.mockResolvedValue(undefined);
  mocks.from.mockImplementation(() => {
    const chain = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: { setting_value: "123" }, error: null }) };
    chain.select.mockReturnValue(chain); chain.eq.mockReturnValue(chain); return chain;
  });
});

const ownerMessage = { message_id: 99, chat: { id: 123, type: "private" }, from: { id: 123 }, text: "Илоне ESTT завтра отчёт" };

describe("Telegram task webhook safety", () => {
  it("blocks preview webhook before reading or mutating the live database", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    expect((await POST(request({ message: ownerMessage }))).status).toBe(404);
    expect(mocks.from).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.intake).not.toHaveBeenCalled(); expect(mocks.send).not.toHaveBeenCalled();
  });
  it("rejects an invalid webhook secret before accessing data", async () => {
    expect((await POST(request({ message: ownerMessage }, "invalid"))).status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled(); expect(mocks.intake).not.toHaveBeenCalled();
  });
  it("passes owner text to the shared intake", async () => {
    expect((await POST(request({ message: ownerMessage }))).status).toBe(200);
    expect(mocks.intake).toHaveBeenCalledWith("123", 99, ownerMessage.text);
  });
  it("politely refuses a different Telegram user", async () => {
    await POST(request({ message: { ...ownerMessage, chat: { id: 456, type: "private" }, from: { id: 456 } } }));
    expect(mocks.intake).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.send).toHaveBeenCalledWith("456", expect.stringContaining("только владелец"));
  });
  it("checks the sender, not only the chat id", async () => {
    await POST(request({ message: { ...ownerMessage, from: { id: 456 } } }));
    expect(mocks.intake).not.toHaveBeenCalled();
  });
  it("refuses a message without sender identity", async () => {
    await POST(request({ message: { ...ownerMessage, from: undefined } }));
    expect(mocks.intake).not.toHaveBeenCalled();
  });
  it("queues an owner voice without any speech API", async () => {
    const voice = { file_id: "test-file", file_unique_id: "test-unique" };
    await POST(request({ message: { ...ownerMessage, text: undefined, voice } }));
    expect(mocks.voice).toHaveBeenCalledWith("123", 99, voice); expect(mocks.intake).not.toHaveBeenCalled();
  });
  it("does not queue another user's voice", async () => {
    await POST(request({ message: { ...ownerMessage, from: { id: 456 }, voice: { file_id: "test", file_unique_id: "test" } } }));
    expect(mocks.voice).not.toHaveBeenCalled();
  });
  it("checks callback sender identity", async () => {
    await POST(request({ callback_query: { id: "cb", from: { id: 456 }, message: ownerMessage, data: "ji:00000000-0000-4000-8000-000000000000:1:0" } }));
    expect(mocks.choice).not.toHaveBeenCalled(); expect(mocks.answer).toHaveBeenCalledWith("cb", expect.stringContaining("владельцу"));
  });
  it("passes owner clarification buttons to the intake", async () => {
    const data = "ji:00000000-0000-4000-8000-000000000000:1:0";
    await POST(request({ callback_query: { id: "cb", from: { id: 123 }, message: ownerMessage, data } }));
    expect(mocks.choice).toHaveBeenCalledWith("123", "cb", data);
  });
  it("does not treat /start as a new task", async () => {
    await POST(request({ message: { ...ownerMessage, text: "/start" } }));
    expect(mocks.intake).not.toHaveBeenCalled(); expect(mocks.send).toHaveBeenCalledWith("123", expect.stringContaining("Напишите задачу"));
  });
  it("ignores unknown commands instead of creating tasks", async () => {
    await POST(request({ message: { ...ownerMessage, text: "/unknown" } }));
    expect(mocks.intake).not.toHaveBeenCalled();
  });
  it("returns a retryable failure without logging user content or credentials", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.intake.mockRejectedValueOnce(new Error("sensitive-internal-value"));
    expect((await POST(request({ message: ownerMessage }))).status).toBe(500);
    expect(log).toHaveBeenCalledWith("Telegram webhook handling failed"); log.mockRestore();
  });
});
