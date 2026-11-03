<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { message } from "@/utils/message";
import {
  getFriendLinks,
  createFriendLink,
  updateFriendLink,
  deleteFriendLink,
  uploadImage
} from "@/api/friend-link";
import type { FriendLinkItem } from "@/api/friend-link";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";

defineOptions({ name: "FriendLinkIndex" });

type StatusFilter = "all" | "pending" | "approved";

const FRONT_FRIENDS_URL = "https://blog.xiaoyu-hh.cn/friends";

const loading = ref(false);
const dataList = ref<FriendLinkItem[]>([]);
const statusFilter = ref<StatusFilter>("all");
const selectedId = ref<number | null>(null);

const pendingCount = computed(
  () => dataList.value.filter(r => !r.is_approved).length
);

const approvedList = computed(() =>
  dataList.value.filter(r => r.is_approved)
);

const filteredList = computed(() => {
  if (statusFilter.value === "pending") {
    return dataList.value.filter(r => !r.is_approved);
  }
  if (statusFilter.value === "approved") {
    return dataList.value.filter(r => r.is_approved);
  }
  return dataList.value;
});

const selectedRow = computed(() => {
  if (selectedId.value == null) return null;
  return dataList.value.find(r => r.id === selectedId.value) ?? null;
});

const columns: TableColumnList = [
  {
    label: "头像",
    prop: "avatar",
    width: 64,
    slot: "avatar"
  },
  {
    label: "名称",
    prop: "name",
    minWidth: 120,
    slot: "name"
  },
  {
    label: "链接",
    prop: "url",
    minWidth: 140,
    slot: "url"
  },
  {
    label: "状态",
    prop: "is_approved",
    width: 88,
    slot: "status"
  },
  { label: "排序", prop: "sort", width: 72 },
  { label: "操作", fixed: "right", width: 160, slot: "operation" }
];

async function onSearch() {
  loading.value = true;
  try {
    dataList.value = await getFriendLinks();
    if (
      selectedId.value != null &&
      !dataList.value.some(r => r.id === selectedId.value)
    ) {
      selectedId.value = null;
    }
  } finally {
    loading.value = false;
  }
}

function onRowClick(row: FriendLinkItem) {
  selectedId.value = row.id;
}

function selectApproved(id: number) {
  selectedId.value = id;
}

watch(filteredList, list => {
  if (
    selectedId.value != null &&
    !list.some(r => r.id === selectedId.value)
  ) {
    // keep selection even if filtered out — preview still shows from dataList
  }
});

const dialogVisible = ref(false);
const dialogTitle = ref("新增友链");
const formRef = ref();
const form = ref({
  id: 0,
  name: "",
  url: "",
  avatar: "",
  description: "",
  sort: 0,
  is_approved: true
});

const rules = {
  name: [{ required: true, message: "请输入友链名称", trigger: "blur" }],
  url: [{ required: true, message: "请输入链接地址", trigger: "blur" }]
};

function openDialog(title: string, row?: FriendLinkItem) {
  dialogTitle.value = title;
  if (row) {
    form.value = {
      id: row.id,
      name: row.name,
      url: row.url,
      avatar: row.avatar || "",
      description: row.description || "",
      sort: row.sort ?? 0,
      is_approved: row.is_approved
    };
  } else {
    form.value = {
      id: 0,
      name: "",
      url: "",
      avatar: "",
      description: "",
      sort: 0,
      is_approved: true
    };
  }
  dialogVisible.value = true;
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  try {
    const payload = {
      name: form.value.name,
      url: form.value.url,
      avatar: form.value.avatar,
      description: form.value.description,
      sort: form.value.sort,
      is_approved: form.value.is_approved
    };
    if (form.value.id) {
      await updateFriendLink(form.value.id, payload);
      message("友链更新成功", { type: "success" });
      selectedId.value = form.value.id;
    } else {
      const created = await createFriendLink(payload);
      message("友链创建成功", { type: "success" });
      if (created?.id) selectedId.value = created.id;
    }
    dialogVisible.value = false;
    onSearch();
  } catch (e: any) {
    message(e?.message ?? "操作失败", { type: "error" });
  }
}

async function handleDelete(row: FriendLinkItem) {
  try {
    await deleteFriendLink(row.id);
    message("删除成功", { type: "success" });
    if (selectedId.value === row.id) selectedId.value = null;
    onSearch();
  } catch (e: any) {
    message(e?.message ?? "删除失败", { type: "error" });
  }
}

