import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

describe("supabase client creation", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("creates supabase client when env vars are present", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");

    const { supabase } = await import("./supabase");
    expect(supabase).toBeDefined();
  });

  it("throws when env vars are missing", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");

    await expect(import("./supabase")).rejects.toThrow("Missing Supabase environment variables");
  });
});
