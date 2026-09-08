import { Skeleton } from "@/components/dashboard/ui";

/**
 * A room streaming in (design phase 26).
 *
 * A spinner in the middle of an empty area says "wait" and nothing else. This
 * holds the shape every room actually has — a title, a line under it, and
 * cards — so the page settles into place instead of appearing from nowhere,
 * and the eye is already where the content will be.
 */
export default function DashboardLoading() {
  return (
    <div role="status" aria-label="Loading">
      <Skeleton className="h-[34px] w-[220px]" rounded="sm" />
      <Skeleton className="mt-3 h-[15px] w-[340px]" rounded="sm" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-[168px] w-full" rounded="lg" />
        <Skeleton className="h-[168px] w-full" rounded="lg" />
      </div>
      <Skeleton className="mt-4 h-[120px] w-full" rounded="lg" />
    </div>
  );
}