async function handleToggleApproved(row: FriendLinkItem) {
  try {
    await updateFriendLink(row.id, { is_approved: !row.is_approved });
    message(row.is_approved ? "已取消审核" : "已通过审核", { type: "success" });
    selectedId.value = row.id;
    onSearch();
  } catch (e: any) {
    message(e?.message ?? "操作失败", { type: "error" });
  }
}

const uploading = ref(false);

function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const MAX = 800;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          const ratio = Math.min(MAX / width, MAX / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(file);
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          blob => {
            if (!blob) return resolve(file);
            resolve(new File([blob], file.name, { type: "image/jpeg" }));
          },
          "image/jpeg",
          0.8
        );
      };
      img.onerror = () => resolve(file);
      img.src = reader.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

async function handleAvatarUpload(uploadFile: any) {
  const file = uploadFile.raw || uploadFile.file || uploadFile;
  if (!file) return;
  uploading.value = true;
  try {
    const compressed = await compressImage(file);
    const res = await uploadImage(compressed);
    form.value.avatar = res.url;
    message("头像上传成功", { type: "success" });
  } catch (e: any) {
    message(e?.message ?? "上传失败", { type: "error" });
  } finally {
    uploading.value = false;
  }
}

function openFrontFriends() {
  window.open(FRONT_FRIENDS_URL, "_blank", "noopener,noreferrer");
}

onMounted(() => onSearch());
</script>

