<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { ElMessageBox } from "element-plus";
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
  uploadLive2DSkins,
  uploadSkinPreviewCache,
  type Live2DModelItem,
  type Live2DModelDetail,
  type Live2DDefaults,
  type Live2DSkinItem
} from "@/api/live2d";
import {
  captureAssembledPreview,
  skinModelJsonUrl,
  LivePreviewController
} from "@/utils/live2dPreviewCapture";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";

defineOptions({ name: "Live2DAdminIndex" });

type FilterMode = "all" | "enabled" | "builtin" | "upload";

const loading = ref(false);
const detailLoading = ref(false);
const dataList = ref<Live2DModelItem[]>([]);
const defaults = ref<Live2DDefaults | null>(null);
const detailMap = ref<Record<number, Live2DModelDetail>>({});

const searchQ = ref("");
const filterMode = ref<FilterMode>("all");
const selectedModelId = ref<number | null>(null);
const selectedSkinId = ref<number | null>(null);
const previewBroken = ref(false);
const previewGenerating = ref(false);
const previewGenLabel = ref("");
const batchGenerating = ref(false);
const liveHostEl = ref<HTMLElement | null>(null);
const liveLoading = ref(false);
const liveFailed = ref(false);
const liveReady = ref(false);
let previewAbort: AbortController | null = null;
let previewSeq = 0;
let liveAbort: AbortController | null = null;
let liveSeq = 0;
const liveController = new LivePreviewController();

const uploadVisible = ref(false);
const uploading = ref(false);
const uploadForm = ref({
  name: "",
  slug: "",
  enabled: true,
  file: null as File | null
});

const appendVisible = ref(false);
const appending = ref(false);
const appendForm = ref({
  file: null as File | null,
  setAsDefault: false
});

const defaultDialog = ref(false);
const defaultForm = ref({
  default_model_id: 0,
  default_skin_id: null as number | null
});
const defaultSkins = ref<Live2DSkinItem[]>([]);

const filteredModels = computed(() => {
  const q = searchQ.value.trim().toLowerCase();
  return dataList.value.filter(m => {
    if (filterMode.value === "enabled" && !m.enabled) return false;
    if (filterMode.value === "builtin" && m.source !== "builtin") return false;
    if (filterMode.value === "upload" && m.source !== "upload") return false;
    if (!q) return true;
    return (
      m.name.toLowerCase().includes(q) ||
      m.slug.toLowerCase().includes(q) ||
      String(m.id).includes(q)
    );
  });
});

const selectedModel = computed(
  () => dataList.value.find(m => m.id === selectedModelId.value) ?? null
);

const selectedDetail = computed(() => {
  const id = selectedModelId.value;
  if (!id) return null;
  return detailMap.value[id] ?? null;
});

const selectedSkin = computed(() => {
  const detail = selectedDetail.value;
  if (!detail || !selectedSkinId.value) return null;
  return detail.skins.find(s => s.id === selectedSkinId.value) ?? null;
});

const previewUrl = computed(() => selectedSkin.value?.preview_url || "");

const defaultsSummary = computed(() => {
  const d = defaults.value;
  if (!d?.default_model_id) return "未设置";
  const model = dataList.value.find(m => m.id === d.default_model_id);
  const modelName = model?.name ?? `#${d.default_model_id}`;
  let skinLabel = "";
  if (d.default_skin_id) {
    const cached = detailMap.value[d.default_model_id]?.skins.find(
      s => s.id === d.default_skin_id
    );
    skinLabel = cached?.label ?? `皮肤 #${d.default_skin_id}`;
  } else {
    skinLabel = "模型默认皮肤";
  }
  return `${modelName} · ${skinLabel}`;
});

