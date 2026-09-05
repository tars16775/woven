import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { Nav } from "@/components/nav";
import { nav } from "@/lib/site";

beforeEach(() => {
  localStorage.clear();
});

describe("Nav", () => {
  it("renders every primary item with its href", () => {
    render(<Nav />);
    const primary = screen.getByRole("navigation", { name: "Primary" });
    for (const item of nav.center) {
      expect(within(primary).getByRole("link", { name: item.label })).toHaveAttribute("href", item.href);
    }
    expect(within(primary).getAllByRole("link")).toHaveLength(nav.center.length);
  });

  it("links the wordmark home and offers Support and Sign in when signed out", () => {
    render(<Nav />);
    expect(screen.getByRole("link", { name: "Woven home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Support" })).toHaveAttribute("href", "/support");
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  });

  it("exposes a Menu button for small screens", () => {
    render(<Nav />);
    expect(screen.getByRole("button", { name: "Menu" })).toHaveAttribute("aria-expanded", "false");
  });
});
