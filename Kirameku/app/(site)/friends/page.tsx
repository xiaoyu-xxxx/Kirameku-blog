"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Users, ExternalLink, X, Check } from "lucide-react";
import {
  getFriendLinks,
  applyFriendLink,
  type FriendLinkItem,
} from "@/app/api";
import { FriendsScatterSkeleton } from "@/components/ui/ContentSkeleton";
import MessageBottle from "@/components/icons/MessageBottle";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randomScatter(count: number) {
  const cols = Math.ceil(Math.sqrt(count * 1.6));
  const rows = Math.ceil(count / cols);
  const base: { x: number; y: number; rot: number; scale: number }[] = [];
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const bx = ((col + 0.5) / cols) * 100;
    const by = ((row + 0.5) / rows) * 100;
    base.push({
      x: Math.max(4, Math.min(96, bx + (Math.random() - 0.5) * (90 / cols))),
      y: Math.max(2, Math.min(98, by + (Math.random() - 0.5) * (60 / rows))),
      rot: (Math.random() - 0.5) * 120,
      scale: 0.8 + Math.random() * 0.4,
    });
  }
  return shuffle(base);
}

type ApplyForm = {
  name: string;
  url: string;
  avatar: string;
  description: string;
  website: string;
};

const emptyForm: ApplyForm = {
  name: "",
  url: "",
  avatar: "",
  description: "",
  website: "",
};

