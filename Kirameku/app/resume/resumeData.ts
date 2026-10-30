/**
 * 简历页内容数据源 — 公网脱敏版（隐私优先）。
 */

export const resumeMeta = {
  pageTitle: "小雨 · AI 应用开发（前端 + Agent）",
  description: "前端与 AI Agent 方向，Vue / React / uniapp 与 LLM 应用实践。",
  defaultSiteTitle: "小雨的个人博客",
  defaultDescription:
    "一款基于Vue3、element-plus开发的个人博客网站，用于记录自己的前端学习、生活等",
};

export const resumeProfile = {
  name: "小雨",
  title: "AI 应用开发工程师（前端 + AI Agent 方向）",
  jobIntent: "AI 应用开发（前端 + Agent）",
  experienceSummary: "近 4 年前端相关实践（含实习与校内；全职约 2.5 年）",
};

export type ResumeSkillGroup = {
  id: string;
  title: string;
  tags: string[];
  summary: string;
};

export const resumeSkillGroups: ResumeSkillGroup[] = [
  {
    id: "ai-agent",
    title: "AI 与 Agent",
    tags: ["LLM API", "Prompt", "Function Calling", "SSE", "RAG", "LangChain", "MCP"],
    summary: "熟悉主流 LLM 接入与流式对话前端；了解 Agent / RAG 编排，能落地工具型 AI 交互界面。",
  },
  {
    id: "frontend-base",
    title: "前端基础",
    tags: ["HTML5", "CSS3", "JavaScript", "ES6", "Flex", "Sass"],
    summary: "熟练页面结构与响应式布局，熟悉闭包 / 原型链等基础与常见工程写法。",
  },
  {
    id: "frameworks",
    title: "框架与多端",
    tags: ["Vue2/3", "React18", "Next.js", "uniapp", "小程序", "Nuxt"],
    summary: "熟练 Vue 生态与组件库；熟悉 React 生态；可做微信 / 支付宝小程序与多端打包。",
  },
  {
    id: "gis-engineering",
    title: "可视化与工程化",
    tags: ["ArcGIS", "ECharts", "Git", "Vite", "TestCafe"],
    summary: "项目中落地 GIS / 图表可视化；能独立构建、部署与基础自动化测试。",
  },
  {
    id: "backend-db",
    title: "后端基础",
    tags: ["Python", "FastAPI", "Node.js", "MySQL"],
    summary: "具备简单接口与脚本能力，配合后端完成联调；不宣称全栈精通。",
  },
];

export type ResumeWorkItem = {
  id: string;
  period: string;
  company: string;
  role: string;
  highlights: string[];
};

export const resumeWorkExperience: ResumeWorkItem[] = [
  {
    id: "energy-ai",
    period: "2025.05–至今",
    company: "某能源信息化科技公司",
    role: "前端工程师",
    highlights: [
      "负责 AI 应用前端：流式对话 UI（SSE、Markdown / 图表渲染与会话上下文）",
      "参与 LLM / Agent 工具编排与 RAG 联调，封装可复用对话组件并优化容错",
    ],
  },
  {
    id: "gov-soft",
    period: "2022.09–2025.04",
    company: "某政企信息化服务商",
    role: "前端工程师",
    highlights: [
      "负责产品前端开发、接口联调与模块迭代，保障需求按期交付",
      "参与框架搭建、代码集成与部署，跟进进度与质量",
    ],
  },
];

export type ResumeProject = {
  id: string;
  period: string;
  name: string;
  description: string;
  stack: string;
  highlights: string[];
  responsibilities: string[];
  demoUrl: string | null;
  articleId: string | null;
};

export const resumeProjects: ResumeProject[] = [
  {
    id: "power-trading-ai",
    period: "2025.05–2026.10",
    name: "某电力交易辅助决策系统",
    description:
      "面向交易业务的辅助决策：政策 / 公告 / 历史数据检索与分析。结合 RAG 与 Agent 工具调用，辅助政策解读、数据查询与方案生成。",
    stack: "React + TypeScript + Vite；Python FastAPI；LLM / RAG",
    highlights: [
      "流式对话 UI（SSE）与 Markdown / 图表渲染",
      "Function-Calling 接入统计与行情类工具；联调向量库知识库接口",
    ],
    responsibilities: ["AI 模块前端架构与界面", "LLM / Agent 接口联调"],
    demoUrl: null,
    articleId: null,
  },
  {
    id: "scada-iot",
    period: "2022.09–2023.04",
    name: "某燃气物联网 SCADA 监测平台",
    description:
      "站点 / 管网 / 阀门数据采集与异常告警；PC + 移动端 GIS 展示，支撑外勤与值班响应。",
    stack: "Vue2 + uniapp + ECharts + ArcGIS + Socket",
    highlights: [
      "管网图卡片与坐标关联、拖拽与 Socket 实时刷新",
      "uniapp + RenderJS 移动端 GIS，提升地图页流畅度",
    ],
    responsibilities: ["PC 业务层", "移动端架构与开发"],
    demoUrl: null,
    articleId: null,
  },
  {
    id: "gov-media-review",
    period: "2023.05–2023.12",
    name: "某政务影视审核与申请平台",
    description:
      "公开放映 / 演出等活动线上申请与审批，侧重复杂表单与大文件上传体验。",
    stack: "Vue2 + Element UI + ECharts + webUpload",
    highlights: [
      "动态表单与复杂校验；Sass 多端适配底座",
      "大文件分片上传、断点续传与秒传",
    ],
    responsibilities: [],
    demoUrl: null,
    articleId: null,
  },
];

export type ResumeOtherProject = {
  period: string;
  name: string;
  summary: string;
};

export const resumeOtherProjects: ResumeOtherProject[] = [
  {
    period: "2024.01–2025.04",
    name: "某境外政务招投标系统",
    summary: "Vue2 + ArcGIS；模块迭代、首屏优化与 TestCafe 端到端测试",
  },
  {
    period: "2022.06–2022.09",
    name: "某智能洗车小程序",
    summary: "uniapp 微信 / 支付宝多端；计费套餐与机型适配，运行平稳",
  },
  {
    period: "2022.03–2022.06",
    name: "某运动打卡 App",
    summary: "uniapp；GPS 轨迹与配速；已获软著",
  },
  {
    period: "2021.08–2021.12",
    name: "某省级消费券发放监测",
    summary: "多支付平台核销监测与 ECharts 可视化；已获软著",
  },
];

export const resumeEducation = {
  period: "2020.09–2023.06",
  school: "某高职院校",
  major: "移动应用开发",
  degree: "大专",
  detail: "前端与小程序方向；校内课题与软著实践，暑期企业实习。",
};

export const resumeHonors = [
  "校级网页技能竞赛一等奖、二等奖",
  "省级信创类竞赛省赛三等奖",
  "多项计算机软件著作权",
  "校级优秀学生 / 志愿者等荣誉",
];

export const resumeContact = {
  email: "",
  contactHint: "站内留言或前往「关于」页联系",
  blogUrl: "https://blog.xiaoyu-hh.cn/",
  blogLabel: "个人博客",
  githubUrl: "",
};

export type ResumeSection = {
  id: string;
  label: string;
};

export const resumeSections: ResumeSection[] = [
  { id: "summary", label: "概要" },
  { id: "skills", label: "技能" },
  { id: "work", label: "工作经历" },
  { id: "projects", label: "项目经历" },
  { id: "other-projects", label: "其他项目" },
  { id: "education", label: "教育与荣誉" },
  { id: "contact", label: "联系方式" },
];