"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { flushSync } from "react-dom";
import { motion } from "framer-motion";
import { BookOpen, Loader2 } from "lucide-react";
import PostCard, { type PostOut } from "@/components/posts/PostCard";
import { PostCardGridSkeleton } from "@/components/ui/ContentSkeleton";
import { getCategories, getPosts, type CategoryItem } from "@/app/api";

const PAGE_SIZE = 12;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function canStartViewTransition(): boolean {
  return (
    typeof document !== "undefined" &&
    "startViewTransition" in document &&
    typeof document.startViewTransition === "function" &&
    !prefersReducedMotion()
  );
}

function categoryHref(pathname: string, slug: string | null): string {
  if (!slug) return pathname;
  return `${pathname}?category=${encodeURIComponent(slug)}`;
}

export default function PostsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlCategory = searchParams.get("category");

  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [posts, setPosts] = useState<PostOut[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(urlCategory);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [skipEnter, setSkipEnter] = useState(false);
  const [, startReactTransition] = useTransition();
  const fetchGen = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const initialDone = useRef(false);
  const activeCategoryRef = useRef<string | null>(urlCategory);
  const loadMoreInflight = useRef(false);

  useEffect(() => {
    activeCategoryRef.current = activeCategory;
  }, [activeCategory]);

  useEffect(() => {
    getCategories()
      .then((data) => {
        const sorted = [...data].sort((a, b) => a.sort - b.sort);
        setCategories(sorted);
      })
      .catch(() => {});
  }, []);

  const fetchPage = useCallback(
    async (category: string | null, pageNum: number, signal?: AbortSignal) => {
      return getPosts(
        {
          status: "published",
          page: pageNum,
          size: PAGE_SIZE,
          ...(category ? { category } : {}),
        },
        { signal }
      );
    },
    []
  );

  /** Optimistic category switch + abortable list fetch (SoT §2). */
  const loadCategory = useCallback(
    (slug: string | null, opts?: { fromUrl?: boolean; replaceUrl?: boolean }) => {
      const fromUrl = opts?.fromUrl ?? false;
      const replaceUrl = opts?.replaceUrl ?? !fromUrl;

      // Ignore same-slug spam (do not lock other tabs)
      if (!fromUrl && slug === activeCategoryRef.current && initialDone.current) {
        return;
      }

      activeCategoryRef.current = slug;
      setActiveCategory(slug);
      setPosts([]);
      setPage(1);
      setHasMore(true);
      setSkipEnter(true);
      setLoading(true);

      if (replaceUrl) {
        const href = categoryHref(pathname, slug);
        startReactTransition(() => {
          router.replace(href, { scroll: false });
        });
      }

      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      const gen = ++fetchGen.current;

      fetchPage(slug, 1, ac.signal)
        .then((data) => {
          if (gen !== fetchGen.current || ac.signal.aborted) return;

          const apply = () => {
            setPosts(data);
            setPage(1);
            setHasMore(data.length === PAGE_SIZE);
            setSkipEnter(true);
            setLoading(false);
            initialDone.current = true;
          };

          // VT only wraps DOM commit of already-fetched data — never the network
          if (initialDone.current && canStartViewTransition()) {
            document.documentElement.classList.add("vt-posts-running");
            try {
              const vt = document.startViewTransition(() => {
                flushSync(apply);
              });
              vt.finished.finally(() => {
                document.documentElement.classList.remove("vt-posts-running");
              });
            } catch {
              document.documentElement.classList.remove("vt-posts-running");
              apply();
            }
          } else {
            apply();
          }
        })
        .catch((err: unknown) => {
          if (gen !== fetchGen.current || ac.signal.aborted) return;
          const name = err && typeof err === "object" && "name" in err ? String((err as { name: string }).name) : "";
          if (name === "AbortError") return;
          setPosts([]);
          setHasMore(false);
          setLoading(false);
          initialDone.current = true;
        });
    },
    [fetchPage, pathname, router, startReactTransition]
  );

  // Initial load + browser back/forward when URL category changes externally
  useEffect(() => {
    const next = urlCategory;
    if (initialDone.current && next === activeCategoryRef.current) return;
    loadCategory(next, { fromUrl: true, replaceUrl: false });
  }, [urlCategory, loadCategory]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      fetchGen.current += 1;
    };
  }, []);

  const handleCategoryChange = (slug: string | null) => {
    loadCategory(slug, { fromUrl: false, replaceUrl: true });
  };

  const handleLoadMore = () => {
    if (loadMoreInflight.current || loading) return;
    const next = page + 1;
    loadMoreInflight.current = true;
    setPage(next);
    setLoading(true);
    const gen = fetchGen.current;
    fetchPage(activeCategoryRef.current, next)
      .then((data) => {
        if (gen !== fetchGen.current) return;
        setPosts((prev) => [...prev, ...data]);
        setHasMore(data.length === PAGE_SIZE);
        setSkipEnter(true);
      })
      .catch(() => {})
      .finally(() => {
        if (gen === fetchGen.current) setLoading(false);
        loadMoreInflight.current = false;
      });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-12">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-6 md:mb-10"
      >
        <div className="flex items-center gap-2 md:gap-3 mb-1 md:mb-2">
          <BookOpen className="w-5 h-5 md:w-7 md:h-7 text-sky-500" />
          <h1 className="text-xl md:text-3xl font-bold text-slate-800 dark:text-slate-100">
            文章
          </h1>
        </div>
        <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 ml-7 md:ml-10">
          记录技术探索、学术研究与生活感悟
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="mb-5 md:mb-8 flex flex-wrap gap-1.5 md:gap-2"
      >
        <FilterTab
          label="全部"
          count={null}
          active={activeCategory === null}
          onClick={() => handleCategoryChange(null)}
        />
        {categories.map((cat) => (
          <FilterTab
            key={cat.id}
            label={cat.name}
            count={cat.post_count}
            active={activeCategory === cat.slug}
            onClick={() => handleCategoryChange(cat.slug)}
          />
        ))}
      </motion.div>

      <div className="vt-posts-list">
        {loading && posts.length === 0 ? (
          <PostCardGridSkeleton count={6} />
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-slate-400">
            <BookOpen className="w-12 h-12 mb-4 opacity-40" />
            <p>暂无文章</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
            {posts.map((post, i) => (
              <div key={post.id}>
                <PostCard post={post} index={i} skipEnter={skipEnter} />
              </div>
            ))}
          </div>
        )}
      </div>

      {hasMore && posts.length > 0 && !loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex justify-center mt-10"
        >
          <button
            type="button"
            onClick={handleLoadMore}
            className="px-5 py-2 md:px-8 md:py-3 rounded-2xl bg-white/10 dark:bg-white/[0.05] backdrop-blur-xl border border-white/20 text-sm md:text-base text-slate-700 dark:text-slate-300 hover:bg-white/20 dark:hover:bg-white/[0.1] transition-all duration-300 hover:-translate-y-0.5"
          >
            加载更多
          </button>
        </motion.div>
      )}

      {loading && posts.length > 0 && (
        <div className="flex justify-center mt-10">
          <Loader2 className="w-6 h-6 text-sky-500 animate-spin" />
        </div>
      )}
    </div>
  );
}

function FilterTab({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number | null;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative px-3 py-1.5 md:px-5 md:py-2 rounded-2xl text-xs md:text-sm font-medium transition-all duration-300 ${
        active
          ? "text-white shadow-lg shadow-sky-500/20"
          : "text-slate-600 dark:text-slate-400 bg-white/10 dark:bg-white/[0.05] backdrop-blur-xl border border-white/20 hover:bg-white/20 dark:hover:bg-white/[0.1]"
      }`}
    >
      {active && (
        <motion.div
          layoutId="activeCategoryBg"
          className="absolute inset-0 rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-400"
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}
      <span className="relative z-10">
        {label}
        {count !== null && count > 0 && (
          <span
            className={`ml-1.5 text-xs ${
              active ? "text-white/70" : "text-slate-400 dark:text-slate-500"
            }`}
          >
            {count}
          </span>
        )}
      </span>
    </button>
  );
}
