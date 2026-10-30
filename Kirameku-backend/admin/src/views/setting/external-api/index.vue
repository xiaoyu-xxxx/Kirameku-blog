<script setup lang="ts">
import { ref, onMounted } from "vue";
import { message as msg } from "@/utils/message";
import {
  listExternalApis,
  createExternalApi,
  updateExternalApi,
  deleteExternalApi
} from "@/api/externalApi";
import type { ExternalApiItem } from "@/api/externalApi";

defineOptions({ name: "ExternalApiIndex" });

const loading = ref(false);
const dataList = ref<ExternalApiItem[]>([]);

const dialogVisible = ref(false);
const dialogTitle = ref("编辑外部 API");
const formRef = ref();
const isEdit = ref(false);
const editingId = ref<number | null>(null);
const form = ref({
  key: "",
  name: "",
  base_url: "",
  path: "",
  method: "GET",
  enabled: true,
  params: "{}",
  description: "",
  sort: 0
});

const rules = {
  key: [{ required: true, message: "请输入唯一标识 key", trigger: "blur" }],
  name: [{ required: true, message: "请输入名称", trigger: "blur" }],
  base_url: [{ required: true, message: "请输入接口地址", trigger: "blur" }]
};

const columns: TableColumnList = [
  { label: "ID", prop: "id", width: 60 },
  { label: "标识 key", prop: "key", width: 180 },
  { label: "名称", prop: "name", width: 120 },
  { label: "地址", prop: "base_url", minWidth: 200, slot: "base_url" },
  { label: "路径", prop: "path", width: 140, slot: "path" },
  { label: "方法", prop: "method", width: 80 },
  { label: "启用", prop: "enabled", width: 80, slot: "enabled" },
  { label: "排序", prop: "sort", width: 70 },
  {
    label: "更新时间",
    prop: "updated_at",
    width: 170,
    formatter: ({ updated_at }: ExternalApiItem) =>
      updated_at ? updated_at.replace("T", " ").slice(0, 19) : ""
  },
  { label: "操作", fixed: "right", width: 150, slot: "operation" }
];

async function onSearch() {
  loading.value = true;
  try {
    dataList.value = await listExternalApis();
  } finally {
    loading.value = false;
  }
}

function openAdd() {
  isEdit.value = false;
  editingId.value = null;
  dialogTitle.value = "新增外部 API";
  form.value = {
    key: "",
    name: "",
    base_url: "",
    path: "",
    method: "GET",
    enabled: true,
    params: "{}",
    description: "",
    sort: 0
  };
  dialogVisible.value = true;
}

function openEdit(row: ExternalApiItem) {
  isEdit.value = true;
  editingId.value = row.id;
  dialogTitle.value = "编辑外部 API";
  form.value = {
    key: row.key,
    name: row.name,
    base_url: row.base_url,
    path: row.path,
    method: row.method,
    enabled: row.enabled,
    params:
      typeof row.params === "string" ? row.params : JSON.stringify(row.params),
    description: row.description,
    sort: row.sort
  };
  dialogVisible.value = true;
}

async function handleSubmit() {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }

  try {
    if (isEdit.value && editingId.value !== null) {
      await updateExternalApi(editingId.value, { ...form.value });
      msg("更新成功", { type: "success" });
    } else {
      await createExternalApi({ ...form.value });
      msg("新增成功", { type: "success" });
    }
    dialogVisible.value = false;
    onSearch();
  } catch (e: any) {
    msg(e?.message ?? "操作失败", { type: "error" });
  }
}

async function handleDelete(row: ExternalApiItem) {
  try {
    await deleteExternalApi(row.id);
    msg("删除成功", { type: "success" });
    onSearch();
  } catch (e: any) {
    msg(e?.message ?? "删除失败", { type: "error" });
  }
}

async function toggleEnabled(row: ExternalApiItem) {
  try {
    await updateExternalApi(row.id, { enabled: row.enabled });
    msg("已更新", { type: "success" });
  } catch (e: any) {
    row.enabled = !row.enabled;
    msg(e?.message ?? "更新失败", { type: "error" });
  }
}

onMounted(() => onSearch());
</script>

<template>
  <div class="p-4">
    <el-card shadow="never">
      <template #header>
        <div class="flex justify-between items-center">
          <span class="font-medium">外部 API 配置</span>
          <el-button type="primary" @click="openAdd">新增 API</el-button>
        </div>
      </template>

      <pure-table
        :data="dataList"
        :columns="columns"
        :loading="loading"
        align-whole="center"
        row-key="id"
        table-layout="auto"
      >
        <template #base_url="{ row }">
          <div class="text-left max-w-xs truncate" :title="row.base_url">
            {{ row.base_url }}
          </div>
        </template>

        <template #path="{ row }">
          <div class="text-left max-w-xs truncate" :title="row.path">
            {{ row.path || "-" }}
          </div>
        </template>

        <template #enabled="{ row }">
          <el-switch v-model="row.enabled" @change="toggleEnabled(row)" />
        </template>

        <template #operation="{ row }">
          <el-button link type="primary" size="small" @click="openEdit(row)">
            编辑
          </el-button>
          <el-popconfirm
            :title="`确认删除 ${row.key}？`"
            @confirm="handleDelete(row)"
          >
            <template #reference>
              <el-button link type="danger" size="small">删除</el-button>
            </template>
          </el-popconfirm>
        </template>
      </pure-table>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="560px"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="标识 key" prop="key">
          <el-input v-model="form.key" :disabled="isEdit" placeholder="如 hitokoto" />
        </el-form-item>
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="如 一言" />
        </el-form-item>
        <el-form-item label="地址" prop="base_url">
          <el-input v-model="form.base_url" placeholder="如 https://v1.hitokoto.cn" />
        </el-form-item>
        <el-form-item label="路径" prop="path">
          <el-input v-model="form.path" placeholder="附加路径，可空" />
        </el-form-item>
        <el-form-item label="方法" prop="method">
          <el-select v-model="form.method" style="width: 100%">
            <el-option label="GET" value="GET" />
            <el-option label="POST" value="POST" />
          </el-select>
        </el-form-item>
        <el-form-item label="参数" prop="params">
          <el-input
            v-model="form.params"
            type="textarea"
            :rows="2"
            placeholder='JSON 参数，如 {"return":"json"}'
          />
        </el-form-item>
        <el-form-item label="排序" prop="sort">
          <el-input-number v-model="form.sort" :min="0" />
        </el-form-item>
        <el-form-item label="启用" prop="enabled">
          <el-switch v-model="form.enabled" />
        </el-form-item>
        <el-form-item label="说明" prop="description">
          <el-input v-model="form.description" placeholder="可选说明" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>
