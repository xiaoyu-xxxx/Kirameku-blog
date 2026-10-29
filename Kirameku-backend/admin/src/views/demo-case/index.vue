<script setup lang="ts">
import { ref, onMounted } from "vue";
import { message } from "@/utils/message";
import {
  getDemoCases,
  createDemoCase,
  updateDemoCase,
  deleteDemoCase,
  uploadDemoPackage,
  type DemoCaseItem
} from "@/api/demo-case";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";

defineOptions({ name: "DemoCaseIndex" });

const loading = ref(false);
const dataList = ref<DemoCaseItem[]>([]);
const dialogVisible = ref(false);
const dialogTitle = ref("新增案例");
const formRef = ref();
const form = ref({
  id: 0,
  name: "",
  slug: "",
  entry_path: "index.html",
  entry_query: "embed=1",
  base_url: "",
  status: 1,
  remark: "",
  file_count: 0
});

const uploadInputRef = ref<HTMLInputElement>();
const uploadTargetId = ref(0);
const uploading = ref(false);
const snippetDialog = ref(false);
const snippetText = ref("");
const previewUrl = ref("");

const rules = {
  name: [{ required: true, message: "请输入案例名称", trigger: "blur" }],
  slug: [
    { required: true, message: "请输入 slug", trigger: "blur" },
    {
      pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      message: "仅小写字母、数字与连字符",
      trigger: "blur"
    }
  ]
};

const columns: TableColumnList = [
  { label: "ID", prop: "id", width: 70 },
  { label: "名称", prop: "name", minWidth: 120 },
  { label: "Slug", prop: "slug", minWidth: 140 },
  {
    label: "状态",
    prop: "status",
    width: 90,
    slot: "status"
  },
  {
    label: "文件",
    prop: "file_count",
    width: 90,
    formatter: ({ file_count, package_size }) =>
      file_count ? `${file_count} 个 / ${(package_size / 1024).toFixed(1)} KB` : "未上传"
  },
  {
    label: "公开地址",
    prop: "public_url",
    minWidth: 220,
    slot: "publicUrl"
  },
  {
    label: "更新时间",
    prop: "updated_at",
    minWidth: 170,
    formatter: ({ updated_at }) =>
      updated_at?.replace("T", " ").slice(0, 19) ?? ""
  },
  { label: "操作", fixed: "right", width: 320, slot: "operation" }
];

function formatSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

async function onSearch() {
  loading.value = true;
  try {
    dataList.value = await getDemoCases();
  } finally {
    loading.value = false;
  }
}

function openDialog(title: string, row?: DemoCaseItem) {
  dialogTitle.value = title;
  if (row) {
    form.value = {
      id: row.id,
      name: row.name,
      slug: row.slug,
      entry_path: row.entry_path || "index.html",
      entry_query: row.entry_query || "",
      base_url: row.base_url || "",
      status: row.status,
      remark: row.remark || "",
      file_count: row.file_count
    };
  } else {
    form.value = {
      id: 0,
      name: "",
      slug: "",
      entry_path: "index.html",
      entry_query: "embed=1",
      base_url: "",
      status: 1,
      remark: "",
      file_count: 0
    };
  }
  dialogVisible.value = true;
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  const payload = {
    name: form.value.name,
    slug: form.value.slug,
    entry_path: form.value.entry_path,
    entry_query: form.value.entry_query,
    base_url: form.value.base_url,
    status: form.value.status,
    remark: form.value.remark
  };
  try {
    if (form.value.id) {
      await updateDemoCase(form.value.id, payload);
      message("更新成功", { type: "success" });
    } else {
      await createDemoCase(payload);
      message("创建成功", { type: "success" });
    }
    dialogVisible.value = false;
    onSearch();
  } catch (e: any) {
    message(e?.message ?? "操作失败", { type: "error" });
  }
}

async function handleDelete(row: DemoCaseItem) {
  try {
    await deleteDemoCase(row.id);
    message("已删除", { type: "success" });
    onSearch();
  } catch (e: any) {
    message(e?.message ?? "删除失败", { type: "error" });
  }
}

function triggerUpload(row: DemoCaseItem) {
  uploadTargetId.value = row.id;
  uploadInputRef.value?.click();
}

async function onZipSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file || !uploadTargetId.value) return;
  if (!file.name.toLowerCase().endsWith(".zip")) {
    message("请选择 zip 文件", { type: "warning" });
    return;
  }
  uploading.value = true;
  try {
    await uploadDemoPackage(uploadTargetId.value, file);
    message("上传并解压成功", { type: "success" });
    onSearch();
  } catch (e: any) {
    message(e?.message ?? "上传失败", { type: "error" });
  } finally {
    uploading.value = false;
  }
}

