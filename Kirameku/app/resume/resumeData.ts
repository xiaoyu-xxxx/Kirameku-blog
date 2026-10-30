/**
 * 简历页内容数据源 — 与旧站 resume 模块字段一致。
 */

export const resumeMeta = {
  pageTitle: "小雨 · AI 应用开发（前端 + Agent）",
  description: "前端与 AI Agent 方向，Vue/React/uniapp 与 LLM 应用实践。",
  defaultSiteTitle: "小雨的个人博客",
  defaultDescription:
    "一款基于Vue3、element-plus开发的个人博客网站，用于记录自己的前端学习、生活等",
};

export const resumeProfile = {
  name: "小雨",
  title: "AI 应用开发工程师（前端 + AI Agent 方向）",
  jobIntent: "AI 应用开发（前端 + Agent）",
  experienceSummary: "4 年",
};

export type ResumeSkillGroup = {
  id: string;
  title: string;
  items: string[];
};

export const resumeSkillGroups: ResumeSkillGroup[] = [
  {
    id: "ai-agent",
    title: "AI 与 Agent 开发",
    items: [
      "熟悉大模型应用开发：主流 LLM API（OpenAI/Claude/DeepSeek）、Prompt 工程、Function Calling、SSE 流式输出",
      "了解 Agent 编排与 RAG（LangChain/LangGraph、Dify，向量库 + Embedding）；具备 AI 应用前端（对话 UI、Markdown 渲染、WebSocket）",
      "了解 MCP，能结合前端构建 AI 工具型产品交互界面",
    ],
  },
  {
    id: "frontend-base",
    title: "前端基础（HTML/CSS/JS）",
    items: [
      "熟悉 W3C；熟练 HTML5/CSS3；Flex/rem/vw/vh/媒体查询；Sass/Less",
      "熟练 DOM/BOM；熟悉作用域/闭包/原型链；熟悉 ES6；熟练箭头函数/解构赋值/Promise",
    ],
  },
  {
    id: "frameworks",
    title: "框架/库/多端",
    items: [
      "熟练 Vue 全家桶（vue-router/vuex/axios/socketIO）及 ElementUI/Quasar/vant/Ant Design of Vue；熟练 Vue3；熟悉 React18 及生态（Router/RTK/Zustand/Next.js/Ant Design）",
      "熟练 Nuxt.js SSR/SEO；熟练 uniapp/微信开发者工具做微信支付宝小程序与 Android；uview/ucharts",
      "熟悉 Bootstrap、jQuery UI",
    ],
  },
  {
    id: "gis-engineering",
    title: "GIS 可视化与工程化",
    items: [
      "项目落地 ArcGIS、ECharts、uniapp 移动端 GIS（RenderJS）",
      "熟练 Git；会 Vite；可独立打包部署与 Android 打包；了解单元测试与 TestCafe；熟悉蓝湖/PS",
    ],
  },
  {
    id: "backend-db",
    title: "后端与数据库（基础）",
    items: [
      "具备 Python 基础（Flask/FastAPI 简单接口与脚本）",
      "了解 Node.js 基础（不宣称精通）",
      "具备 MySQL 基础",
    ],
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
    id: "daoke",
    period: "2025.05–至今",
    company: "珠海道可科技有限公司",
    role: "前端工程师",
    highlights: [
      "负责 AI 应用前端架构与界面开发，搭建流式对话 UI（SSE 实时输出、Markdown / 图表渲染与会话上下文管理）",
      "参与 LLM / Agent 工具编排，基于 Function-Calling 接入数据统计、行情计算工具，支撑复杂业务分析",
      "配合 Python FastAPI 后端与向量数据库完成 RAG 知识库对接，负责接口联调、参数校验与跨端问题定位",
      "封装可复用对话组件，优化交互体验与异常容错逻辑",
    ],
  },
  {
    id: "yaoqi",
    period: "2022.09–2025.04",
    company: "珠海曜麒资讯科技有限公司",
    role: "前端工程师",
    highlights: [
      "负责产品前端开发：页面交互、数据渲染与模块迭代维护",
      "与后端对接接口，联调页面功能，保障需求按期交付",
      "负责代码集成与部署，跟进进度与质量",
      "参与产品初期调研、方案策划、技术研讨与框架搭建",
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
    id: "cr-power",
    period: "2025.05–2026.10",
    name: "华润电力交易辅助决策支持系统",
    description:
      "面向电力交易业务人员的辅助决策系统，整合电力政策文件、历史交易数据、市场公告等资料。通过大模型 RAG 检索与 Agent 工具调用能力，辅助完成政策解读、交易数据查询、行情分析、方案生成，降低查阅海量文档与手工统计成本，提升交易研判效率。",
    stack: "React + TypeScript + Vite；Python FastAPI；LLM API / RAG",
    highlights: [
      "开发流式对话 UI 组件，基于 SSE 实现实时输出，优化 Markdown / 图表渲染与会话上下文管理",
      "基于 Function-Calling 开发 Agent 工具编排能力，支持调用数据统计、行情计算工具完成复杂业务分析",
      "参与后端应用层开发，使用 Python FastAPI 编写业务接口，对接向量数据库完成知识库 CRUD；完成参数校验、限流、异常捕获，实现前后端契约对齐并定位跨端问题",
    ],
    responsibilities: [
      "负责 AI 模块前端架构与界面开发",
      "完成 LLM、Agent 相关接口联调",
      "封装可复用对话组件，优化交互体验与异常容错逻辑",
    ],
    demoUrl: null,
    articleId: null,
  },
  {
    id: "hk-housing",
    period: "2024.01–2025.04",
    name: "香港屋宇署政务系统",
    description: "香港政府部门内部招投标系统，服务市民与政商各界的用地审批管理。",
    stack: "Vue2 + ArcGIS + bootstrap-vue",
    highlights: [],
    responsibilities: [
      "负责部分模块需求变更与功能迭代",
      "对接测试，快速定位并修复历史遗留 Bug",
      "针对首屏请求过多、页面渲染数据量大等问题做优化，缩短白屏时间",
      "使用 TestCafe 对部分模块做端到端测试",
    ],
    demoUrl: null,
    articleId: null,
  },
  {
    id: "macau-culture",
    period: "2023.05–2023.12",
    name: "澳门文化局分龄审别系统",
    description:
      "澳门文化局影视审核平台，提升公民申请与工作人员审批效率；公开场合放映 / 演出等活动均需在此平台申请。",
    stack: "Vue2 + Element UI + ECharts + webUpload",
    highlights: [
      "基于 Vue2 + Element UI 搭建架构，用 Sass 搭建多端适配底座",
      "用户端以复杂表单为主：校验、动态表单生成等",
      "大文件分片上传、断点续传、秒传，提升上传体验",
      "使用 Flex、媒体查询完成移动端适配",
    ],
    responsibilities: [],
    demoUrl: null,
    articleId: null,
  },
  {
    id: "crc-gas",
    period: "2022.09–2023.04",
    name: "华润燃气 SCADA 物联网工控平台",
    description:
      "采集燃气站点、管道、阀门数据，实时监测并下发指令处理异常告警，提升各部门响应效率。",
    stack: "Vue2 + vant + ECharts + uniapp + ArcGIS",
    highlights: [
      "管网图数据卡片与坐标点关联；vueDraggable 拖拽；Socket 实时更新卡片数据",
      "移动端用 uniapp 开发并以 WGT 包发布，侧重 ECharts 与 ArcGIS 展示；组件采用 RenderJS 双渲染引擎提升流畅度",
      "ArcGIS 将管网图与地图结合，配合 uniapp RenderJS 实现移动端 GIS，方便外勤使用",
    ],
    responsibilities: ["PC 端业务层开发", "移动端架构设计与开发"],
    demoUrl: null,
    articleId: null,
  },
  {
    id: "haika-carwash",
    period: "2022.06–2022.09",
    name: "嗨卡智能洗车",
    description:
      "24 小时智能洗车服务，微信 / 支付宝多端发布；用户扫码启动设备，完成计费扣款、套餐购买、会员重置、加盟入驻等。商家入驻 1000+，日活约 3000，运行平稳无重大 Bug。",
    stack: "Vue2 + uniapp + axios + uview + ucharts",
    highlights: [],
    responsibilities: [
      "首页轮播图与轮播视频无缝切换",
      "优化页面异常卡顿",
      "开发快捷菜单悬浮球",
      "支付宝 / 微信小程序平台差异与机型适配",
    ],
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
    period: "2022.03–2022.06",
    name: "智慧乐跑",
    summary: "uniapp 运动类 App，GPS 轨迹 / 配速记录与拍照打卡，已获软著；含地图绘制与多端打包",
  },
  {
    period: "2021.08–2021.12",
    name: "湖北省商务厅节假日消费券发放监测系统",
    summary: "对接支付宝 / 微信 / 美团 / 云闪付监测核销数据，ECharts 多维可视化，已获软著",
  },
];

export const resumeEducation = {
  period: "2020.09–2023.06",
  school: "武汉城市职业学院",
  major: "移动应用开发",
  degree: "大专",
  detail:
    "主修 HTML、CSS3、JavaScript、微信小程序、uniapp、MySQL、PHP、UI 设计；大二起自学 Vue、ES6，工作室课题实践并申请多项软著，暑期企业实习约两月，熟悉企业开发规范",
};

export const resumeHonors = [
  "21 级网页技能大赛二等奖、22 级网页技能大赛一等奖",
  "湖北省 2022 届信创大赛省赛三等奖",
  "「智慧乐跑 APP」等多项软著",
  "校优秀青年志愿者、优秀共青团员、优秀学生等",
];

export const resumeSelfEvaluation = [
  "执行力强，能快速融入团队并落实任务，独立解决常见技术问题",
  "逻辑清晰，工作细致，乐于与同事、用户沟通推进交付",
  "持续跟进 AI 应用开发（LLM 集成、Agent 编排、RAG），并保持前端工程化与多端落地能力",
  "习惯通过博客与实践拓宽技术视野，对新技术保持好奇与落地意愿",
];

export const resumeContact = {
  email: "contact@example.com",
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
  { id: "self-eval", label: "自评" },
  { id: "contact", label: "联系方式" },
];