<template>
  <div class="friend-link-page">
    <el-card shadow="never" class="friend-link-card" :body-style="{ padding: '0', flex: '1', minHeight: '0', minWidth: '0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }">
      <template #header>
        <div class="friend-link-toolbar">
          <div class="friend-link-toolbar__left">
            <span class="friend-link-title">友链管理</span>
            <el-radio-group v-model="statusFilter" size="small" class="friend-link-filter">
              <el-radio-button label="all">全部</el-radio-button>
              <el-radio-button label="pending">
                待审核<span v-if="pendingCount > 0" class="friend-link-count">({{ pendingCount }})</span>
              </el-radio-button>
              <el-radio-button label="approved">已通过</el-radio-button>
            </el-radio-group>
          </div>
          <div class="friend-link-toolbar__right">
            <el-button @click="openFrontFriends">
              打开前台
            </el-button>
            <el-button
              type="primary"
              :icon="useRenderIcon('ri:add-circle-line')"
              @click="openDialog('新增友链')"
            >
              新增友链
            </el-button>
          </div>
        </div>
      </template>

      <div class="friend-link-main">
        <div class="friend-link-pane friend-link-pane--left">
          <div class="friend-link-table-wrap">
            <pure-table
              :data="filteredList"
              :columns="columns"
              :loading="loading"
              align-whole="center"
              row-key="id"
              table-layout="fixed"
              :row-class-name="
                ({ row }) => {
                  const classes: string[] = [];
                  if (!row.is_approved) classes.push('friend-link-pending-row');
                  if (row.id === selectedId) classes.push('friend-link-selected-row');
                  return classes.join(' ');
                }
              "
              @row-click="onRowClick"
            >
              <template #avatar="{ row }">
                <el-image
                  v-if="row.avatar"
                  :src="row.avatar"
                  fit="cover"
                  preview-teleported
                  class="friend-link-avatar"
                  @click.stop
                />
                <span v-else class="friend-link-avatar friend-link-avatar--ph">
                  {{ (row.name || "?").slice(0, 1) }}
                </span>
              </template>

              <template #name="{ row }">
                <div class="friend-link-name-cell">
                  <div class="friend-link-name-cell__title">{{ row.name }}</div>
                  <div class="friend-link-name-cell__desc">
                    {{ row.description || "—" }}
                  </div>
                </div>
              </template>

              <template #url="{ row }">
                <el-link
                  v-if="row.url"
                  :href="row.url"
                  target="_blank"
                  type="primary"
                  :underline="false"
                  class="friend-link-url"
                  :title="row.url"
                  @click.stop
                >
                  {{ row.url }}
                </el-link>
                <span v-else class="text-gray-400">-</span>
              </template>

              <template #status="{ row }">
                <el-tag
                  :type="row.is_approved ? 'success' : 'warning'"
                  size="small"
                  class="cursor-pointer"
                  @click.stop="handleToggleApproved(row)"
                >
                  {{ row.is_approved ? "已审核" : "待审核" }}
                </el-tag>
              </template>

              <template #operation="{ row }">
                <el-button
                  link
                  type="primary"
                  :icon="useRenderIcon('ri:edit-line')"
                  @click.stop="openDialog('修改友链', row)"
                >
                  修改
                </el-button>
                <el-popconfirm
                  :title="`确认删除友链「${row.name}」？`"
                  @confirm="handleDelete(row)"
                >
                  <template #reference>
                    <el-button
                      link
                      type="danger"
                      :icon="useRenderIcon('ri:delete-bin-line')"
                      @click.stop
                    >
                      删除
                    </el-button>
                  </template>
                </el-popconfirm>
              </template>
            </pure-table>
          </div>
        </div>

        <div class="friend-link-pane friend-link-pane--right">
          <div v-if="selectedRow" class="friend-link-preview-card">
            <span
              class="friend-link-preview-badge"
              :class="selectedRow.is_approved ? 'is-ok' : 'is-warn'"
            >
              {{ selectedRow.is_approved ? "已审" : "待审" }}
            </span>
            <div class="friend-link-preview-ring">
              <img
                v-if="selectedRow.avatar"
                :src="selectedRow.avatar"
                :alt="selectedRow.name"
              />
              <div v-else class="friend-link-preview-ph">
                {{ (selectedRow.name || "?").slice(0, 1) }}
              </div>
            </div>
            <h2 class="friend-link-preview-name">{{ selectedRow.name }}</h2>
            <p class="friend-link-preview-desc">
              {{
                selectedRow.description ||
                "这个朋友很懒，没有留下描述~"
              }}
            </p>
            <a
              class="friend-link-preview-cta"
              :href="selectedRow.url"
              target="_blank"
              rel="noopener noreferrer"
            >
              访问主页
            </a>
          </div>
          <div v-else class="friend-link-preview-empty">
            单击左侧一行，在此预览友链卡片
          </div>

          <div class="friend-link-sea">
            <h3>前台可见 · {{ approvedList.length }}</h3>
            <div v-if="approvedList.length" class="friend-link-sea-row">
              <button
                v-for="item in approvedList"
                :key="item.id"
                type="button"
                class="friend-link-chip"
                :class="{ 'is-active': item.id === selectedId }"
                @click="selectApproved(item.id)"
              >
                <img
                  v-if="item.avatar"
                  :src="item.avatar"
                  :alt="item.name"
                />
                <span v-else class="friend-link-chip-ph">
                  {{ (item.name || "?").slice(0, 1) }}
                </span>
                <span class="friend-link-chip-name">{{ item.name }}</span>
              </button>
            </div>
            <p v-else class="friend-link-sea-empty">暂无已通过友链</p>
          </div>
        </div>
      </div>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="600px"
      destroy-on-close
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="80px"
      >
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="友链名称" />
        </el-form-item>
        <el-form-item label="链接" prop="url">
          <el-input v-model="form.url" placeholder="https://example.com" />
        </el-form-item>
        <el-form-item label="头像">
          <div class="flex items-center gap-4">
            <div
              v-if="form.avatar"
              class="relative w-16 h-16 rounded-full overflow-hidden border border-gray-200 dark:border-gray-700 shrink-0"
            >
              <el-image :src="form.avatar" fit="cover" class="w-full h-full" />
              <el-icon
                class="absolute top-0 right-0 bg-black/60 text-white rounded-full cursor-pointer text-xs p-0.5"
                @click="form.avatar = ''"
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path
                    d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                  />
                </svg>
              </el-icon>
            </div>
            <el-upload
              :show-file-list="false"
              :http-request="() => {}"
              :before-upload="() => false"
              :on-change="handleAvatarUpload"
              accept="image/*"
            >
              <el-button :loading="uploading" type="primary" plain>
                {{ form.avatar ? "更换" : "上传头像" }}
              </el-button>
            </el-upload>
          </div>
          <el-input
            v-model="form.avatar"
            placeholder="或直接输入头像链接 https://..."
            class="mt-2"
            clearable
          />
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="3"
            placeholder="简短描述..."
          />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sort" :min="0" :max="9999" />
        </el-form-item>
        <el-form-item label="审核">
          <el-switch
            v-model="form.is_approved"
            active-text="通过"
            inactive-text="待审核"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.friend-link-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  min-width: 0;
  padding: 16px;
  box-sizing: border-box;
  overflow: hidden;
}

