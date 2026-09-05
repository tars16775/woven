import type { ReactNode } from "react";

/** Text for assistive technology only: kept in the tree, removed from the picture. */
export function VisuallyHidden({
  id,
  as: Tag = "span",
  children,
}: {
  id?: string;
  as?: "span" | "p" | "div";
  children: ReactNode;
}) {
  return (
    <Tag id={id} className="sr-only">
      {children}
    </Tag>
  );
}
