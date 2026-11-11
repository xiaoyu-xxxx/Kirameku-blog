"use client";

/** Shared content-area skeletons — nav/header stay interactive (SoT nav-nonblocking). */

export function HomePageSkeleton() {
  return (
    <div className="w-full max-w-6xl mx-auto py-6 md:py-12 px-4 sm:px-10">
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 max-w-[50%] rounded bg-slate-200/80 dark:bg-slate-600/60" />
        <div className="h-4 w-72 max-w-[70%] rounded bg-slate-200/60 dark:bg-slate-600/40" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6 pt-2">
          {Array.from({ length: 3 }, (_, i) => (
            <div
              key={i}
              className="h-32 rounded-2xl bg-white/40 dark:bg-slate-800/40 border border-white/15 dark:border-white/5"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function PostCardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="rounded-2xl overflow-hidden border border-white/20 dark:border-white/10 bg-white/40 dark:bg-slate-800/40 animate-pulse"
        >
          <div className="aspect-[16/10] bg-slate-200/70 dark:bg-slate-700/50" />
          <div className="p-3 md:p-4 space-y-2.5">
            <div className="h-4 w-4/5 max-w-[85%] rounded bg-slate-200/80 dark:bg-slate-600/60" />
            <div className="h-3 w-full rounded bg-slate-200/60 dark:bg-slate-600/40" />
            <div className="h-3 w-2/3 max-w-[60%] rounded bg-slate-200/50 dark:bg-slate-600/30" />
            <div className="flex gap-2 pt-1">
              <div className="h-5 w-14 rounded-full bg-slate-200/60 dark:bg-slate-600/40" />
              <div className="h-5 w-10 rounded-full bg-slate-200/50 dark:bg-slate-600/30" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function PostDetailSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-12">
      <div className="h-4 w-28 mb-6 md:mb-8 rounded bg-slate-200/70 dark:bg-slate-700/50 animate-pulse" />
      <div className="rounded-3xl overflow-hidden border border-white/30 dark:border-white/10 bg-white/60 dark:bg-slate-900/70 backdrop-blur-2xl animate-pulse">
        <div className="w-full h-40 sm:h-56 md:h-72 bg-slate-200/70 dark:bg-slate-700/50" />
        <div className="px-4 sm:px-6 md:px-12 py-5 sm:py-8 md:py-10 space-y-4">
          <div className="h-8 md:h-10 w-4/5 max-w-[90%] rounded bg-slate-200/80 dark:bg-slate-600/60" />
          <div className="h-4 w-full rounded bg-slate-200/60 dark:bg-slate-600/40" />
          <div className="h-4 w-3/4 max-w-[75%] rounded bg-slate-200/50 dark:bg-slate-600/30" />
          <div className="flex flex-wrap gap-3 pt-2 pb-4 border-b border-slate-200/60 dark:border-white/10">
            <div className="h-4 w-24 rounded bg-slate-200/60 dark:bg-slate-600/40" />
            <div className="h-4 w-20 rounded bg-slate-200/50 dark:bg-slate-600/30" />
            <div className="h-4 w-16 rounded bg-slate-200/50 dark:bg-slate-600/30" />
          </div>
          <div className="space-y-3 pt-2">
            {Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                className={`h-3 rounded bg-slate-200/50 dark:bg-slate-600/30 ${
                  i % 3 === 2 ? "w-2/3 max-w-[65%]" : "w-full"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ListBlockSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3 md:space-y-4">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="h-20 md:h-24 rounded-2xl bg-white/40 dark:bg-slate-800/40 border border-white/15 dark:border-white/5 animate-pulse"
        />
      ))}
    </div>
  );
}

export function BookmarkGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
        gap: "10px",
      }}
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/30 dark:bg-slate-800/30 animate-pulse"
        >
          <div className="shrink-0 w-10 h-10 rounded-lg bg-slate-200/70 dark:bg-slate-700/50" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-2/3 max-w-[70%] rounded bg-slate-200/70 dark:bg-slate-600/50" />
            <div className="h-3 w-full rounded bg-slate-200/50 dark:bg-slate-600/30" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PhotoWallGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="rounded-2xl overflow-hidden border border-white/20 dark:border-white/10 bg-white/40 dark:bg-slate-800/40 animate-pulse"
        >
          <div className="aspect-[4/3] bg-slate-200/70 dark:bg-slate-700/50" />
          <div className="p-3 space-y-2">
            <div className="h-4 w-1/2 max-w-[50%] rounded bg-slate-200/80 dark:bg-slate-600/60" />
            <div className="h-3 w-1/3 max-w-[33%] rounded bg-slate-200/50 dark:bg-slate-600/30" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function FriendsScatterSkeleton() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="grid grid-cols-3 gap-6 md:gap-10 opacity-80">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="w-12 h-16 md:w-16 md:h-20 rounded-2xl bg-white/40 dark:bg-slate-800/40 border border-white/20 animate-pulse"
            style={{ transform: `rotate(${(i % 3) * 6 - 6}deg)` }}
          />
        ))}
      </div>
    </div>
  );
}

export function TimelineRiverSkeleton() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex gap-4 md:gap-8 overflow-hidden py-10 md:py-16">
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className="shrink-0 w-[170px] md:w-[240px] h-[180px] md:h-[230px] rounded-2xl bg-white/40 dark:bg-slate-800/40 border border-white/15 animate-pulse"
            style={{ marginTop: `${(i % 3) * 24}px` }}
          />
        ))}
      </div>
    </div>
  );
}