.friend-link-card {
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.friend-link-card :deep(.el-card__header) {
  flex: 0 0 auto;
  padding: 12px 16px;
}

.friend-link-card :deep(.el-card__body) {
  flex: 1;
  min-height: 0;
  min-width: 0;
}

.friend-link-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.friend-link-toolbar__left,
.friend-link-toolbar__right {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.friend-link-title {
  font-weight: 600;
  font-size: 15px;
}

.friend-link-count {
  margin-left: 2px;
  font-variant-numeric: tabular-nums;
  color: var(--el-color-warning);
}

.friend-link-main {
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: grid;
  grid-template-columns: 15fr 9fr;
  overflow: hidden;
}

.friend-link-pane {
  min-width: 0;
  min-height: 0;
  overflow: auto;
}

.friend-link-pane--left {
  border-right: 1px solid var(--el-border-color-lighter);
}

.friend-link-pane--right {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  background: linear-gradient(
    180deg,
    rgba(14, 165, 233, 0.04),
    transparent 40%
  );
}

.friend-link-table-wrap {
  min-width: 0;
  overflow-x: auto;
  padding: 8px 12px 12px;
}

.friend-link-avatar {
  width: 40px;
  height: 40px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  object-fit: cover;
}

.friend-link-avatar--ph {
  background: linear-gradient(135deg, #38bdf8, #6366f1);
  color: #fff;
  font-weight: 700;
  font-size: 14px;
}

.friend-link-name-cell {
  text-align: left;
  min-width: 0;
}

.friend-link-name-cell__title {
  font-weight: 600;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.friend-link-name-cell__desc {
  margin-top: 2px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.friend-link-url {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
}

.friend-link-preview-card {
  position: relative;
  width: 100%;
  max-width: 20rem;
  margin: 8px auto 0;
  border-radius: 1.25rem;
  padding: 1.4rem 1.1rem 1.25rem;
  text-align: center;
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.45);
  backdrop-filter: blur(18px);
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.08);
}

html.dark .friend-link-preview-card,
.dark .friend-link-preview-card {
  background: rgba(30, 41, 59, 0.72);
  border-color: rgba(255, 255, 255, 0.1);
}

.friend-link-preview-badge {
  position: absolute;
  top: 12px;
  left: 12px;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
}

.friend-link-preview-badge.is-ok {
  background: rgba(34, 197, 94, 0.15);
  color: #16a34a;
}

.friend-link-preview-badge.is-warn {
  background: rgba(245, 158, 11, 0.18);
  color: #d97706;
}

.friend-link-preview-ring {
  width: 72px;
  height: 72px;
  margin: 8px auto 12px;
  border-radius: 999px;
  padding: 3px;
  background: linear-gradient(135deg, #38bdf8, #818cf8, #c084fc);
}

.friend-link-preview-ring img,
.friend-link-preview-ph {
  width: 100%;
  height: 100%;
  border-radius: 999px;
  object-fit: cover;
  display: block;
  background: #0f172a;
}

.friend-link-preview-ph {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 24px;
  font-weight: 700;
  background: linear-gradient(135deg, #38bdf8, #6366f1);
}

.friend-link-preview-name {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 700;
}

.friend-link-preview-desc {
  margin: 0 0 16px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}

.friend-link-preview-cta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 999px;
  background: #0ea5e9;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
  box-shadow: 0 8px 20px rgba(14, 165, 233, 0.25);
}

.friend-link-preview-cta:hover {
  background: #0284c7;
  color: #fff;
}

.friend-link-preview-empty {
  flex: 0 0 auto;
  text-align: center;
  color: var(--el-text-color-secondary);
  padding: 48px 12px 24px;
  font-size: 13px;
}

.friend-link-sea h3 {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
}

.friend-link-sea-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.friend-link-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px 4px 4px;
  border-radius: 999px;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color);
  cursor: pointer;
  font-size: 11px;
  color: var(--el-text-color-primary);
}

.friend-link-chip.is-active {
  border-color: #0ea5e9;
  box-shadow: 0 0 0 1px rgba(14, 165, 233, 0.35);
}

.friend-link-chip img,
.friend-link-chip-ph {
  width: 22px;
  height: 22px;
  border-radius: 999px;
  object-fit: cover;
}

.friend-link-chip-ph {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #38bdf8, #6366f1);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
}

.friend-link-chip-name {
  max-width: 7rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.friend-link-sea-empty {
  margin: 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

:deep(.friend-link-pending-row) {
  --el-table-tr-bg-color: rgba(14, 165, 233, 0.06);
}

:deep(.friend-link-pending-row td:first-child) {
  box-shadow: inset 3px 0 0 #0ea5e9;
}

:deep(.friend-link-selected-row) {
  --el-table-tr-bg-color: rgba(14, 165, 233, 0.12);
}

@media (max-width: 1099px) {
  .friend-link-main {
    grid-template-columns: 1fr;
    overflow: auto;
  }

  .friend-link-pane--left {
    border-right: 0;
    border-bottom: 1px solid var(--el-border-color-lighter);
    max-height: 55vh;
  }
}
</style>
