"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import FadeIn from "@/components/ui/FadeIn";
import {
  resumeProfile,
  resumeSkillGroups,
  resumeWorkExperience,
  resumeProjects,
  resumeOtherProjects,
  resumeEducation,
  resumeHonors,
  resumeSelfEvaluation,
  resumeContact,
  resumeSections,
} from "./resumeData";
import {
  FileText,
  Printer,
  ExternalLink,
  Mail,
  Globe,
  Briefcase,
  GraduationCap,
  ChevronRight,
} from "lucide-react";

const glassCard =
  "bg-white/40 dark:bg-slate-800/50 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/40 dark:border-white/10";

function PeriodBadge({ period }: { period: string }) {
  return (
    <span className="shrink-0 text-[10px] md:text-xs font-bold tracking-wide uppercase text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20 whitespace-nowrap">
      {period}
    </span>
  );
}

function SectionTitle({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2
      id={id}
      className="resume-section-title scroll-mt-28 text-lg md:text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-4 md:mb-6 flex items-center gap-2"
    >
      <span className="w-1 h-6 md:h-8 rounded-full bg-gradient-to-b from-indigo-500 to-sky-500" />
      {children}
    </h2>
  );
}

function BulletList({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="space-y-2 text-sm md:text-[15px] text-slate-700 dark:text-slate-300 leading-relaxed list-none">
      {items.map((item) => (
        <li key={item} className="flex gap-2.5">
          <ChevronRight className="w-4 h-4 shrink-0 mt-0.5 text-sky-500 dark:text-sky-400" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function ResumeView() {
  const handlePrint = () => {
    window.print();
  };

  return (
    <FadeIn className="resume-print-root w-full max-w-5xl mx-auto py-6 md:py-12 px-4 sm:px-6 lg:px-8 relative z-10">
      {/* 顶栏：标题 + 打印 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 md:mb-8">
        <div className="flex items-center gap-2 md:gap-3">
          <FileText className="w-5 h-5 md:w-7 md:h-7 text-indigo-600 dark:text-indigo-400" />
          <div>
            <h1 className="text-xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              在线简历
            </h1>
            <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 font-medium mt-0.5">
              可打印 / 导出 PDF
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handlePrint}
          className="resume-no-print inline-flex items-center justify-center gap-2 px-4 py-2.5 md:px-5 md:py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white text-sm font-bold shadow-lg transition-colors"
        >
          <Printer className="w-4 h-4" />
          打印 / 导出 PDF
        </button>
      </div>

      {/* 移动端锚点 */}
      <nav
        aria-label="简历章节"
        className="resume-no-print lg:hidden mb-6 -mx-1 overflow-x-auto scrollbar-thin"
      >
        <div className="flex gap-2 pb-1 px-1 min-w-max">
          {resumeSections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="text-xs font-semibold px-3 py-1.5 rounded-full bg-white/40 dark:bg-slate-800/50 border border-white/40 dark:border-white/10 text-slate-700 dark:text-slate-300 whitespace-nowrap"
            >
              {s.label}
            </a>
          ))}
        </div>
      </nav>

      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
        {/* 桌面侧栏锚点 */}
        <aside className="resume-no-print hidden lg:block w-44 shrink-0">
          <nav
            aria-label="简历章节"
            className={`${glassCard} p-4 sticky top-24 resume-sticky-nav`}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3">
              目录
            </p>
            <ul className="space-y-1">
              {resumeSections.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="block text-sm font-medium py-1.5 px-2 rounded-lg text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <div className={`resume-print-content flex-1 ${glassCard} p-5 md:p-10 lg:p-12 relative overflow-hidden`}>
          <div className="resume-no-print absolute -top-16 -right-16 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="resume-no-print absolute -bottom-20 -left-10 w-40 h-40 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* 概要 */}
          <section className="resume-block mb-10 md:mb-14 pb-8 md:pb-10 border-b border-slate-300/40 dark:border-slate-700/60">
            <SectionTitle id="summary">概要</SectionTitle>
            <div className="relative z-10">
              <p className="text-2xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
                {resumeProfile.name}
              </p>
              <p className="text-sm md:text-lg font-bold text-indigo-600 dark:text-indigo-400 mb-4 leading-snug">
                {resumeProfile.title}
              </p>
              <div className="flex flex-wrap gap-2 md:gap-3 mb-4">
                <span className="inline-flex items-center gap-1.5 text-xs md:text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-500/10 px-3 py-1.5 rounded-lg border border-slate-500/15">
                  <Briefcase className="w-3.5 h-3.5 text-sky-500" />
                  求职意向：{resumeProfile.jobIntent}
                </span>
                <span className="inline-flex items-center text-xs md:text-sm font-semibold text-slate-700 dark:text-slate-200 bg-sky-500/10 px-3 py-1.5 rounded-lg border border-sky-500/20">
                  经验 {resumeProfile.experienceSummary}
                </span>
              </div>
            </div>
          </section>

          {/* 技能 */}
          <section className="resume-block mb-10 md:mb-14">
            <SectionTitle id="skills">技能</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              {resumeSkillGroups.map((group) => (
                <div
                  key={group.id}
                  className="group relative rounded-2xl bg-white/30 dark:bg-slate-900/30 border border-white/30 dark:border-white/10 p-4 md:p-5 shadow-md hover:shadow-xl transition-shadow duration-500"
                >
                  <div className="resume-no-print absolute -top-8 -right-8 w-24 h-24 bg-sky-500/5 rounded-full blur-2xl group-hover:bg-sky-500/15 transition-colors duration-700" />
                  <h3 className="text-sm md:text-base font-bold text-slate-900 dark:text-white mb-3 relative z-10">
                    {group.title}
                  </h3>
                  <ul className="space-y-2 relative z-10">
                    {group.items.map((item) => (
                      <li
                        key={item}
                        className="text-xs md:text-sm text-slate-600 dark:text-slate-300 leading-relaxed pl-3 border-l-2 border-indigo-400/40 dark:border-indigo-500/30"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* 工作经历 */}
          <section className="resume-block mb-10 md:mb-14">
            <SectionTitle id="work">工作经历</SectionTitle>
            <div className="space-y-6 md:space-y-8">
              {resumeWorkExperience.map((job, idx) => (
                <article
                  key={job.id}
                  className="relative pl-4 md:pl-6 border-l-2 border-indigo-300/50 dark:border-indigo-500/40"
                >
                  {idx < resumeWorkExperience.length - 1 && (
                    <span className="resume-no-print absolute left-[-5px] top-8 bottom-0 w-0.5 bg-gradient-to-b from-indigo-400/30 to-transparent" />
                  )}
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                    <div>
                      <h3 className="text-base md:text-lg font-bold text-slate-900 dark:text-white">
                        {job.company}
                      </h3>
                      <p className="text-sm font-semibold text-sky-600 dark:text-sky-400">{job.role}</p>
                    </div>
                    <PeriodBadge period={job.period} />
                  </div>
                  <BulletList items={job.highlights} />
                </article>
              ))}
            </div>
          </section>

          {/* 项目经历 */}
          <section className="resume-block mb-10 md:mb-14">
            <SectionTitle id="projects">项目经历</SectionTitle>
            <div className="space-y-6 md:space-y-8">
              {resumeProjects.map((project) => (
                <article
                  key={project.id}
                  className="rounded-2xl border border-white/30 dark:border-white/10 bg-white/20 dark:bg-slate-900/20 p-4 md:p-6 shadow-lg"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base md:text-lg font-bold text-slate-900 dark:text-white">
                        {project.name}
                      </h3>
                      {project.demoUrl && (
                        <a
                          href={project.demoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="resume-no-print inline-flex items-center gap-1 text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline"
                        >
                          Demo
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    <PeriodBadge period={project.period} />
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                    {project.description}
                  </p>
                  <p className="text-xs md:text-sm font-semibold text-indigo-600/90 dark:text-indigo-400 mb-4">
                    技术栈：{project.stack}
                  </p>
                  {project.highlights.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                        亮点
                      </p>
                      <BulletList items={project.highlights} />
                    </div>
                  )}
                  {project.responsibilities.length > 0 && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                        职责
                      </p>
                      <BulletList items={project.responsibilities} />
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>

          {/* 其他项目 */}
          <section className="resume-block mb-10 md:mb-14">
            <SectionTitle id="other-projects">其他项目</SectionTitle>
            <div className="space-y-4">
              {resumeOtherProjects.map((p) => (
                <div
                  key={p.name}
                  className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 p-4 rounded-xl bg-white/25 dark:bg-slate-900/25 border border-white/20 dark:border-white/10"
                >
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm md:text-base">{p.name}</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{p.summary}</p>
                  </div>
                  <PeriodBadge period={p.period} />
                </div>
              ))}
            </div>
          </section>

          {/* 教育与荣誉 */}
          <section className="resume-block mb-10 md:mb-14">
            <SectionTitle id="education">教育与荣誉</SectionTitle>
            <div className="rounded-2xl p-4 md:p-6 bg-white/25 dark:bg-slate-900/25 border border-white/20 dark:border-white/10 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
                <div className="flex items-start gap-2">
                  <GraduationCap className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white">{resumeEducation.school}</h3>
                    <p className="text-sm text-sky-600 dark:text-sky-400 font-semibold">
                      {resumeEducation.major} · {resumeEducation.degree}
                    </p>
                  </div>
                </div>
                <PeriodBadge period={resumeEducation.period} />
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{resumeEducation.detail}</p>
            </div>
            <ul className="space-y-2">
              {resumeHonors.map((h) => (
                <li
                  key={h}
                  className="text-sm text-slate-700 dark:text-slate-300 flex gap-2 pl-3 border-l-2 border-sky-400/40"
                >
                  {h}
                </li>
              ))}
            </ul>
          </section>

          {/* 自评 */}
          <section className="resume-block mb-10 md:mb-14">
            <SectionTitle id="self-eval">自评</SectionTitle>
            <BulletList items={resumeSelfEvaluation} />
          </section>

          {/* 联系方式 */}
          <section className="resume-block">
            <SectionTitle id="contact">联系方式</SectionTitle>
            <ul className="space-y-3 text-sm md:text-base">
              <li className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                <Mail className="w-4 h-4 text-indigo-500 shrink-0" />
                <a
                  href={`mailto:${resumeContact.email}`}
                  className="font-medium hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  {resumeContact.email}
                </a>
              </li>
              <li className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                <Globe className="w-4 h-4 text-sky-500 shrink-0" />
                <Link
                  href={resumeContact.blogUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
                >
                  {resumeContact.blogLabel}（{resumeContact.blogUrl}）
                </Link>
              </li>
              {resumeContact.githubUrl ? (
                <li className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                  <ExternalLink className="w-4 h-4 shrink-0" />
                  <a
                    href={resumeContact.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium hover:underline"
                  >
                    GitHub
                  </a>
                </li>
              ) : null}
            </ul>
          </section>
        </div>
      </div>
    </FadeIn>
  );
}
