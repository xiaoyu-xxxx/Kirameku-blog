import { demoCase } from "@/router/enums";

const Layout = () => import("@/layout/index.vue");

export default {
  path: "/demo-case",
  name: "DemoCase",
  component: Layout,
  redirect: "/demo-case/index",
  meta: {
    icon: "ri:window-line",
    title: "案例 Demo",
    rank: demoCase
  },
  children: [
    {
      path: "/demo-case/index",
      name: "DemoCaseIndex",
      component: () => import("@/views/demo-case/index.vue"),
      meta: {
        title: "案例管理"
      }
    }
  ]
} satisfies RouteConfigsTable;
