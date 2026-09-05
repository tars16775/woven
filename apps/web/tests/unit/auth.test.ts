import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const KEY = "woven:session";

/** A Map-backed localStorage so every read and write is observable. */
function mockStorage() {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((k: string) => store.get(k) ?? null),
    setItem: vi.fn((k: string, v: string) => void store.set(k, v)),
    removeItem: vi.fn((k: string) => void store.delete(k)),
    clear: vi.fn(() => store.clear()),
    key: vi.fn((i: number) => [...store.keys()][i] ?? null),
    get length() {
      return store.size;
    },
  };
}

let storage: ReturnType<typeof mockStorage>;

// The module caches its snapshot, so each test gets a fresh copy.
async function loadAuth() {
  vi.resetModules();
  return await import("@/lib/auth");
}

beforeEach(() => {
  storage = mockStorage();
  vi.stubGlobal("localStorage", storage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("signIn / signOut", () => {
  it("signIn writes the session with a timestamp", async () => {
    const { signIn } = await loadAuth();
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);

    signIn({ household: "Alex's house", name: "Alex", email: "alex@example.com", method: "passkey" });

    expect(storage.setItem).toHaveBeenCalledTimes(1);
    const [key, raw] = storage.setItem.mock.calls[0];
    expect(key).toBe(KEY);
    expect(JSON.parse(raw)).toEqual({
      household: "Alex's house",
      name: "Alex",
      email: "alex@example.com",
      method: "passkey",
      at: 1_700_000_000_000,
    });
  });

  it("signOut removes the session", async () => {
    const { signIn, signOut } = await loadAuth();
    signIn({ household: "h", name: "n", email: "e@x", method: "code" });
    signOut();
    expect(storage.removeItem).toHaveBeenCalledWith(KEY);
    expect(storage.getItem(KEY)).toBeNull();
  });

  it("survives a storage that throws", async () => {
    const { signIn, signOut } = await loadAuth();
    storage.setItem.mockImplementation(() => {
      throw new Error("quota");
    });
    storage.removeItem.mockImplementation(() => {
      throw new Error("denied");
    });
    expect(() => signIn({ household: "h", name: "n", email: "e@x", method: "email" })).not.toThrow();
    expect(() => signOut()).not.toThrow();
  });
});

describe("useSession", () => {
  it("is null when nothing is stored", async () => {
    const { useSession } = await loadAuth();
    const { result } = renderHook(() => useSession());
    expect(result.current).toBeNull();
    expect(storage.getItem).toHaveBeenCalledWith(KEY);
  });

  it("reads an existing session on first render", async () => {
    storage.setItem(KEY, JSON.stringify({ household: "H", name: "N", email: "n@h", method: "passkey", at: 1 }));
    storage.setItem.mockClear();
    const { useSession } = await loadAuth();
    const { result } = renderHook(() => useSession());
    expect(result.current).toMatchObject({ household: "H", name: "N", method: "passkey" });
  });

  it("re-renders through signIn and signOut", async () => {
    const { useSession, signIn, signOut } = await loadAuth();
    const { result } = renderHook(() => useSession());
    expect(result.current).toBeNull();

    act(() => signIn({ household: "Alex's house", name: "Alex", email: "alex@example.com", method: "passkey" }));
    expect(result.current?.name).toBe("Alex");
    expect(typeof result.current?.at).toBe("number");

    act(() => signOut());
    expect(result.current).toBeNull();
  });

  it("follows a change made in another tab", async () => {
    const { useSession } = await loadAuth();
    const { result } = renderHook(() => useSession());
    expect(result.current).toBeNull();

    storage.setItem(KEY, JSON.stringify({ household: "H", name: "Sam", email: "s@h", method: "code", at: 2 }));
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: KEY }));
    });
    expect(result.current?.name).toBe("Sam");

    // Unrelated keys are ignored.
    storage.setItem(KEY, JSON.stringify({ household: "H", name: "Other", email: "o@h", method: "code", at: 3 }));
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "something-else" }));
    });
    expect(result.current?.name).toBe("Sam");
  });

  it("treats corrupt JSON as signed out", async () => {
    storage.setItem(KEY, "{not json");
    const { useSession } = await loadAuth();
    const { result } = renderHook(() => useSession());
    expect(result.current).toBeNull();
  });
});