function formatSize(n: number) {
  if (!n) return "0";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function pickInitialSkin(detail: Live2DModelDetail): number | null {
  if (detail.default_skin_id) {
    const hit = detail.skins.find(s => s.id === detail.default_skin_id);
    if (hit) return hit.id;
  }
  const enabled = detail.skins.find(s => s.enabled);
  return enabled?.id ?? detail.skins[0]?.id ?? null;
}

async function onSearch(preferModelId?: number | null) {
  loading.value = true;
  try {
    const [models, defs] = await Promise.all([
      getLive2DModels(),
      getLive2DDefaults()
    ]);
    dataList.value = models;
    defaults.value = defs;
    const keep =
      preferModelId ??
      selectedModelId.value ??
      defs.default_model_id ??
      models[0]?.id ??
      null;
    if (keep && models.some(m => m.id === keep)) {
      await selectModel(keep, false);
    } else if (models[0]) {
      await selectModel(models[0].id, false);
    } else {
      selectedModelId.value = null;
      selectedSkinId.value = null;
    }
  } finally {
    loading.value = false;
  }
}

async function ensureDetail(modelId: number, force = false) {
  if (!force && detailMap.value[modelId]) return detailMap.value[modelId];
  detailLoading.value = true;
  try {
    const detail = await getLive2DModel(modelId);
    detailMap.value = { ...detailMap.value, [modelId]: detail };
    return detail;
  } finally {
    detailLoading.value = false;
  }
}

async function selectModel(modelId: number, resetSkin = true) {
  cancelPreviewJob();
  cancelLiveLoad();
  liveReady.value = false;
  selectedModelId.value = modelId;
  previewBroken.value = false;
  const detail = await ensureDetail(modelId);
  if (resetSkin || !selectedSkinId.value || !detail.skins.some(s => s.id === selectedSkinId.value)) {
    selectedSkinId.value = pickInitialSkin(detail);
  }
}

function selectSkin(skinId: number) {
  cancelPreviewJob();
  selectedSkinId.value = skinId;
  previewBroken.value = false;
  liveFailed.value = false;
  liveReady.value = false;
}

watch(previewUrl, () => {
  previewBroken.value = false;
});

async function toggleEnabled(row: Live2DModelItem, val: boolean) {
  try {
    await updateLive2DModel(row.id, { enabled: val });
    message(val ? "已启用" : "已禁用", { type: "success" });
    row.enabled = val;
    await onSearch(row.id);
  } catch (e: any) {
    message(e?.message ?? "更新失败", { type: "error" });
    row.enabled = !val;
  }
}

async function saveModelName(row: Live2DModelItem, name: string) {
  const next = (name ?? "").trim();
  if (!next || next === row.name) return;
  try {
    await updateLive2DModel(row.id, { name: next });
    message("名称已更新", { type: "success" });
    await onSearch(row.id);
  } catch (e: any) {
    message(e?.message ?? "更新失败", { type: "error" });
  }
}

async function saveSort(row: Live2DModelItem, sort: number) {
  try {
    await updateLive2DModel(row.id, { sort: Number(sort) });
    message("排序已更新", { type: "success" });
    await onSearch(row.id);
  } catch (e: any) {
    message(e?.message ?? "更新失败", { type: "error" });
  }
}

async function setModelDefaultSkin(modelId: number, skinId: number) {
  try {
    await updateLive2DModel(modelId, { default_skin_id: skinId });
    message("已设为该模型默认皮肤", { type: "success" });
    await ensureDetail(modelId, true);
    await onSearch(modelId);
  } catch (e: any) {
    message(e?.message ?? "更新失败", { type: "error" });
  }
}

async function toggleSkin(skin: Live2DSkinItem, val: boolean) {
  try {
    await updateLive2DSkin(skin.id, { enabled: val });
    message("皮肤状态已更新", { type: "success" });
    await ensureDetail(skin.model_id, true);
  } catch (e: any) {
    message(e?.message ?? "更新失败", { type: "error" });
    skin.enabled = !val;
  }
}

async function saveSkinLabel(skin: Live2DSkinItem, label: string) {
  const next = (label ?? "").trim();
  if (!next) {
    message("label 不能为空", { type: "warning" });
    await ensureDetail(skin.model_id, true);
    return;
  }
  if (next === skin.label) return;
  try {
    await updateLive2DSkin(skin.id, { label: next });
    message("名称已更新", { type: "success" });
    await ensureDetail(skin.model_id, true);
  } catch (e: any) {
    message(e?.message ?? "更新失败", { type: "error" });
    await ensureDetail(skin.model_id, true);
  }
}

async function saveSkinSort(skin: Live2DSkinItem, sort: number) {
  const next = Number(sort);
  if (Number.isNaN(next) || next === skin.sort) return;
  try {
    await updateLive2DSkin(skin.id, { sort: next });
    message("皮肤排序已更新", { type: "success" });
    await ensureDetail(skin.model_id, true);
  } catch (e: any) {
    message(e?.message ?? "更新失败", { type: "error" });
    await ensureDetail(skin.model_id, true);
  }
}

function openAppend() {
  if (!selectedModel.value) return;
  appendForm.value = { file: null, setAsDefault: false };
  appendVisible.value = true;
}

function onAppendFileChange(file: any) {
  appendForm.value.file = file?.raw ?? null;
}

async function submitAppend() {
  if (!selectedModel.value) return;
  if (!appendForm.value.file) {
    message("请选择 zip", { type: "warning" });
    return;
  }
  appending.value = true;
  try {
    const detail = await uploadLive2DSkins({
      modelId: selectedModel.value.id,
      file: appendForm.value.file,
      setAsDefault: appendForm.value.setAsDefault
    });
    message("装扮已追加（版本化路径）", { type: "success" });
    appendVisible.value = false;
    detailMap.value[selectedModel.value.id] = detail;
    selectedSkinId.value = pickInitialSkin(detail);
    await onSearch(selectedModel.value.id);
  } catch (e: any) {
    message(e?.message ?? "追加失败", { type: "error" });
  } finally {
    appending.value = false;
  }
}

async function handleDelete(row: Live2DModelItem) {
  try {
    await deleteLive2DModel(row.id);
    message("已删除", { type: "success" });
    delete detailMap.value[row.id];
    if (selectedModelId.value === row.id) {
      selectedModelId.value = null;
      selectedSkinId.value = null;
    }
    await onSearch();
  } catch (e: any) {
    message(e?.message ?? "删除失败", { type: "error" });
  }
}

async function handleImport(force = false) {
  if (force) {
    try {
      await ElMessageBox.confirm(
        "force=true 会覆盖已有导入关联，确定继续？",
        "强制导入",
        { type: "warning" }
      );
    } catch {
      return;
    }
  }
  try {
    const res = await importLive2DModels(force);
    message(res.message || "导入完成", { type: "success" });
    detailMap.value = {};
    await onSearch();
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
    const detail = await uploadLive2DZip({
      file: uploadForm.value.file,
      name: uploadForm.value.name,
      slug: uploadForm.value.slug,
      enabled: uploadForm.value.enabled
    });
    message("上传成功（路径已版本化）", { type: "success" });
    uploadVisible.value = false;
    detailMap.value[detail.id] = detail;
    await onSearch(detail.id);
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
  const detail = await ensureDetail(id);
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

async function setSiteDefaultQuick() {
  if (!selectedModel.value || !selectedSkin.value) {
    message("请先选择模型与装扮", { type: "warning" });
    return;
  }
  try {
    await ElMessageBox.confirm(
      `将站点默认设为「${selectedModel.value.name} · ${selectedSkin.value.label}」？`,
      "设为站点默认",
      { type: "warning" }
    );
  } catch {
    return;
  }
  try {
    defaults.value = await setLive2DDefaults({
      default_model_id: selectedModel.value.id,
      default_skin_id: selectedSkin.value.id
    });
    message("站点默认已更新", { type: "success" });
  } catch (e: any) {
    message(e?.message ?? "保存失败", { type: "error" });
  }
}

function isSiteDefaultModel(modelId: number) {
  return defaults.value?.default_model_id === modelId;
}


function needsAssembledPreview(skin: Live2DSkinItem | null | undefined) {
  if (!skin) return false;
  // Skip when assembled cache or package-finished preview exists.
  return skin.preview_kind !== "assembled" && skin.preview_kind !== "bundle";
}

function cancelPreviewJob() {
  if (previewAbort) {
    previewAbort.abort();
    previewAbort = null;
  }
}

function cancelLiveLoad() {
  if (liveAbort) {
    liveAbort.abort();
    liveAbort = null;
  }
}

function ensureLiveMounted() {
  const el = liveHostEl.value;
  if (!el) return false;
  liveController.mount(el);
  return true;
}

async function loadLiveForSkin(skin: Live2DSkinItem | null) {
  cancelLiveLoad();
  liveReady.value = false;
  liveFailed.value = false;
  if (!skin?.rel_path) {
    liveLoading.value = false;
    liveController.destroy();
    return;
  }
  if (!ensureLiveMounted()) {
    // Host not ready yet (first paint); retry next tick via watcher path.
    liveLoading.value = true;
    await new Promise<void>(r => requestAnimationFrame(() => r()));
    if (!ensureLiveMounted()) {
      liveLoading.value = false;
      liveFailed.value = true;
      return;
    }
  }

  const ac = new AbortController();
  liveAbort = ac;
  const seq = ++liveSeq;
  liveLoading.value = true;
  try {
    await liveController.load({
      modelJsonUrl: skinModelJsonUrl(skin.rel_path),
      timeoutMs: 15000,
      signal: ac.signal
    });
    if (ac.signal.aborted || seq !== liveSeq) return;
    liveReady.value = true;
    liveFailed.value = false;
  } catch (e: any) {
    if (e?.name === "AbortError" || ac.signal.aborted || seq !== liveSeq) return;
    liveReady.value = false;
    liveFailed.value = true;
  } finally {
    if (seq === liveSeq) {
      liveLoading.value = false;
      if (liveAbort === ac) liveAbort = null;
    }
  }
}

async function snapshotCurrentLive(signal?: AbortSignal): Promise<Blob> {
  if (!liveController.ready) {
    throw new Error("Live preview is not ready");
  }
  return liveController.snapshot(signal);
}

function patchSkinInCaches(skin: Live2DSkinItem) {
  const detail = detailMap.value[skin.model_id];
  if (detail) {
    detailMap.value = {
      ...detailMap.value,
      [skin.model_id]: {
        ...detail,
        skins: detail.skins.map(s => (s.id === skin.id ? { ...s, ...skin } : s)),
        preview_url:
          detail.default_skin_id === skin.id ||
          (!detail.default_skin_id && detail.skins[0]?.id === skin.id)
            ? skin.preview_url
            : detail.preview_url,
        preview_kind:
          detail.default_skin_id === skin.id ||
          (!detail.default_skin_id && detail.skins[0]?.id === skin.id)
            ? skin.preview_kind
            : detail.preview_kind
      }
    };
  }
  const listRow = dataList.value.find(m => m.id === skin.model_id);
  if (listRow) {
    const preferredId =
      listRow.default_skin_id ??
      detailMap.value[skin.model_id]?.skins.find(s => s.enabled)?.id ??
      detailMap.value[skin.model_id]?.skins[0]?.id;
    if (preferredId === skin.id) {
      listRow.preview_url = skin.preview_url ?? null;
      listRow.preview_kind = skin.preview_kind ?? null;
    }
  }
}

async function generatePreviewForSkin(
  skin: Live2DSkinItem,
  opts: { force?: boolean; silent?: boolean } = {}
) {
  if (!skin?.id) return false;
  if (!opts.force && !needsAssembledPreview(skin)) {
    return true;
  }

  cancelPreviewJob();
  const ac = new AbortController();
  previewAbort = ac;
  const seq = ++previewSeq;
  previewGenerating.value = true;
  previewGenLabel.value = `生成预览 · ${skin.label || "#" + skin.id}`;
  previewBroken.value = false;

  try {
    let blob: Blob;
    const isCurrent = selectedSkinId.value === skin.id;
    // Prefer snapshot from the right-panel live canvas (no second full instance).
    if (isCurrent && liveController.ready && !liveFailed.value) {
      blob = await snapshotCurrentLive(ac.signal);
    } else if (isCurrent && liveLoading.value) {
      // Wait briefly for live, then snapshot; else fall back offscreen.
      const started = Date.now();
      while (liveLoading.value && Date.now() - started < 16000) {
        if (ac.signal.aborted || seq !== previewSeq) return false;
        await new Promise(r => setTimeout(r, 100));
      }
      if (liveController.ready && !liveFailed.value) {
        blob = await snapshotCurrentLive(ac.signal);
      } else {
        blob = await captureAssembledPreview({
          modelJsonUrl: skinModelJsonUrl(skin.rel_path),
          width: 512,
          height: 512,
          timeoutMs: 12000,
          signal: ac.signal
        });
      }
    } else {
      blob = await captureAssembledPreview({
        modelJsonUrl: skinModelJsonUrl(skin.rel_path),
        width: 512,
        height: 512,
        timeoutMs: 12000,
        signal: ac.signal
      });
    }
    if (ac.signal.aborted || seq !== previewSeq) return false;
    const updated = await uploadSkinPreviewCache(skin.id, blob);
    if (ac.signal.aborted || seq !== previewSeq) return false;
    patchSkinInCaches(updated);
    if (!opts.silent) {
      message("预览已生成", { type: "success" });
    }
    return true;
  } catch (e: any) {
    if (e?.name === "AbortError" || ac.signal.aborted || seq !== previewSeq) {
      return false;
    }
    message(e?.message ?? "预览生成失败，已回退贴图/旧缓存", { type: "error" });
    return false;
  } finally {
    if (seq === previewSeq) {
      previewGenerating.value = false;
      previewGenLabel.value = "";
      if (previewAbort === ac) previewAbort = null;
    }
  }
}

async function regenerateCurrentPreview() {
  if (!selectedSkin.value) {
    message("请先选择装扮", { type: "warning" });
    return;
  }
  await generatePreviewForSkin(selectedSkin.value, { force: true });
}

async function generateMissingForModel() {
  const detail = selectedDetail.value;
  if (!detail?.skins?.length) {
    message("当前模型没有装扮", { type: "warning" });
    return;
  }
  const targets = detail.skins.filter(s => needsAssembledPreview(s));
  if (!targets.length) {
    message("本模型没有缺失的组装预览", { type: "success" });
    return;
  }
  batchGenerating.value = true;
  let ok = 0;
  let fail = 0;
  try {
    for (const skin of targets) {
      // concurrency 1
      const success = await generatePreviewForSkin(skin, { force: false, silent: true });
      if (success) ok += 1;
      else fail += 1;
    }
    message(`本模型缺失预览：成功 ${ok}，失败 ${fail}`, {
      type: fail ? "warning" : "success"
    });
  } finally {
    batchGenerating.value = false;
  }
}


watch(
  () => {
    const skin = selectedSkin.value;
    return skin ? `${skin.id}:${skin.rel_path}` : "";
  },
  async () => {
    const skin = selectedSkin.value;
    await loadLiveForSkin(skin);
    if (
      skin &&
      needsAssembledPreview(skin) &&
      liveController.ready &&
      !liveFailed.value
    ) {
      await generatePreviewForSkin(skin, { silent: true });
    }
  }
);

onUnmounted(() => {
  cancelPreviewJob();
  cancelLiveLoad();
  liveController.destroy();
});

onMounted(() => onSearch());
</script>

<template>
  <div class="live2d-admin p-4" v-loading="loading">
    <header class="top-bar">
      <div class="top-left min-w-0">
        <div class="title">看板娘</div>
        <div class="defaults-chip">
          <span>站点默认：<strong>{{ defaultsSummary }}</strong></span>
          <el-button size="small" type="primary" @click="openDefaultDialog">更改</el-button>
        </div>
      </div>
      <div class="top-actions">
        <el-dropdown split-button @click="handleImport(false)">
          导入 model_list
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click="handleImport(true)">强制导入 force=true</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button @click="openDefaultDialog">设置站点默认</el-button>
        <el-button
          type="primary"
          :icon="useRenderIcon('ri:upload-2-line')"
          @click="openUpload"
        >
          上传新模型 zip
        </el-button>
      </div>
    </header>

    <div class="layout">
      <aside class="pane left-pane">
        <div class="pane-hd">
          <span>模型</span>
          <span class="hint">{{ filteredModels.length }} / {{ dataList.length }}</span>
        </div>
        <el-input
          v-model="searchQ"
          class="search"
          clearable
          placeholder="搜索名称 / slug…"
          :prefix-icon="useRenderIcon('ri:search-line')"
        />
        <div class="filters">
          <button
            v-for="item in [
              { key: 'all', label: '全部' },
              { key: 'enabled', label: '已启用' },
              { key: 'builtin', label: '内置' },
              { key: 'upload', label: '上传' }
            ]"
            :key="item.key"
            type="button"
            class="chip"
            :class="{ active: filterMode === item.key }"
            @click="filterMode = item.key as FilterMode"
          >
            {{ item.label }}
          </button>
        </div>
        <ul class="model-list">
          <li v-if="!filteredModels.length" class="empty-list">暂无模型。可先导入 model_list。</li>
          <li
            v-for="m in filteredModels"
            :key="m.id"
            class="model-item"
            :class="{ active: selectedModelId === m.id }"
            @click="selectModel(m.id)"
          >
            <div class="thumb" :class="{ placeholder: !m.preview_url }">
              <img v-if="m.preview_url" :src="m.preview_url" alt="" loading="lazy" />
            </div>
            <div class="model-meta min-w-0">
              <div class="name truncate">{{ m.name }}</div>
              <div class="slug truncate">{{ m.slug }} · {{ m.skin_count }} 套</div>
              <div class="tags">
                <span class="tag" :class="m.source === 'upload' ? 'upload' : 'builtin'">
                  {{ m.source === "upload" ? "上传" : "内置" }}
                </span>
                <span v-if="isSiteDefaultModel(m.id)" class="tag site">站点默认</span>
              </div>
            </div>
            <span class="dot" :class="{ off: !m.enabled }" :title="m.enabled ? '已启用' : '已禁用'" />
          </li>
        </ul>
      </aside>

      <section class="pane main-pane">
        <div v-if="!selectedModel" class="empty-main">
          <el-empty description="请选择左侧模型" />
        </div>
        <div v-else class="main-body" v-loading="detailLoading">
          <div class="preview-row">
            <div class="preview-stage">
              <div
                ref="liveHostEl"
                class="live-host"
                :class="{ hidden: !selectedSkin || liveFailed }"
              />
              <img
                v-if="
                  selectedSkin &&
                  (liveFailed || liveLoading) &&
                  previewUrl &&
                  !previewBroken
                "
                class="fallback-img"
                :class="{ dim: liveLoading && !liveFailed }"
                :src="previewUrl"
                alt="skin preview"
                @error="previewBroken = true"
              />
              <div
                v-else-if="!selectedSkin"
                class="fail-note"
              >
                <div>请选择装扮</div>
                <div class="sub">右栏为单实例 Cubism2 live；失败时回退静图</div>
              </div>
              <div
                v-else-if="liveFailed && (!previewUrl || previewBroken)"
                class="fail-note"
              >
                <div>Live 预览失败 / 无静图</div>
                <div class="sub">已尝试贴图回退；可点重新生成</div>
              </div>
              <div v-if="liveLoading || previewGenerating" class="preview-mask">
                <div class="spin" />
                <div>
                  {{
                    previewGenerating
                      ? previewGenLabel || "生成预览中…"
                      : "加载 Live 预览…"
                  }}
                </div>
              </div>
              <div v-if="selectedSkin" class="preview-caption">
                {{ selectedSkin.label }}
                <span v-if="!liveFailed && liveReady"> · Live</span>
                <span v-else-if="selectedSkin.preview_kind === 'assembled'"> · 组装预览</span>
                <span v-else-if="selectedSkin.preview_kind === 'bundle'"> · 包内预览</span>
                <span v-else-if="selectedSkin.preview_kind === 'atlas'"> · 贴图回退</span>
                <span v-if="!selectedSkin.enabled"> · 已禁用</span>
              </div>
              <div v-if="selectedSkin" class="preview-toolbar" @click.stop>
                <el-button
                  size="small"
                  type="primary"
                  plain
                  :loading="previewGenerating && !batchGenerating"
                  :disabled="batchGenerating"
                  @click="regenerateCurrentPreview"
                >
                  重新生成
                </el-button>
                <el-button
                  size="small"
                  :loading="batchGenerating"
                  :disabled="previewGenerating && !batchGenerating"
                  @click="generateMissingForModel"
                >
                  生成本模型缺失
                </el-button>
              </div>
            </div>
<div class="side-card">
              <h3>{{ selectedModel.name }}</h3>
              <div class="kv">
                <div>
                  <span>ID / Slug</span>
                  <b>#{{ selectedModel.id }} · {{ selectedModel.slug }}</b>
                </div>
                <div>
                  <span>来源</span>
                  <b>{{ selectedModel.source === "upload" ? "上传" : "内置" }}</b>
                </div>
                <div>
                  <span>体积</span>
                  <b>
                    {{
                      selectedModel.source === "upload"
                        ? formatSize(selectedModel.package_size)
                        : "—"
                    }}
                  </b>
                </div>
                <div>
                  <span>皮肤数</span>
                  <b>{{ selectedDetail?.skins.length ?? selectedModel.skin_count }}</b>
                </div>
              </div>

              <div class="field">
                <span class="label">显示名</span>
                <el-input
                  :model-value="selectedModel.name"
                  size="small"
                  @change="(v: string) => saveModelName(selectedModel, v)"
                />
              </div>
              <div class="field row">
                <span class="label">排序</span>
                <el-input-number
                  :model-value="selectedModel.sort"
                  size="small"
                  :min="0"
                  controls-position="right"
                  class="!w-28"
                  @change="(v: number) => saveSort(selectedModel, v)"
                />
              </div>
              <div class="field row">
                <span class="label">启用</span>
                <el-switch
                  :model-value="selectedModel.enabled"
                  @change="(v: boolean) => toggleEnabled(selectedModel, v)"
                />
              </div>

              <div class="row-actions">
                <el-button type="primary" size="small" @click="openAppend">追加装扮</el-button>
                <el-button size="small" @click="setSiteDefaultQuick">设为站点默认</el-button>
                <el-popconfirm
                  v-if="selectedModel.source === 'upload'"
                  title="确定删除该上传模型及磁盘版本目录？"
                  @confirm="handleDelete(selectedModel)"
                >
                  <template #reference>
                    <el-button size="small" type="danger">删除</el-button>
                  </template>
                </el-popconfirm>
                <el-tooltip v-else content="内置模型不可物理删除，请禁用">
                  <el-button size="small" disabled>删除</el-button>
                </el-tooltip>
              </div>
            </div>
          </div>

          <div class="skins-block">
            <div class="skins-hd">
              <h4>装扮</h4>
              <span class="hint">选中高亮；可改 label / sort；预览由模型渲染生成；rel_path 只读</span>
            </div>
            <div v-if="selectedDetail?.skins?.length" class="skin-grid">
              <div
                v-for="skin in selectedDetail.skins"
                :key="skin.id"
                class="skin-card"
                :class="{
                  selected: selectedSkinId === skin.id,
                  disabled: !skin.enabled
                }"
                @click="selectSkin(skin.id)"
              >
                <span
                  v-if="selectedDetail.default_skin_id === skin.id"
                  class="corner"
                >模型默认</span>
                <div class="thumb" :class="{ placeholder: !skin.preview_url }">
                  <img
                    v-if="skin.preview_url"
                    :src="skin.preview_url"
                    alt=""
                    loading="lazy"
                    @error="($event.target as HTMLImageElement).style.display = 'none'"
                  />
                </div>
                <el-input
                  :model-value="skin.label"
                  size="small"
                  class="label-input"
                  @click.stop
                  @change="(v: string) => saveSkinLabel(skin, v)"
                />
                <div class="path" :title="skin.rel_path">{{ skin.rel_path }}</div>
                <div class="foot" @click.stop>
                  <el-switch
                    :model-value="skin.enabled"
                    size="small"
                    @change="(v: boolean) => toggleSkin(skin, v)"
                  />
                  <el-input-number
                    :model-value="skin.sort"
                    size="small"
                    :min="0"
                    controls-position="right"
                    class="!w-20"
                    @change="(v: number) => saveSkinSort(skin, v)"
                  />
                  <el-button
                    v-if="selectedDetail.default_skin_id !== skin.id"
                    link
                    type="primary"
                    @click="setModelDefaultSkin(selectedModel.id, skin.id)"
                  >
                    设默认
                  </el-button>
                  <el-tag v-else size="small" type="success">默认</el-tag>
                </div>
              </div>
            </div>
            <el-empty v-else description="该模型暂无装扮" :image-size="72" />
          </div>
        </div>
      </section>
    </div>

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
        <el-button type="primary" :loading="uploading" @click="submitUpload">上传</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="appendVisible"
      :title="selectedModel ? `追加装扮 · ${selectedModel.name}` : '追加装扮'"
      width="520px"
    >
      <el-form label-width="120px">
        <el-form-item label="目标模型">
          <span v-if="selectedModel">
            {{ selectedModel.name }} (#{{ selectedModel.id }} / {{ selectedModel.slug }})
          </span>
        </el-form-item>
        <el-form-item label="Zip" required>
          <el-upload
            :auto-upload="false"
            :limit="1"
            accept=".zip,application/zip"
            :on-change="onAppendFileChange"
          >
            <el-button>选择 zip</el-button>
          </el-upload>
          <p class="text-xs text-gray-400 mt-1">
            解压到 model/&lt;slug&gt;/&lt;version&gt;/…，不覆盖已有 immutable URL；多套包全部登记，sort 递增。
          </p>
        </el-form-item>
        <el-form-item label="设为默认皮肤">
          <el-switch v-model="appendForm.setAsDefault" />
          <span class="text-xs text-gray-400 ml-2">仅改该模型 default_skin；不改站点默认</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="appendVisible = false">取消</el-button>
        <el-button type="primary" :loading="appending" @click="submitAppend">
          上传并追加
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

<style scoped>
.live2d-admin {
  --l2d-border: var(--el-border-color-lighter, #e4e7ed);
  --l2d-muted: var(--el-text-color-secondary, #909399);
  --l2d-primary: var(--el-color-primary, #409eff);
  --l2d-soft: var(--el-color-primary-light-9, #ecf5ff);
  --l2d-left: 340px;
  --l2d-preview-h: 380px;
  display: flex;
  flex-direction: column;
  height: calc(100dvh - 140px);
  max-height: calc(100dvh - 140px);
  min-height: 480px;
  overflow: hidden;
  box-sizing: border-box;
}
.top-bar {
  background: var(--el-bg-color);
  border: 1px solid var(--l2d-border);
  border-radius: 8px;
  padding: 14px 16px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.title {
  font-weight: 600;
  font-size: 15px;
}
.defaults-chip {
  margin-top: 8px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--l2d-soft);
  color: var(--l2d-primary);
  border: 1px solid var(--el-color-primary-light-7, #d9ecff);
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 12px;
}
.top-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.layout {
  display: grid;
  grid-template-columns: var(--l2d-left) 1fr;
  gap: 12px;
  flex: 1;
  min-height: 0;
  height: 100%;
  align-items: stretch;
}
.pane {
  background: var(--el-bg-color);
  border: 1px solid var(--l2d-border);
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
}
.left-pane,
.main-pane {
  min-height: 0;
  height: 100%;
}
.pane-hd {
  padding: 10px 12px;
  border-bottom: 1px solid var(--l2d-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  font-size: 13px;
}
.hint {
  font-weight: 400;
  color: var(--l2d-muted);
  font-size: 12px;
}
.search {
  margin: 10px 12px 0;
  width: calc(100% - 24px);
}
.filters {
  display: flex;
  gap: 6px;
  padding: 8px 12px;
  flex-wrap: wrap;
}
.chip {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--l2d-border);
  color: var(--l2d-muted);
  cursor: pointer;
  background: #fff;
}
.chip.active {
  background: var(--l2d-soft);
  border-color: var(--el-color-primary-light-5, #b3d8ff);
  color: var(--l2d-primary);
}
.model-list {
  list-style: none;
  margin: 0;
  padding: 0 0 8px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.model-item {
  display: grid;
  grid-template-columns: 48px 1fr auto;
  gap: 10px;
  align-items: center;
  padding: 10px 12px;
  border-bottom: 1px solid #f0f2f5;
  cursor: pointer;
}
.model-item:hover {
  background: #fafafa;
}
.model-item.active {
  background: var(--l2d-soft);
  box-shadow: inset 3px 0 0 var(--l2d-primary);
}
.thumb {
  width: 48px;
  height: 48px;
  border-radius: 6px;
  background: linear-gradient(145deg, #eef2f7, #dfe6ee);
  border: 1px solid var(--l2d-border);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
  color: var(--l2d-muted);
  font-size: 11px;
}
.thumb.placeholder::after {
  content: "无预览";
}
.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top center;
  display: block;
}
.model-meta .name {
  font-weight: 600;
  font-size: 13px;
}
.model-meta .slug {
  color: var(--l2d-muted);
  font-size: 11px;
  margin-top: 2px;
}
.tags {
  margin-top: 4px;
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.tag {
  font-size: 10px;
  padding: 0 6px;
  border-radius: 3px;
  background: #f4f4f5;
  color: var(--l2d-muted);
  border: 1px solid #e9e9eb;
}
.tag.site {
  background: #f0f9eb;
  color: #67c23a;
  border-color: #e1f3d8;
}
.tag.upload {
  background: #fdf6ec;
  color: #e6a23c;
  border-color: #faecd8;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #67c23a;
}
.dot.off {
  background: #c0c4cc;
}
.empty-list {
  padding: 24px 12px;
  color: var(--l2d-muted);
  font-size: 13px;
  text-align: center;
}
.main-body {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  min-height: 0;
  overflow: auto;
}
.empty-main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
.preview-row {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 12px;
}
.preview-stage {
  height: var(--l2d-preview-h);
  border: 1px dashed #dcdfe6;
  border-radius: 8px;
  background:
    linear-gradient(45deg, #f0f2f5 25%, transparent 25%) 0 0 / 16px 16px,
    linear-gradient(-45deg, #f0f2f5 25%, transparent 25%) 0 0 / 16px 16px,
    #fafbfc;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}
.live-host {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}
.live-host.hidden {
  visibility: hidden;
  pointer-events: none;
}
.live-host :deep(canvas),
.live-host canvas {
  max-width: 100%;
  max-height: 100%;
  display: block;
  filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.12));
}
.preview-stage img,
.preview-stage .fallback-img {
  max-height: 92%;
  max-width: 70%;
  object-fit: contain;
  filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.12));
  transition: opacity 0.15s ease;
  position: relative;
  z-index: 0;
}
.preview-stage .fallback-img.dim {
  opacity: 0.35;
}
.preview-caption {
  position: absolute;
  left: 12px;
  bottom: 10px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--l2d-border);
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  color: var(--l2d-muted);
  z-index: 3;
}
.fail-note {
  color: var(--l2d-muted);
  text-align: center;
  font-size: 13px;
}
.fail-note .sub {
  font-size: 11px;
  margin-top: 4px;
}
.side-card {
  border: 1px solid var(--l2d-border);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: #fff;
}
.side-card h3 {
  margin: 0;
  font-size: 15px;
}
.kv {
  font-size: 12px;
  color: var(--l2d-muted);
  display: grid;
  gap: 6px;
}
.kv div {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
.kv b {
  color: var(--el-text-color-primary);
  font-weight: 500;
  text-align: right;
}
.field .label {
  display: block;
  font-size: 12px;
  color: var(--l2d-muted);
  margin-bottom: 4px;
}
.field.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.field.row .label {
  margin: 0;
}
.row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: auto;
}
.skins-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  gap: 8px;
}
.skins-hd h4 {
  margin: 0;
  font-size: 13px;
}
.skin-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 10px;
}
.skin-card {
  border: 1px solid var(--l2d-border);
  border-radius: 6px;
  padding: 8px;
  cursor: pointer;
  background: #fff;
  position: relative;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.skin-card:hover {
  border-color: #c6e2ff;
}
.skin-card.selected {
  border-color: var(--l2d-primary);
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
}
.skin-card.disabled {
  opacity: 0.55;
}
.skin-card .thumb {
  width: 100%;
  height: 88px;
  margin-bottom: 6px;
}
.skin-card .path {
  font-size: 10px;
  color: var(--l2d-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 4px;
}
.skin-card .foot {
  margin-top: 6px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}
.corner {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 1;
  background: #67c23a;
  color: #fff;
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 3px;
}
.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
@media (max-width: 1100px) {
  .layout {
    grid-template-columns: 1fr;
  }
  .left-pane {
    max-height: 320px;
  }
  .preview-row {
    grid-template-columns: 1fr;
  }
}

.preview-mask {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: rgba(255, 255, 255, 0.72);
  color: var(--l2d-muted);
  font-size: 12px;
  z-index: 4;
}
.preview-mask .spin {
  width: 28px;
  height: 28px;
  border: 3px solid #dcdfe6;
  border-top-color: var(--l2d-primary);
  border-radius: 50%;
  animation: l2d-spin 0.8s linear infinite;
}
@keyframes l2d-spin {
  to {
    transform: rotate(360deg);
  }
}
.preview-toolbar {
  position: absolute;
  right: 10px;
  top: 10px;
  z-index: 3;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
</style>
