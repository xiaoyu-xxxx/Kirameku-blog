<script setup lang="ts">
import { ref, onMounted } from "vue";
import { message as msg } from "@/utils/message";
import { getAbout, saveAbout } from "@/api/aboutPage";

defineOptions({ name: "AboutPageIndex" });

const loading = ref(false);
const saving = ref(false);
const form = ref({ content: "", cover: "" });

async function onSearch() {
  loading.value = true;
  try {
    const data = await getAbout();
    form.value = {
      content: data.content ?? "",
      cover: data.cover ?? ""
    };
  } finally {
    loading.value = false;
  }
}

async function handleSave() {
  saving.value = true;
  try {
    await saveAbout({ content: form.value.content, cover: form.value.cover });
    msg("保存成功", { type: "success" });
    onSearch();
  } catch (e: any) {
    msg(e?.message ?? "保存失败", { type: "error" });
  } finally {
    saving.value = false;
  }
}

onMounted(() => onSearch());
</script>

<template>
  <div class="p-4">
    <el-card shadow="never" v-loading="loading">
      <template #header>
        <div class="flex justify-between items-center">
          <span class="font-medium">关于页</span>
          <el-button type="primary" :loading="saving" @click="handleSave">
            保存
          </el-button>
        </div>
      </template>

      <el-form label-width="80px" class="max-w-4xl">
        <el-form-item label="封面图片">
          <el-input
            v-model="form.cover"
            placeholder="https://img.xiaoyu-hh.cn/photowall/2.webp"
          />
        </el-form-item>
        <el-form-item label="正文">
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="18"
            placeholder="支持 Markdown 语法"
          />
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>
