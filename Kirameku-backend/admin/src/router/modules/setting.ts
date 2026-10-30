import { systemSetting } from "@/router/enums";
const Layout = () => import("@/layout/index.vue");

export default {
  path: "/setting",
  name: "SystemSetting",
  component: Layout,
  redirect: "/setting/external-api/index",
  meta: {
    icon: "ri:settings-4-line",
    title: "系统设置",
    rank: systemSetting
  },
  children: [
    {
      path: "/setting/external-api/index",
      name: "ExternalApiIndex",
      component: () => import("@/views/setting/external-api/index.vue"),
      meta: {
        title: "外部 API"
      }
    },
    {
      path: "/setting/site-setting/index",
      name: "SiteSettingIndex",
      component: () => import("@/views/setting/site-setting/index.vue"),
      meta: {
        title: "站点设置"
      }
    },
    {
      path: "/setting/about-page/index",
      name: "AboutPageIndex",
      component: () => import("@/views/setting/about-page/index.vue"),
      meta: {
        title: "关于页"
      }
    }
  ]
} satisfies RouteConfigsTable;
