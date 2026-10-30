<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { message as msg } from "@/utils/message";
import {
  listSiteSettings,
  createSiteSetting,
  updateSiteSetting,
  deleteSiteSetting
} from "@/api/siteSetting";
import type { SiteSettingItem } from "@/api/siteSetting";

defineOptions({ name: "SiteSettingIndex" });

const loading = ref(false);
const saving = ref(false);
const dataList = ref<SiteSettingItem[]>([]);

// 编辑中的值，按 input_type 保留对应 JS 类型
const editValue = ref<Record<string, any>>({});

const groups = computed(() => {
  const map = new Map<string, SiteSettingItem[]>();
  for (const item of dataList.value) {
    const g = item.group || "basic";
    if (!map.has(g)) map.set(g, []);
    map.get(g)!.push(item);
  }
  return Array.from(map.entries());
});

const groupLabels: Record<string, string> = {
  basic: "基本信息",
  social: "社交链接",
  music: "音乐",
  content: "内容文案"
};

function initEditValues() {
  const map: Record<string, any> = {};
  for (const item of dataList.value) {
    map[item.key] = parseStored(item.value, item.input_type);
  }
  editValue.value = map;
}

function parseStored(raw: any, type: string): any {
  if (type === "boolean") return raw === true || raw === "true";
  if (type === "number") return Number(raw ?? 0);
  return typeof raw === "string" ? raw : raw ?? "";
}

function serialize(item: SiteSettingItem): string {
  const v = editValue.value[item.key];
  if (item.input_type === "boolean") return JSON.stringify(!!v);
  if (item.input_type === "number") return String(Number(v ?? 0));
  if (item.input_type === "json") return typeof v === "string" ? v : JSON.stringify(v);
  return JSON.stringify(String(v ?? ""));
}

async function onSearch() {
  loading.value = true;
  try {
    dataList.value = await listSiteSettings();
    initEditValues();
  } finally {
    loading.value = false;
  }
}

async function handleSave() {
  saving.value = true;
  try {
    for (const item of dataList.value) {
      await updateSiteSetting(item.id, { value: serialize(item) });
    }
    msg("保存成功", { type: "success" });
    onSearch();
  } catch (e: any) {
    msg(e?.message ?? "保存失败", { type: "error" });
  } finally {
    saving.value = false;
  }
}

// 新增设置
const dialogVisible = ref(false);
const formRef = ref();
const form = ref({
  key: "",
  value: "",
  label: "",
  group: "basic",
  input_type: "text",
  description: "",
  sort: 0
});

function openAdd() {
  form.value = {
    key: "",
    value: "",
    label: "",
    group: "basic",
    input_type: "text",
    description: "",
    sort: 0
  };
  dialogVisible.value = true;
}

async function handleAdd() {
  try {
    const stored =
      form.value.input_type === "json"
        ? form.value.value
        : JSON.stringify(form.value.value);
    await createSiteSetting({
      key: form.value.key,
      value: stored,
      label: form.value.label,
      group: form.value.group,
      input_type: form.value.input_type,
      description: form.value.description,
      sort: form.value.sort
    });
    msg("新增成功", { type: "success" });
    dialogVisible.value = false;
    onSearch();
  } catch (e: any) {
    msg(e?.message ?? "新增失败", { type: "error" });
  }
}

async function handleDelete(row: SiteSettingItem) {
  try {
    await deleteSiteSetting(row.id);
    msg("删除成功", { type: "success" });
    onSearch();
  } catch (e: any) {
    msg(e?.message ?? "删除失败", { type: "error" });
  }
}

onMounted(() => onSearch());
</script>

<template>
  <div class="p-4">
    <el-card shadow="never">
      <template #header>
        <div class="flex justify-between items-center">
          <span class="font-medium">站点设置</span>
          <div class="flex gap-2">
            <el-button @click="openAdd">新增设置</el-button>
            <el-button type="primary" :loading="saving" @click="handleSave">
              保存全部
            </el-button>
          </div>
        </div>
      </template>

      <el-tabs v-loading="loading">
        <el-tab-pane
          v-for="[group, items] in groups"
          :key="group"
          :label="groupLabels[group] ?? group"
        >
          <el-form label-width="180px" class="max-w-3xl">
            <el-form-item
              v-for="item in items"
              :key="item.id"
              :label="item.label || item.key"
            >
              <div class="w-full flex items-center gap-3">
                <el-switch
                  v-if="item.input_type === 'boolean'"
                  v-model="editValue[item.key]"
                />
                <el-input-number
                  v-else-if="item.input_type === 'number'"
                  v-model="editValue[item.key]"
                  class="w-full"
                />
                <el-input
                  v-else
                  v-model="editValue[item.key]"
                  :type="item.input_type === 'json' ? 'textarea' : 'text'"
                  :rows="item.input_type === 'json' ? 4 : 1"
                />
                <el-button
                  link
                  type="danger"
                  size="small"
                  @click="handleDelete(item)"
                >
                  删除
                </el-button>
              </div>
              <div
                v-if="item.description"
                class="text-xs text-slate-400 mt-1"
              >
                {{ item.description }}
              </div>
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <el-dialog v-model="dialogVisible" title="新增设置" width="520px" destroy-on-close>
      <el-form ref="formRef" :model="form" label-width="90px">
        <el-form-item label="键名 key">
          <el-input v-model="form.key" placeholder="如 site_title" />
        </el-form-item>
        <el-form-item label="值 value">
          <el-input v-model="form.value" placeholder="值" />
        </el-form-item>
        <el-form-item label="显示名">
          <el-input v-model="form.label" placeholder="如 站点标题" />
        </el-form-item>
        <el-form-item label="分组">
          <el-select v-model="form.group" style="width: 100%">
            <el-option label="基本信息" value="basic" />
            <el-option label="社交链接" value="social" />
            <el-option label="音乐" value="music" />
            <el-option label="内容文案" value="content" />
          </el-select>
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="form.input_type" style="width: 100%">
            <el-option label="文本" value="text" />
            <el-option label="数字" value="number" />
            <el-option label="布尔" value="boolean" />
            <el-option label="JSON" value="json" />
          </el-select>
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="form.description" placeholder="可选" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleAdd">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>
