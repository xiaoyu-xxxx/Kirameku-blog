import { live2dAdmin } from "@/router/enums";
const Layout = () => import("@/layout/index.vue");

export default {
  path: "/live2d",
  name: "Live2DAdmin",
  component: Layout,
  redirect: "/live2d/index",
  meta: {
    icon: "ri:user-smile-line",
    title: "看板娘",
    rank: live2dAdmin
  },
  children: [
    {
      path: "/live2d/index",
      name: "Live2DAdminIndex",
      component: () => import("@/views/live2d/index.vue"),
      meta: {
        title: "模型与皮肤"
      }
    }
  ]
} satisfies RouteConfigsTable;
