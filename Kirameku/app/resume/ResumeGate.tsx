"use client";

import { useEffect, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { getGithubUser } from "@/app/api/messages";
import ResumeView from "./ResumeView";

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

type AuthState = "loading" | "guest" | "authed";

export default function ResumeGate() {
  const [auth, setAuth] = useState<AuthState>("loading");

  useEffect(() => {
    const token = localStorage.getItem("github_token");
    if (!token) {
      setAuth("guest");
      return;
    }
    let cancelled = false;
    getGithubUser(token)
      .then((u) => {
        localStorage.setItem("github_user", JSON.stringify(u));
        if (!cancelled) setAuth("authed");
      })
      .catch(() => {
        localStorage.removeItem("github_token");
        localStorage.removeItem("github_user");
        if (!cancelled) setAuth("guest");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleLogin() {
    sessionStorage.setItem("github_redirect", "/resume");
    window.location.href = "/api/auth/github/login";
  }

  if (auth === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
      </div>
    );
  }

  if (auth === "guest") {
    return (
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-16 md:py-24">
        <div className="rounded-3xl bg-white/50 dark:bg-slate-800/60 backdrop-blur-xl border border-white/30 dark:border-white/10 shadow-xl p-6 md:p-10 text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
            <FileText className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
            查看简历
          </h1>
          <p className="text-sm md:text-base text-slate-600 dark:text-slate-300 mb-6">
            请先使用 GitHub 登录后查看简历
          </p>
          <button
            type="button"
            onClick={handleLogin}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <GithubIcon className="w-4 h-4" />
            使用 GitHub 登录
          </button>
        </div>
      </div>
    );
  }

  return <ResumeView />;
}
