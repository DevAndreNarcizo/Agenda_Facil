import { describe, expect, it } from "vitest";
import { getSupabaseErrorMessage, isMissingRelationError } from "./supabase-errors";

describe("isMissingRelationError", () => {
  it("detects PGRST116 schema cache errors", () => {
    expect(isMissingRelationError({ code: "PGRST116", message: "schema cache" })).toBe(true);
  });

  it("detects 42P01 table not found errors", () => {
    expect(isMissingRelationError({ code: "42P01", message: "relation does not exist" })).toBe(true);
  });

  it("detects PGRST205 errors", () => {
    expect(isMissingRelationError({ code: "PGRST205", message: "not found" })).toBe(true);
  });

  it("detects missing table from message", () => {
    expect(isMissingRelationError({ message: "Could not find the table 'customers'" })).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(isMissingRelationError({ code: "23505", message: "duplicate key" })).toBe(false);
  });

  it("returns false for null or undefined", () => {
    expect(isMissingRelationError(null)).toBe(false);
    expect(isMissingRelationError(undefined)).toBe(false);
  });
});

describe("getSupabaseErrorMessage", () => {
  it("returns missing relation message for schema errors", () => {
    const result = getSupabaseErrorMessage({ code: "PGRST116", message: "schema cache" });
    expect(result).toContain("migration");
  });

  it("returns duplicate key message for 23505", () => {
    const result = getSupabaseErrorMessage({ code: "23505", message: "unique constraint" });
    expect(result).toContain("Já existe");
  });

  it("returns foreign key message for 23503", () => {
    const result = getSupabaseErrorMessage({ code: "23503", message: "foreign key" });
    expect(result).toContain("vinculado");
  });

  it("returns RLS message when row-level security is mentioned", () => {
    const result = getSupabaseErrorMessage({ message: "row-level security policy violation" });
    expect(result).toContain("permissão");
  });

  it("returns fallback when no specific code matches", () => {
    const result = getSupabaseErrorMessage({ message: "timeout" }, "Custom fallback");
    expect(result).toBe("timeout");
  });

  it("returns default fallback for empty errors", () => {
    const result = getSupabaseErrorMessage(null);
    expect(result).toBe("Erro ao processar solicitação.");
  });
});
