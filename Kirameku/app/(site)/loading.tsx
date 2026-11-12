import { RouteLoadingFallback } from "@/components/navigation/RouteFallback";

/**
 * Public-site route-level loading only (route group `app/(site)`).
 * Deliberately not `app/loading.tsx`, so `/garden` and `/auth` are not wrapped.
 * Skeleton mapping is shared with the optimistic `<main>` slot (RouteFallback).
 */
export default function SiteLoading() {
  return <RouteLoadingFallback />;
}