export default function FriendsPage() {
  const [friends, setFriends] = useState<FriendLinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<FriendLinkItem | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  const [applyOpen, setApplyOpen] = useState(false);
  const [applyForm, setApplyForm] = useState<ApplyForm>(emptyForm);
  const [applyError, setApplyError] = useState("");
  const [applySubmitting, setApplySubmitting] = useState(false);
  const [applySuccess, setApplySuccess] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    getFriendLinks({ signal: ac.signal })
      .then((data) => {
        if (ac.signal.aborted) return;
        setFriends(data);
      })
      .catch((err: unknown) => {
        if (ac.signal.aborted) return;
        const name = err && typeof err === "object" && "name" in err ? String((err as { name: string }).name) : "";
        if (name === "AbortError") return;
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => { ac.abort(); };
  }, []);

  const positions = useMemo(
    () => (friends.length ? randomScatter(friends.length) : []),
    [friends.length]
  );

  const [offsets, setOffsets] = useState<
    Record<number, { dx: number; dy: number }>
  >({});
  const dragRef = useRef<{
    id: number;
    startX: number;
    startY: number;
    startDx: number;
    startDy: number;
    moved: boolean;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, id: number) => {
      const cur = offsets[id] || { dx: 0, dy: 0 };
      dragRef.current = {
        id,
        startX: e.clientX,
        startY: e.clientY,
        startDx: cur.dx,
        startDy: cur.dy,
        moved: false,
      };
      e.preventDefault();
    },
    [offsets]
  );

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const d = dragRef.current;
    if (!d || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dx = d.startDx + ((e.clientX - d.startX) / rect.width) * 100;
    const dy = d.startDy + ((e.clientY - d.startY) / rect.height) * 100;
    if (
      Math.abs(e.clientX - d.startX) > 3 ||
      Math.abs(e.clientY - d.startY) > 3
    ) {
      d.moved = true;
    }
    setOffsets((prev) => ({ ...prev, [d.id]: { dx, dy } }));
  }, []);

  const wasDragged = useRef(false);
  const handleMouseUp = useCallback(() => {
    wasDragged.current = dragRef.current?.moved ?? false;
    dragRef.current = null;
  }, []);

  const openApply = () => {
    setApplyForm(emptyForm);
    setApplyError("");
    setApplySuccess(false);
    setApplySubmitting(false);
    setApplyOpen(true);
  };

  const closeApply = () => {
    setApplyOpen(false);
  };

  const validateClient = (): string | null => {
    const name = applyForm.name.trim();
    const url = applyForm.url.trim();
    if (!name) return "请填写站点名称";
    if (name.length > 100) return "站点名称过长";
    if (!url) return "请填写站点链接";
    if (!/^https?:\/\//i.test(url)) return "站点链接须以 http:// 或 https:// 开头";
    if (url.length > 300) return "站点链接过长";
    const avatar = applyForm.avatar.trim();
    if (avatar && !/^https?:\/\//i.test(avatar)) {
      return "头像链接须为 http(s) URL";
    }
    if (avatar.length > 500) return "头像链接过长";
    if (applyForm.description.trim().length > 300) return "简介过长";
    return null;
  };

  const submitApply = async () => {
    const err = validateClient();
    if (err) {
      setApplyError(err);
      return;
    }
    setApplyError("");
    setApplySubmitting(true);
    try {
      await applyFriendLink({
        name: applyForm.name.trim(),
        url: applyForm.url.trim(),
        avatar: applyForm.avatar.trim() || undefined,
        description: applyForm.description.trim() || undefined,
        website: applyForm.website,
      });
      setApplySuccess(true);
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : "投递失败，请稍后再试";
      setApplyError(msg.replace(/^API Error:\s*/, "") || "投递失败，请稍后再试");
    } finally {
      setApplySubmitting(false);
    }
  };

  const fieldClass =
    "glass-input w-full text-[13px] text-slate-800 dark:text-slate-100 placeholder:text-slate-400";

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-12">
      {/* 页头 */}
      <div className="mb-5 md:mb-10">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-1 md:mb-2">
          <div className="flex items-center gap-2 md:gap-3">
            <Users className="w-5 h-5 md:w-7 md:h-7 text-sky-500" />
            <h1 className="text-xl md:text-3xl font-bold text-slate-800 dark:text-slate-100">
              友链
            </h1>
          </div>
          <button
            type="button"
            onClick={openApply}
            className="rounded-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border border-white/40 dark:border-white/10 px-2 py-0.5 md:px-3 md:py-1 text-[10px] md:text-xs font-bold text-sky-700/90 dark:text-sky-300 shadow-sm hover:bg-white/90 dark:hover:bg-slate-800 transition-colors"
          >
            申请友链
          </button>
        </div>
        <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 ml-7 md:ml-10">
          {loading
            ? "漂流瓶 · 每一封信笺都来自远方的朋友"
            : friends.length
              ? `漂流瓶 · 来自远方的 ${friends.length} 个朋友`
              : "漂流瓶 · 暂无友链"}
        </p>
      </div>

      {/* 散落区域 */}
      <div
        ref={containerRef}
        className="relative select-none"
        style={{ height: isMobile ? "400px" : "700px" }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {loading ? (
          <FriendsScatterSkeleton />
        ) : friends.length ? (
          friends.map((friend, i) => {
            const pos = positions[i];
            const off = offsets[friend.id] || { dx: 0, dy: 0 };
            const bottleSize = isMobile
              ? Math.round(48 * pos.scale)
              : Math.round(68 * pos.scale);
            const floatDur = 3.2 + (i % 5) * 0.6;

            return (
              <div
                key={friend.id}
                className="absolute cursor-grab active:cursor-grabbing group -translate-x-1/2 -translate-y-1/2"
                style={
                  {
                    left: `${pos.x + off.dx}%`,
                    top: `${pos.y + off.dy}%`,
                    "--rot": `${pos.rot}deg`,
                    transform: `rotate(${pos.rot}deg)`,
                    animation: `bottle-float ${floatDur}s ease-in-out ${i * 0.47}s infinite, bottle-fade-in 0.5s ease-out ${i * 0.06}s both`,
                    zIndex: 10 + i,
                  } as React.CSSProperties
                }
                onMouseDown={(e) => handleMouseDown(e, friend.id)}
                onClick={() => {
                  if (!wasDragged.current) setActive(friend);
                }}
              >
                <div className="relative transition-transform duration-300 group-hover:scale-110">
                  <MessageBottle size={bottleSize} />
                  <div className="absolute -bottom-4 md:-bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                    <span className="px-2 py-0.5 md:px-3 md:py-1 rounded-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-md text-[10px] md:text-xs font-bold text-slate-700 dark:text-slate-200 shadow-lg border border-white/40 dark:border-white/10">
                      {friend.name}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <Users className="w-8 h-8 md:w-12 md:h-12 mb-3 md:mb-4 opacity-40" />
            <p className="text-sm md:text-base">暂无友链</p>
          </div>
        )}
      </div>

      {/* tip：保持现网文案，不加申请链 */}
      <p className="text-center text-[10px] md:text-xs text-slate-400 mt-4 md:mt-6">
        点击漂流瓶查看朋友详情 · 欢迎交换友链
      </p>

      {/* 详情弹窗 */}
      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setActive(null)}
          >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="relative w-full max-w-xs rounded-2xl md:rounded-3xl bg-white/70 dark:bg-slate-800/80 backdrop-blur-2xl border border-white/50 dark:border-white/10 shadow-2xl p-5 md:p-8 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                title="关闭"
                onClick={() => setActive(null)}
                className="absolute top-3 right-3 md:top-4 md:right-4 w-6 h-6 md:w-7 md:h-7 rounded-full bg-white/50 dark:bg-slate-700/50 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                <X className="w-3 h-3 md:w-3.5 md:h-3.5" />
              </button>

              <div className="flex justify-center mb-3 md:mb-4">
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-tr from-sky-400 via-indigo-400 to-purple-400 p-[3px] shadow-xl">
                  {active.avatar ? (
                    <img
                      src={active.avatar}
                      alt={active.name}
                      className="w-full h-full rounded-full object-cover bg-white dark:bg-slate-800"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center text-white text-xl md:text-2xl font-bold">
                      {active.name[0]}
                    </div>
                  )}
                </div>
              </div>

              <h2 className="text-base md:text-lg font-bold text-slate-800 dark:text-white mb-1.5 md:mb-2">
                {active.name}
              </h2>
              <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-4 md:mb-6">
                {active.description || "这个朋友很懒，没有留下描述~"}
              </p>
              <a
                href={active.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 md:gap-2 px-4 py-2 md:px-6 md:py-2.5 rounded-full bg-sky-500 text-white text-xs md:text-sm font-medium hover:bg-sky-600 transition-colors shadow-lg shadow-sky-500/20"
              >
                <ExternalLink className="w-3.5 h-3.5 md:w-4 md:h-4" />
                访问主页
              </a>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 申请弹层：v1.3 · max-w-md + glass-card/button/input · 详情瓶卡不动 */}
      <AnimatePresence>
        {applyOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={closeApply}
          >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="relative w-full max-w-md glass-card shadow-2xl rounded-2xl md:rounded-3xl bg-white/55 dark:bg-slate-800/60 p-5 md:p-8"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                title="关闭"
                onClick={closeApply}
                className="absolute top-3 right-3 md:top-4 md:right-4 w-6 h-6 md:w-7 md:h-7 rounded-full bg-white/50 dark:bg-slate-700/50 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                <X className="w-3 h-3 md:w-3.5 md:h-3.5" />
              </button>

              {applySuccess ? (
                <div className="text-center">
                  <div className="flex justify-center mb-3 md:mb-4">
                    <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-tr from-sky-400 via-indigo-400 to-purple-400 flex items-center justify-center shadow-xl">
                      <Check className="w-7 h-7 md:w-8 md:h-8 text-white" />
                    </div>
                  </div>
                  <h2 className="text-base md:text-lg font-bold text-slate-800 dark:text-white mb-1.5 md:mb-2">
                    瓶子已投放
                  </h2>
                  <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-4 md:mb-6">
                    等待审核；通过后会出现在友链海面。
                  </p>
                  <div className="mt-4 md:mt-6 flex flex-wrap justify-end items-center gap-2">
                    <button
                      type="button"
                      onClick={closeApply}
                      className="inline-flex items-center justify-center rounded-full bg-sky-500 hover:bg-sky-600 text-white text-xs md:text-sm font-semibold min-w-[6.5rem] px-5 py-2 md:px-6 md:py-2.5 shadow-lg shadow-sky-500/20 transition-colors"
                    >
                      好的
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-center">
                    <h2 className="text-base md:text-lg font-bold text-slate-800 dark:text-white mb-1.5 md:mb-2">
                      投放一只漂流瓶
                    </h2>
                    <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-4 md:mb-6">
                      填写后进入审核；通过后会出现在友链海面。
                    </p>
                  </div>

                  <div className="space-y-3 text-left">
                    <label className="block">
                      <span className="text-[11px] font-semibold tracking-wide text-slate-500">
                        站点名称 <span className="text-sky-500">*</span>
                      </span>
                      <input
                        className={`mt-1 ${fieldClass}`}
                        value={applyForm.name}
                        onChange={(e) =>
                          setApplyForm((f) => ({ ...f, name: e.target.value }))
                        }
                        maxLength={100}
                        placeholder="你的站点名"
                        autoComplete="organization"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-semibold tracking-wide text-slate-500">
                        站点链接 <span className="text-sky-500">*</span>
                      </span>
                      <input
                        className={`mt-1 ${fieldClass}`}
                        value={applyForm.url}
                        onChange={(e) =>
                          setApplyForm((f) => ({ ...f, url: e.target.value }))
                        }
                        maxLength={300}
                        placeholder="https://"
                        inputMode="url"
                        autoComplete="url"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-semibold tracking-wide text-slate-500">
                        头像链接
                      </span>
                      <input
                        className={`mt-1 ${fieldClass}`}
                        value={applyForm.avatar}
                        onChange={(e) =>
                          setApplyForm((f) => ({
                            ...f,
                            avatar: e.target.value,
                          }))
                        }
                        maxLength={500}
                        placeholder="https://…/avatar.png"
                        inputMode="url"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-semibold tracking-wide text-slate-500">
                        简介
                      </span>
                      <textarea
                        className={`mt-1 ${fieldClass} resize-none`}
                        rows={3}
                        value={applyForm.description}
                        onChange={(e) =>
                          setApplyForm((f) => ({
                            ...f,
                            description: e.target.value,
                          }))
                        }
                        maxLength={300}
                        placeholder="一句话介绍"
                      />
                    </label>
                    {/* 蜜罐 */}
                    <input
                      type="text"
                      name="website"
                      tabIndex={-1}
                      autoComplete="off"
                      value={applyForm.website}
                      onChange={(e) =>
                        setApplyForm((f) => ({
                          ...f,
                          website: e.target.value,
                        }))
                      }
                      className="absolute opacity-0 pointer-events-none h-0 w-0 overflow-hidden"
                      aria-hidden="true"
                    />
                  </div>

                  {applyError ? (
                    <p className="mt-3 text-left text-xs text-red-500">
                      {applyError}
                    </p>
                  ) : null}

                  <p className="mt-3 text-[10px] text-slate-400 text-left">
                    建议互链本站；头像请使用可公网访问的图片 URL。
                  </p>

                  <div className="mt-4 md:mt-6 flex flex-wrap justify-end items-center gap-2">
                    <button
                      type="button"
                      onClick={closeApply}
                      className="glass-button !rounded-full px-4 py-2 md:px-5 md:py-2.5 text-xs md:text-sm font-medium text-slate-600 dark:text-slate-300"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      disabled={applySubmitting}
                      onClick={submitApply}
                      className="inline-flex items-center justify-center rounded-full bg-sky-500 hover:bg-sky-600 disabled:opacity-60 text-white text-xs md:text-sm font-semibold min-w-[6.5rem] px-5 py-2 md:px-6 md:py-2.5 shadow-lg shadow-sky-500/20 transition-colors"
                    >
                      {applySubmitting ? "投递中…" : "投递"}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes bottle-float {
          0%, 100% { transform: translateY(0) rotate(var(--rot)); }
          25% { transform: translateY(-8px) rotate(calc(var(--rot) + 1deg)); }
          75% { transform: translateY(5px) rotate(calc(var(--rot) - 1deg)); }
        }
        @keyframes bottle-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
