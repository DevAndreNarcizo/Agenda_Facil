import { beforeEach, describe, expect, it } from "vitest";
import { authStorage, setRememberSession, shouldRememberSession } from "../auth-storage";

describe("auth-storage", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("mantém a sessão no localStorage por padrão", () => {
    expect(shouldRememberSession()).toBe(true);
    authStorage.setItem("sb-token", "a");
    expect(localStorage.getItem("sb-token")).toBe("a");
    expect(sessionStorage.getItem("sb-token")).toBeNull();
  });

  it("sem 'Manter conectado' grava só na aba e remove a cópia persistente", () => {
    localStorage.setItem("sb-token", "antigo");
    setRememberSession(false);
    authStorage.setItem("sb-token", "novo");
    expect(sessionStorage.getItem("sb-token")).toBe("novo");
    expect(localStorage.getItem("sb-token")).toBeNull();
    expect(authStorage.getItem("sb-token")).toBe("novo");
  });

  it("lê sessões antigas do localStorage e remove dos dois armazenamentos", () => {
    localStorage.setItem("sb-token", "legado");
    expect(authStorage.getItem("sb-token")).toBe("legado");
    sessionStorage.setItem("sb-token", "x");
    authStorage.removeItem("sb-token");
    expect(localStorage.getItem("sb-token")).toBeNull();
    expect(sessionStorage.getItem("sb-token")).toBeNull();
  });
});
