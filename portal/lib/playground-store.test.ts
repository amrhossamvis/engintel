import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  MAX_THREADS,
  upsertThreadList,
  loadState,
  saveThread,
  savePersona,
  deletePersona,
  type Thread,
} from "./playground-store";
import type { CustomPersona } from "./playground-templates";

function thread(id: string, updatedAt = 0): Thread {
  return { id, templateId: "t", title: id, messages: [], contextDir: "", updatedAt };
}

function persona(id: string): CustomPersona {
  return {
    id,
    name: id,
    category: "My Personas",
    icon: "Sparkles",
    description: "",
    persona: "",
    variables: [],
    prompt: "",
    custom: true,
    createdAt: 0,
  };
}

describe("upsertThreadList", () => {
  it("prepends a new thread", () => {
    const out = upsertThreadList([thread("a")], thread("b"));
    expect(out.map((t) => t.id)).toEqual(["b", "a"]);
  });

  it("replaces an existing thread and moves it to the front", () => {
    const out = upsertThreadList([thread("a"), thread("b")], thread("b", 99));
    expect(out.map((t) => t.id)).toEqual(["b", "a"]);
    expect(out[0].updatedAt).toBe(99);
  });

  it("caps the list at MAX_THREADS", () => {
    let list: Thread[] = [];
    for (let i = 0; i < MAX_THREADS + 5; i++) list = upsertThreadList(list, thread(`t${i}`));
    expect(list).toHaveLength(MAX_THREADS);
  });
});

describe("localStorage backend (no userKey)", () => {
  beforeEach(() => localStorage.clear());

  it("loadState reads personas and threads, session null", async () => {
    localStorage.setItem("pg:threads", JSON.stringify([thread("a")]));
    localStorage.setItem("pg:personas", JSON.stringify([persona("p1")]));
    const st = await loadState(null);
    expect(st.threads.map((t) => t.id)).toEqual(["a"]);
    expect(st.personas.map((p) => p.id)).toEqual(["p1"]);
    expect(st.session).toBeNull();
  });

  it("savePersona upserts then deletePersona removes", () => {
    savePersona(null, persona("p1"));
    savePersona(null, persona("p2"));
    expect(JSON.parse(localStorage.getItem("pg:personas")!).map((p: CustomPersona) => p.id)).toEqual([
      "p2",
      "p1",
    ]);
    deletePersona(null, "p1");
    expect(JSON.parse(localStorage.getItem("pg:personas")!).map((p: CustomPersona) => p.id)).toEqual([
      "p2",
    ]);
  });

  it("saveThread writes after debounce and caps the list", () => {
    vi.useFakeTimers();
    try {
      for (let i = 0; i < MAX_THREADS + 3; i++) saveThread(null, thread(`t${i}`, i));
      vi.runAllTimers();
      const ids = JSON.parse(localStorage.getItem("pg:threads")!).map((t: Thread) => t.id);
      expect(ids).toHaveLength(MAX_THREADS);
      expect(ids[0]).toBe(`t${MAX_THREADS + 2}`);
    } finally {
      vi.useRealTimers();
    }
  });
});