function showSnippet(row: DemoCaseItem) {
  snippetText.value = row.iframe_snippet;
  previewUrl.value = row.public_url;
  snippetDialog.value = true;
}

async function copySnippet() {
  try {
    await navigator.clipboard.writeText(snippetText.value);
    message("已复制 iframe 片段", { type: "success" });
  } catch {
    message("复制失败，请手动选择文本", { type: "warning" });
  }
}

onMounted(onSearch);
</script>

<template>
  <div class="p-4">
    <input
      ref="uploadInputRef"
      type="file"
      accept=".zip,application/zip"
      class="hidden"
      @change="onZipSelected"
    />

    <el-card shadow="never">
      <template #header>
        <div class="flex justify-between items-center flex-wrap gap-2">
          <div>
            <span class="font-medium">案例 Demo 管理</span>
            <p class="text-xs text-gray-500 mt-1 font-normal">
              zip 解压到服务器本地目录（DEMO_LOCAL_ROOT），经 demos 子域对外；请勿使用 R2 存放 demo 包。
            </p>
          </div>
          <el-button
            type="primary"
            :icon="useRenderIcon('ri:add-line')"
            @click="openDialog('新增案例')"
          >
            新增案例
          </el-button>
        </div>
      </template>

      <pure-table
        :loading="loading"
        :data="dataList"
        :columns="columns"
        row-key="id"
        align-whole="center"
        header-row-class-name="table-header-gray"
      >
        <template #status="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'info'">
            {{ row.status === 1 ? "启用" : "禁用" }}
          </el-tag>
        </template>
        <template #publicUrl="{ row }">
          <a
            v-if="row.public_url"
            :href="row.public_url"
            target="_blank"
            rel="noopener"
            class="text-primary truncate block max-w-xs"
          >
            {{ row.public_url }}
          </a>
          <span v-else class="text-gray-400">—</span>
        </template>
        <template #operation="{ row }">
          <el-button link type="primary" @click="openDialog('编辑案例', row)">
            编辑
          </el-button>
          <el-button
            link
            type="primary"
            :loading="uploading && uploadTargetId === row.id"
            @click="triggerUpload(row)"
          >
            上传 zip
          </el-button>
          <el-button
            link
            type="primary"
            :disabled="!row.file_count"
            @click="showSnippet(row)"
          >
            复制 iframe
          </el-button>
          <el-popconfirm title="确定删除该案例及文件？" @confirm="handleDelete(row)">
            <template #reference>
              <el-button link type="danger">删除</el-button>
            </template>
          </el-popconfirm>
        </template>
      </pure-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="560px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="交互演示名称" />
        </el-form-item>
        <el-form-item label="Slug" prop="slug">
          <el-input
            v-model="form.slug"
            placeholder="css-has-form"
            :disabled="!!form.id && form.file_count > 0"
          />
          <p v-if="form.id" class="text-xs text-gray-400 mt-1">
            已上传包后不可改 slug；文件在服务器 DEMO_LOCAL_ROOT/&lt;slug&gt;/，公开路径为
            demos.xiaoyu-hh.cn/&lt;slug&gt;/…
          </p>
        </el-form-item>
        <el-form-item label="入口文件">
          <el-input v-model="form.entry_path" placeholder="index.html" />
        </el-form-item>
        <el-form-item label="入口 Query">
          <el-input v-model="form.entry_query" placeholder="embed=1" />
        </el-form-item>
        <el-form-item label="自定义 Base URL">
          <el-input
            v-model="form.base_url"
            placeholder="留空则使用 DEMO_PUBLIC_BASE"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch
            v-model="form.status"
            :active-value="1"
            :inactive-value="0"
            active-text="启用"
            inactive-text="禁用"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="snippetDialog" title="Iframe 嵌入片段" width="720px">
      <p class="text-sm text-gray-500 mb-2">
        将下方 HTML 粘贴到文章 Markdown（Vditor）中。默认 sandbox：
        <code>allow-scripts allow-forms</code>（不含 allow-same-origin）。
      </p>
      <el-input v-model="snippetText" type="textarea" :rows="6" readonly />
      <div v-if="previewUrl" class="mt-4">
        <p class="text-sm mb-2">预览（需 demos 域名可访问）：</p>
        <iframe
          :src="previewUrl"
          class="w-full rounded-xl border border-gray-200"
          style="min-height: 360px"
          sandbox="allow-scripts allow-forms"
          loading="lazy"
        />
      </div>
      <template #footer>
        <el-button @click="snippetDialog = false">关闭</el-button>
        <el-button type="primary" @click="copySnippet">复制片段</el-button>
      </template>
    </el-dialog>
  </div>
</template>
