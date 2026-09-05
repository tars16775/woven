import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// Reveal wraps content in a motion.div that waits for the viewport; in tests it is a plain div.
vi.mock("@/components/reveal", () => ({
  Reveal: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

import { Section } from "@/components/section";

describe("Section", () => {
  it("renders eyebrow, title and subtitle", () => {
    render(
      <Section id="hero" eyebrow="One box for the whole house" title="Woven Core+" subtitle="From $1,499">
        <div>media</div>
      </Section>,
    );
    expect(screen.getByText("One box for the whole house")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Woven Core+" })).toBeInTheDocument();
    expect(screen.getByText("From $1,499")).toBeInTheDocument();
    expect(screen.getByText("media")).toBeInTheDocument();
  });

  it("uses an h1 when asked and carries the theme on the section", () => {
    const { container } = render(<Section id="hero" theme="dark" titleAs="h1" title="Ask. It already knows the house." />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Ask. It already knows the house.");
    const section = container.querySelector("section#hero");
    expect(section).toHaveAttribute("data-theme", "dark");
  });

  it("renders primary and secondary CTAs as links with the button classes", () => {
    render(
      <Section
        title="T"
        primary={{ label: "Reserve", href: "/order?tier=core-plus" }}
        secondary={{ label: "Learn more", href: "/core-plus" }}
      />,
    );
    const primary = screen.getByRole("link", { name: "Reserve" });
    const secondary = screen.getByRole("link", { name: "Learn more" });
    expect(primary).toHaveAttribute("href", "/order?tier=core-plus");
    expect(primary).toHaveClass("btn", "btn-primary");
    expect(secondary).toHaveAttribute("href", "/core-plus");
    expect(secondary).toHaveClass("btn", "btn-secondary");
  });

  it("omits the action row and eyebrow when none are given", () => {
    render(<Section title="Quiet" />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByRole("heading", { level: 2, name: "Quiet" })).toBeInTheDocument();
  });

  it("shows the scroll cue pointing at the next section", () => {
    render(<Section title="T" cue="#sides" />);
    expect(screen.getByRole("link", { name: "Scroll to the next section" })).toHaveAttribute("href", "#sides");
  });
});
