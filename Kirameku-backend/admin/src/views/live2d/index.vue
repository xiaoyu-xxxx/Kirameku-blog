<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { message } from "@/utils/message";
import {
  getLive2DModels,
  getLive2DModel,
  updateLive2DModel,
  updateLive2DSkin,
  deleteLive2DModel,
  getLive2DDefaults,
  setLive2DDefaults,
  importLive2DModels,
  uploadLive2DZip,
  type Live2DModelItem,
  type Live2DModelDetail,
  type Live2DDefaults,
  type Live2DSkinItem
} from "@/api/live2d";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";

defineOptions({ name: "Live2DAdminIndex" });

const loading = ref(false);
const dataList = ref<Live2DModelItem[]>([]);
const defaults = ref<Live2DDefaults | null>(null);
const expandLoading = ref<Record<number, boolean>>({});
const detailMap = ref<Record<number, Live2DModelDetail>>({});

const uploadVisible = ref(false);
const uploading = ref(false);
const uploadForm = ref({
  name: "",
  slug: "",
  enabled: true,
  file: null as File | null
});

const defaultDialog = ref(false);
const defaultForm = ref({
  default_model_id: 0,
  default_skin_id: null as number | null
});
const defaultSkins = ref<Live2DSkinItem[]>([]);

const columns: TableColumnList = [
  { type: "expand", slot: "expand", width: 50 },
  { label: "ID", prop: "id", width: 70 },
  { label: "名称", prop: "name", minWidth: 160 },
  { label: "Slug", prop: "slug", minWidth: 140 },
  {
    label: "来源",
    prop: "source",
    width: 90,
    formatter: ({ source }) => (source === "upload" ? "上传" : "内置")
  },
  {
    label: "启用",
    prop: "enabled",
    width: 90,
    slot: "enabled"
  },
  { label: "排序", prop: "sort", width: 80 },
  {
    label: "皮肤",
    prop: "skin_count",
    width: 80
  },
  {
    label: "体积",
    prop: "package_size",
    width: 110,
    formatter: ({ package_size, source }) =>
      source === "upload" && package_size
        ? formatSize(package_size)
        : source === "builtin"
          ? "—"
          : "0"
  },
  { label: "操作", fixed: "right", width: 280, slot: "operation" }
];

