"use client";

import type { CSSProperties, ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  isExcludedShellPath,
  isSameRoute,
  normalizePathname,
  useNavigationPending,
} from "@/components/providers/NavigationPendingProvider";
import {
  BookmarkGridSkeleton,
  FriendsScatterSkeleton,
  HomePageSkeleton,
  ListBlockSkeleton,
  PhotoWallGridSkeleton,
  PostCardGridSkeleton,
  PostDetailSkeleton,
  TimelineRiverSkeleton,
} from "@/components/ui/ContentSkeleton";

const PAD_WIDE = "max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-12";
const PAD_NARROW = "max-w-2xl mx-auto px-4 sm:px-6 py-6 md:py-12";
const PAD_MUSIC = "max-w-4xl mx-auto px-4 py-6 md:py-12";
const PAD_NOVEL = "mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-12";
const PAD_ABOUT = "w-full max-w-4xl mx-auto py-6 md:py-12 px-4 sm:px-10";

function wrap(className: string, skeleton: ReactNode, style?: CSSProperties) {
  return (
    <div className={className} style={style}>
      {skeleton}
    </div>
  );
}

export function RouteFallback({ href }: { href: string }) {
  const path = normalizePathname(href);

  if (path === "/") {
    return <HomePageSkeleton />;
  }
  if (path === "/posts") {
    return wrap(PAD_WIDE, <PostCardGridSkeleton />);
  }
  if (path.startsWith("/posts/")) {
    return <PostDetailSkeleton />;
  }
  if (path === "/moments" || path === "/messages") {
    return wrap(PAD_NARROW, <ListBlockSkeleton />);
  }
  if (path === "/timeline" || path.startsWith("/timeline/")) {
    return (
      <div className="py-6 md:py-12">
        <TimelineRiverSkeleton />
      </div>
    );
  }
  if (path === "/bookmark" || path.startsWith("/bookmark/")) {
    return wrap(PAD_WIDE, <BookmarkGridSkeleton />);
  }
  if (path === "/photowall" || path.startsWith("/photowall/")) {
    return wrap(PAD_WIDE, <PhotoWallGridSkeleton />);
  }
  if (path === "/friends" || path.startsWith("/friends/")) {
    return wrap(`${PAD_WIDE} min-h-[50vh]`, <FriendsScatterSkeleton />);
  }
  if (path === "/novel" || path.startsWith("/novel/")) {
    return wrap(PAD_NOVEL, <ListBlockSkeleton />, { maxWidth: "56rem" });
  }
  if (path === "/music" || path.startsWith("/music/")) {
    return wrap(PAD_MUSIC, <ListBlockSkeleton />);
  }
  if (path === "/resume" || path === "/about") {
    return wrap(PAD_ABOUT, <ListBlockSkeleton />);
  }
  return wrap(PAD_WIDE, <ListBlockSkeleton />);
}

export function MainContentSlot({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { pendingHref } = useNavigationPending();

  if (pendingHref && isExcludedShellPath(pendingHref)) {
    return <>{children}</>;
  }

  if (pendingHref && !isSameRoute(pendingHref, pathname)) {
    return <RouteFallback key={pendingHref} href={pendingHref} />;
  }

  return <>{children}</>;
}

/** Shared by app/(site)/loading.tsx — pathname is already the target route. */
export function RouteLoadingFallback() {
  const pathname = usePathname();
  if (isExcludedShellPath(pathname)) return null;
  return <RouteFallback href={pathname} />;
}
