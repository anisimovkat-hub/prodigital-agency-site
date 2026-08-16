import { describe, expect, it } from "vitest";

import { config } from "@/proxy";

const matcherRegex = new RegExp(`^${config.matcher[0]}$`);

describe("proxy matcher", () => {
  it.each([
    "/",
    "/today",
    "/tasks",
    "/tasks/",
    "/projects",
    "/projects/123e4567-e89b-12d3-a456-426614174000",
    "/clients/123e4567-e89b-12d3-a456-426614174000",
    "/employees/123e4567-e89b-12d3-a456-426614174000",
    "/login",
    "/report/123e4567-e89b-12d3-a456-426614174000",
  ])("включает приватный/публичный роут %s (через него проходит auth-проверка)", (path) => {
    expect(matcherRegex.test(path)).toBe(true);
  });

  it.each([
    "/api/cron/meta-sync",
    "/api/cron/another-job",
    "/_next/static/chunk.js",
    "/_next/image",
    "/favicon.ico",
    "/logo.png",
    "/hero.svg",
  ])("исключает cron или статику %s из пользовательской auth-проверки", (path) => {
    expect(matcherRegex.test(path)).toBe(false);
  });
});
