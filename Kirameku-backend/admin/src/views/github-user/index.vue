<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { useRouter } from "vue-router";
import { message } from "@/utils/message";
import {
  getAdminGithubUsers,
  getAdminGithubUser,
  banGithubUser,
  unbanGithubUser
} from "@/api/github-user";
import type { GithubUserItem, GithubUserDetail } from "@/api/github-user";
import type { PaginationProps } from "@pureadmin/table";

defineOptions({ name: "GithubUserIndex" });

const router = useRouter();
const loading = ref(false);
const dataList = ref<GithubUserItem[]>([]);
const keyword = ref("");
/** "" | "false" | "true" */
const banFilter = ref("");

const pagination = reactive<PaginationProps>({
  total: 0,
  pageSize: 20,
  currentPage: 1,
  background: true
});

const columns: TableColumnList = [
  { label: "头像", prop: "avatar", width: 64, slot: "avatar" },
  { label: "登录名", prop: "login", minWidth: 120, slot: "login" },
  { label: "简介", prop: "bio", minWidth: 160, slot: "bio" },
  { label: "评论", prop: "comment_count", width: 72 },
  { label: "留言", prop: "message_count", width: 72 },
  { label: "状态", prop: "is_banned", width: 96, slot: "status" },
  {
    label: "注册时间",
    prop: "created_at",
    minWidth: 160,
    formatter: ({ created_at }) =>
      created_at ? String(created_at).replace("T", " ").slice(0, 19) : ""
  },
  { label: "操作", fixed: "right", width: 180, slot: "operation" }
];

async function onSearch() {
  loading.value = true;
  try {
    const params: {
      q?: string;
      is_banned?: boolean;
      page: number;
      size: number;
    } = {
      page: pagination.currentPage,
      size: pagination.pageSize
    };
    const q = keyword.value.trim();
    if (q) params.q = q;
    if (banFilter.value === "true") params.is_banned = true;
    if (banFilter.value === "false") params.is_banned = false;

    const res = await getAdminGithubUsers(params);
    dataList.value = res?.items ?? [];
    pagination.total = res?.total ?? 0;
  } catch (e: any) {
    message(e?.message ?? "加载失败", { type: "error" });
  } finally {
    loading.value = false;
  }
}

function handleSizeChange(val: number) {
  pagination.pageSize = val;
  pagination.currentPage = 1;
  onSearch();
}

function handleCurrentChange(val: number) {
  pagination.currentPage = val;
  onSearch();
}

function resetAndSearch() {
  pagination.currentPage = 1;
  onSearch();
}

function openGithub(login: string) {
  if (!login) return;
  window.open(`https://github.com/${login}`, "_blank", "noopener,noreferrer");
}

// ---- 禁用对话框 ----
const banDialogVisible = ref(false);
const banTarget = ref<GithubUserItem | null>(null);
const banReason = ref("");
const banSubmitting = ref(false);

function openBanDialog(row: GithubUserItem) {
  banTarget.value = row;
  banReason.value = "";
  banDialogVisible.value = true;
}

async function confirmBan() {
  if (!banTarget.value) return;
  banSubmitting.value = true;
  try {
    await banGithubUser(banTarget.value.id, banReason.value.trim());
    message("已禁用", { type: "success" });
    banDialogVisible.value = false;
    onSearch();
    if (detailVisible.value && detail.value?.id === banTarget.value.id) {
      await loadDetail(banTarget.value.id);
    }
  } catch (e: any) {
    message(e?.message ?? "禁用失败", { type: "error" });
  } finally {
    banSubmitting.value = false;
  }
}

async function handleUnban(row: GithubUserItem) {
  try {
    await unbanGithubUser(row.id);
    message("已解禁", { type: "success" });
    onSearch();
    if (detailVisible.value && detail.value?.id === row.id) {
      await loadDetail(row.id);
    }
  } catch (e: any) {
    message(e?.message ?? "解禁失败", { type: "error" });
  }
}

// ---- 详情抽屉 ----
const detailVisible = ref(false);
const detailLoading = ref(false);
const detail = ref<GithubUserDetail | null>(null);

async function loadDetail(id: number) {
  detailLoading.value = true;
  try {
    detail.value = await getAdminGithubUser(id);
  } catch (e: any) {
    message(e?.message ?? "加载详情失败", { type: "error" });
  } finally {
    detailLoading.value = false;
  }
}