function formatSize(n: number) {
  if (!n) return "0";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

async function onSearch() {
  loading.value = true;
  try {
    const [models, defs] = await Promise.all([
      getLive2DModels(),
      getLive2DDefaults()
    ]);
    dataList.value = models;
    defaults.value = defs;
  } finally {
    loading.value = false;
  }
}

async function ensureDetail(row: Live2DModelItem) {
  if (detailMap.value[row.id]) return;
  expandLoading.value[row.id] = true;
  try {
    detailMap.value[row.id] = await getLive2DModel(row.id);
  } finally {
    expandLoading.value[row.id] = false;
  }
}

async function onExpandChange(row: Live2DModelItem, expanded: boolean) {
  if (expanded) await ensureDetail(row);
}

async function toggleEnabled(row: Live2DModelItem, val: boolean) {
  try {
    await updateLive2DModel(row.id, { enabled: val });
    message(val ? "已启用" : "已禁用", { type: "success" });
    onSearch();
  } catch (e: any) {
    message(e?.message ?? "更新失败", { type: "error" });
    row.enabled = !val;
  }
}

async function saveSort(row: Live2DModelItem, sort: number) {
  try {
    await updateLive2DModel(row.id, { sort: Number(sort) });
    message("排序已更新", { type: "success" });
    onSearch();
  } catch (e: any) {
    message(e?.message ?? "更新失败", { type: "error" });
  }
}

async function setModelDefaultSkin(modelId: number, skinId: number) {
  try {
    await updateLive2DModel(modelId, { default_skin_id: skinId });
    message("已设为该模型默认皮肤", { type: "success" });
    delete detailMap.value[modelId];
    await ensureDetail({ id: modelId } as Live2DModelItem);
    onSearch();
  } catch (e: any) {
    message(e?.message ?? "更新失败", { type: "error" });
  }
}

async function toggleSkin(skin: Live2DSkinItem, val: boolean) {
  try {
    await updateLive2DSkin(skin.id, { enabled: val });
    message("皮肤状态已更新", { type: "success" });
    delete detailMap.value[skin.model_id];
    await ensureDetail({ id: skin.model_id } as Live2DModelItem);
  } catch (e: any) {
    message(e?.message ?? "更新失败", { type: "error" });
    skin.enabled = !val;
  }
}

async function handleDelete(row: Live2DModelItem) {
  try {
    await deleteLive2DModel(row.id);
    message("已删除", { type: "success" });
    delete detailMap.value[row.id];
    onSearch();
  } catch (e: any) {
    message(e?.message ?? "删除失败", { type: "error" });
  }
}

async function handleImport(force = false) {
  try {
    const res = await importLive2DModels(force);
    message(res.message || "导入完成", { type: "success" });
    detailMap.value = {};
    onSearch();
  } catch (e: any) {
    message(e?.message ?? "导入失败", { type: "error" });
  }
}

function openUpload() {
  uploadForm.value = { name: "", slug: "", enabled: true, file: null };
  uploadVisible.value = true;
}

function onFileChange(file: any) {
  uploadForm.value.file = file?.raw ?? null;
}

async function submitUpload() {
  if (!uploadForm.value.file) {
    message("请选择 zip", { type: "warning" });
    return;
  }
  if (!uploadForm.value.name || !uploadForm.value.slug) {
    message("请填写名称与 slug", { type: "warning" });
    return;
  }
  uploading.value = true;
  try {
    await uploadLive2DZip({
      file: uploadForm.value.file,
      name: uploadForm.value.name,
      slug: uploadForm.value.slug,
      enabled: uploadForm.value.enabled
    });
    message("上传成功（路径已版本化）", { type: "success" });
    uploadVisible.value = false;
    onSearch();
  } catch (e: any) {
    message(e?.message ?? "上传失败", { type: "error" });
  } finally {
    uploading.value = false;
  }
}

async function openDefaultDialog() {
  if (!defaults.value) await onSearch();
  defaultForm.value = {
    default_model_id: defaults.value?.default_model_id || dataList.value[0]?.id || 0,
    default_skin_id: defaults.value?.default_skin_id ?? null
  };
  await loadDefaultSkins();
  defaultDialog.value = true;
}

async function loadDefaultSkins() {
  const id = defaultForm.value.default_model_id;
  if (!id) {
    defaultSkins.value = [];
    return;
  }
  const detail = await getLive2DModel(id);
  defaultSkins.value = detail.skins.filter(s => s.enabled);
  if (
    defaultForm.value.default_skin_id &&
    !defaultSkins.value.some(s => s.id === defaultForm.value.default_skin_id)
  ) {
    defaultForm.value.default_skin_id = defaultSkins.value[0]?.id ?? null;
  }
}

async function submitDefaults() {
  try {
    defaults.value = await setLive2DDefaults({
      default_model_id: defaultForm.value.default_model_id,
      default_skin_id: defaultForm.value.default_skin_id
    });
    message("站点默认已更新", { type: "success" });
    defaultDialog.value = false;
  } catch (e: any) {
    message(e?.message ?? "保存失败", { type: "error" });
  }
}

const defaultSummary = computed(() => {
  if (!defaults.value) return "未加载";
  const m = dataList.value.find(x => x.id === defaults.value?.default_model_id);
  return `模型 #${defaults.value.default_model_id ?? "-"}（catalog index ${defaults.value.default_model_index}） / 皮肤 #${defaults.value.default_skin_id ?? "-"}（index ${defaults.value.default_clothes_index}）${m ? " · " + m.name : ""}`;
});

onMounted(onSearch);
</script>

<template>
  <div class="p-4">
    <el-card shadow="never">
      <template #header>
        <div class="flex justify-between items-center flex-wrap gap-2">
          <div>
            <span class="font-medium">看板娘管理</span>
            <p class="text-xs text-gray-500 mt-1 font-normal">
              列表 / 皮肤 / 站点默认 / zip 上传。资源写入 LIVE2D_LOCAL_ROOT（勿用 demos/ 或图片上传 API）。
              新包路径版本化，避免覆盖 CDN immutable 的 /live2d/ URL。
            </p>
            <p class="text-xs text-gray-500 mt-1">站点默认：{{ defaultSummary }}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <el-button :icon="useRenderIcon('ri:download-cloud-line')" @click="handleImport(false)">
              导入 model_list
            </el-button>
            <el-button @click="openDefaultDialog">设置站点默认</el-button>
            <el-button
              type="primary"
              :icon="useRenderIcon('ri:upload-2-line')"
              @click="openUpload"
            >
              上传 zip
            </el-button>
          </div>
        </div>
      </template>

      <pure-table
        :loading="loading"
        :data="dataList"
        :columns="columns"
        row-key="id"
        align-whole="center"
        header-row-class-name="table-header-gray"
        @expand-change="onExpandChange"
      >
        <template #expand="{ row }">
          <div class="p-3 text-left" v-loading="expandLoading[row.id]">
            <div v-if="detailMap[row.id]">
              <el-table :data="detailMap[row.id].skins" size="small" border>
                <el-table-column prop="id" label="ID" width="70" />
                <el-table-column prop="label" label="Label" min-width="120" />
                <el-table-column prop="rel_path" label="rel_path" min-width="220" />
                <el-table-column prop="sort" label="排序" width="70" />
                <el-table-column label="启用" width="90">
                  <template #default="{ row: skin }">
                    <el-switch
                      :model-value="skin.enabled"
                      @change="(v: boolean) => toggleSkin(skin, v)"
                    />
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="160">
                  <template #default="{ row: skin }">
                    <el-tag
                      v-if="detailMap[row.id].default_skin_id === skin.id"
                      type="success"
                      size="small"
                      class="mr-2"
                    >
                      模型默认
                    </el-tag>
                    <el-button
                      v-else
                      link
                      type="primary"
                      @click="setModelDefaultSkin(row.id, skin.id)"
                    >
                      设为默认
                    </el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
            <span v-else class="text-gray-400">展开以加载皮肤…</span>
          </div>
        </template>

        <template #enabled="{ row }">
          <el-switch
            :model-value="row.enabled"
            @change="(v: boolean) => toggleEnabled(row, v)"
          />
        </template>

        <template #operation="{ row }">
          <el-input-number
            :model-value="row.sort"
            size="small"
            :min="0"
            controls-position="right"
            class="!w-24 mr-2"
            @change="(v: number) => saveSort(row, v)"
          />
          <el-popconfirm
            v-if="row.source === 'upload'"
            title="确定删除该上传模型及磁盘文件？"
            @confirm="handleDelete(row)"
          >
            <template #reference>
              <el-button link type="danger">删除</el-button>
            </template>
          </el-popconfirm>
          <el-tooltip v-else content="内置模型不可物理删除，请禁用">
            <el-button link disabled>删除</el-button>
          </el-tooltip>
        </template>
      </pure-table>
    </el-card>

    <el-dialog v-model="uploadVisible" title="上传 Cubism2 zip" width="520px">
      <el-form label-width="90px">
        <el-form-item label="名称" required>
          <el-input v-model="uploadForm.name" placeholder="显示名称" />
        </el-form-item>
        <el-form-item label="Slug" required>
          <el-input v-model="uploadForm.slug" placeholder="my-model" />
          <p class="text-xs text-gray-400 mt-1">
            落盘：LIVE2D_LOCAL_ROOT/model/&lt;slug&gt;/&lt;version&gt;/…（版本化，不覆盖旧 URL）
          </p>
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="uploadForm.enabled" />
        </el-form-item>
        <el-form-item label="Zip" required>
          <el-upload
            :auto-upload="false"
            :limit="1"
            accept=".zip,application/zip"
            :on-change="onFileChange"
          >
            <el-button>选择 zip</el-button>
          </el-upload>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="uploadVisible = false">取消</el-button>
        <el-button type="primary" :loading="uploading" @click="submitUpload">
          上传
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="defaultDialog" title="站点默认看板娘" width="480px">
      <el-form label-width="100px">
        <el-form-item label="默认模型">
          <el-select
            v-model="defaultForm.default_model_id"
            filterable
            class="w-full"
            @change="loadDefaultSkins"
          >
            <el-option
              v-for="m in dataList.filter(x => x.enabled)"
              :key="m.id"
              :label="`${m.name} (#${m.id})`"
              :value="m.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="默认皮肤">
          <el-select v-model="defaultForm.default_skin_id" filterable class="w-full" clearable>
            <el-option
              v-for="s in defaultSkins"
              :key="s.id"
              :label="`${s.label} (${s.rel_path})`"
              :value="s.id"
            />
          </el-select>
        </el-form-item>
        <p class="text-xs text-gray-500">
          优先级：访客 localStorage → 站点默认 → 代码兜底（20/0）。不强制重置已有 LS。
        </p>
      </el-form>
      <template #footer>
        <el-button @click="defaultDialog = false">取消</el-button>
        <el-button type="primary" @click="submitDefaults">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>
