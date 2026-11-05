import { githubUser } from "@/router/enums";
const Layout = () => import("@/layout/index.vue");

export default {
  path: "/github-user",
  name: "GithubUser",
  component: Layout,
  redirect: "/github-user/index",
  meta: {
    icon: "ri:github-fill",
    title: "前台用户",
    rank: githubUser
  },
  children: [
    {
      path: "/github-user/index",
      name: "GithubUserIndex",
      component: () => import("@/views/github-user/index.vue"),
      meta: {
        title: "前台用户"
      }
    }
  ]
} satisfies RouteConfigsTable;