async function openDetail(row: GithubUserItem) {
  detailVisible.value = true;
  detail.value = null;
  await loadDetail(row.id);
}

function goCommentAdmin() {
  router.push("/comment/index");
}

function goMessageAdmin() {
  router.push("/message/index");
}

function formatTime(v?: string | null) {
  return v ? String(v).replace("T", " ").slice(0, 19) : "—";
}

function statusLabel(status: string) {
  if (status === "approved") return "已通过";
  if (status === "pending") return "待审核";
  if (status === "rejected") return "已拒绝";
  return status || "—";
}

onMounted(() => onSearch());
</script>

<template>
  <div class="github-user-page min-w-0">
    <el-card
      shadow="never"
      class="github-user-card min-w-0"
      :body-style="{
        padding: '12px 16px 16px',
        minWidth: '0',
        overflow: 'hidden'
      }"
    >
      <template #header>
        <div class="github-user-toolbar min-w-0">
          <div class="github-user-toolbar__left min-w-0">
            <span class="font-medium shrink-0">前台用户</span>
            <el-input
              v-model="keyword"
              clearable
              placeholder="搜索 login"
              class="github-user-search"
              @keyup.enter="resetAndSearch"
              @clear="resetAndSearch"
            />
            <el-radio-group
              v-model="banFilter"
              size="small"
              class="shrink-0"
              @change="resetAndSearch"
            >
              <el-radio-button label="">全部</el-radio-button>
              <el-radio-button label="false">正常</el-radio-button>
              <el-radio-button label="true">已禁用</el-radio-button>
            </el-radio-group>
          </div>
          <div class="github-user-toolbar__right shrink-0">
            <el-button @click="onSearch">刷新</el-button>
          </div>
        </div>
      </template>

      <div class="github-user-table-wrap min-w-0">
        <pure-table
          :data="dataList"
          :columns="columns"
          :loading="loading"
          :pagination="pagination"
          align-whole="center"
          row-key="id"
          table-layout="fixed"
          adaptive
          @page-size-change="handleSizeChange"
          @page-current-change="handleCurrentChange"
        >
          <template #avatar="{ row }">
            <el-avatar :src="row.avatar" :size="24">
              {{ (row.login || "?").slice(0, 1) }}
            </el-avatar>
          </template>

          <template #login="{ row }">
            <el-link
              type="primary"
              :underline="false"
              @click="openGithub(row.login)"
            >
              {{ row.login }}
            </el-link>
          </template>

          <template #bio="{ row }">
            <span class="bio-cell" :title="row.bio || ''">
              {{ row.bio || "—" }}
            </span>
          </template>

          <template #status="{ row }">
            <el-tag :type="row.is_banned ? 'danger' : 'success'" size="small">
              {{ row.is_banned ? "已禁用" : "正常" }}
            </el-tag>
          </template>

          <template #operation="{ row }">
            <el-button link type="primary" size="small" @click="openDetail(row)">
              详情
            </el-button>
            <el-button
              v-if="!row.is_banned"
              link
              type="danger"
              size="small"
              @click="openBanDialog(row)"
            >
              禁用
            </el-button>
            <el-popconfirm
              v-else
              title="确认解禁该用户？"
              @confirm="handleUnban(row)"
            >
              <template #reference>
                <el-button link type="success" size="small">解禁</el-button>
              </template>
            </el-popconfirm>
          </template>
        </pure-table>

        <el-empty
          v-if="!loading && dataList.length === 0"
          description="暂无 GitHub 登录用户"
          :image-size="80"
        />
      </div>
    </el-card>

    <!-- 禁用原因对话框 -->
    <el-dialog
      v-model="banDialogVisible"
      title="禁用用户"
      width="420px"
      destroy-on-close
    >
      <p class="mb-3 text-sm text-gray-500">
        将禁用
        <strong>{{ banTarget?.login }}</strong>
        。禁用后仍可识别身份，但无法再发评论/留言。
      </p>
      <el-input
        v-model="banReason"
        type="textarea"
        :rows="3"
        maxlength="200"
        show-word-limit
        placeholder="可选：禁用原因（≤200 字）"
      />
      <template #footer>
        <el-button @click="banDialogVisible = false">取消</el-button>
        <el-button type="danger" :loading="banSubmitting" @click="confirmBan">
          确认禁用
        </el-button>
      </template>
    </el-dialog>

    <!-- 详情抽屉 -->
    <el-drawer
      v-model="detailVisible"
      title="用户详情"
      size="420px"
      destroy-on-close
    >
      <div v-loading="detailLoading" class="detail-body min-w-0">
        <template v-if="detail">
          <div class="flex items-center gap-3 mb-4">
            <el-avatar :src="detail.avatar" :size="48" />
            <div class="min-w-0">
              <el-link
                type="primary"
                :underline="false"
                @click="openGithub(detail.login)"
              >
                {{ detail.login }}
              </el-link>
              <div class="mt-1">
                <el-tag
                  :type="detail.is_banned ? 'danger' : 'success'"
                  size="small"
                >
                  {{ detail.is_banned ? "已禁用" : "正常" }}
                </el-tag>
              </div>
            </div>
          </div>

          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="ID">{{ detail.id }}</el-descriptions-item>
            <el-descriptions-item label="GitHub ID">
              {{ detail.github_id }}
            </el-descriptions-item>
            <el-descriptions-item label="简介">
              {{ detail.bio || "—" }}
            </el-descriptions-item>
            <el-descriptions-item label="注册时间">
              {{ formatTime(detail.created_at) }}
            </el-descriptions-item>
            <el-descriptions-item label="评论数">
              {{ detail.comment_count }}
            </el-descriptions-item>
            <el-descriptions-item label="留言数">
              {{ detail.message_count }}
            </el-descriptions-item>
            <el-descriptions-item v-if="detail.is_banned" label="禁用时间">
              {{ formatTime(detail.banned_at) }}
            </el-descriptions-item>
            <el-descriptions-item v-if="detail.is_banned" label="禁用原因">
              {{ detail.ban_reason || "—" }}
            </el-descriptions-item>
          </el-descriptions>

          <div class="mt-4 flex gap-2">
            <el-button size="small" @click="goCommentAdmin">
              去评论管理
            </el-button>
            <el-button size="small" @click="goMessageAdmin">
              去留言管理
            </el-button>
          </div>

          <div class="mt-5">
            <div class="font-medium mb-2">最近评论</div>
            <div
              v-if="!detail.recent_comments?.length"
              class="text-sm text-gray-400"
            >
              暂无
            </div>
            <div
              v-for="item in detail.recent_comments"
              :key="'c-' + item.id"
              class="activity-item"
            >
              <div class="flex items-center gap-2 mb-1">
                <el-tag size="small">#{{ item.id }}</el-tag>
                <el-tag size="small" type="info">
                  {{ statusLabel(item.status) }}
                </el-tag>
                <span class="text-xs text-gray-400">
                  {{ formatTime(item.created_at) }}
                </span>
              </div>
              <div class="text-sm break-words">{{ item.content || "—" }}</div>
            </div>
          </div>

          <div class="mt-5">
            <div class="font-medium mb-2">最近留言</div>
            <div
              v-if="!detail.recent_messages?.length"
              class="text-sm text-gray-400"
            >
              暂无
            </div>
            <div
              v-for="item in detail.recent_messages"
              :key="'m-' + item.id"
              class="activity-item"
            >
              <div class="flex items-center gap-2 mb-1">
                <el-tag size="small">#{{ item.id }}</el-tag>
                <el-tag size="small" type="info">
                  {{ statusLabel(item.status) }}
                </el-tag>
                <span class="text-xs text-gray-400">
                  {{ formatTime(item.created_at) }}
                </span>
              </div>
              <div class="text-sm break-words">{{ item.content || "—" }}</div>
            </div>
          </div>
        </template>
      </div>
    </el-drawer>
  </div>
</template>

<style scoped>
.github-user-page {
  padding: 16px;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  overflow-x: hidden;
}

.github-user-card {
  width: 100%;
  max-width: 100%;
}

.github-user-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.github-user-toolbar__left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1 1 auto;
  flex-wrap: wrap;
}

.github-user-search {
  width: 200px;
  max-width: 100%;
}

.github-user-table-wrap {
  width: 100%;
  overflow-x: hidden;
}

.bio-cell {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
}

.activity-item {
  padding: 8px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.activity-item:last-child {
  border-bottom: none;
}

.detail-body {
  width: 100%;
}
</style>
