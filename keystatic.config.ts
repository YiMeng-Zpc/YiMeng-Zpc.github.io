import { config, fields } from "@keystatic/core";
import { collection } from "@keystatic/hugo";

export default config({
  storage: {
    kind: "github",
  },

  // UI 品牌设置
  ui: {
    brand: {
      name: "忆梦博客管理",
    },
  },

  collections: {
    // ========== 文章管理 ==========
    posts: collection({
      label: "📝 文章管理",
      path: "content/posts",
      slugField: "title",
      schema: {
        title: fields.slug({
          name: { label: "标题", validation: { length: { min: 1 } } },
          slug: { label: "Slug（URL后缀）", generation: "from-title" },
        }),
        date: fields.date({
          label: "发布日期",
          defaultValue: { kind: "today" },
        }),
        description: fields.text({
          label: "摘要",
          multiline: true,
          placeholder: "文章的简短描述，会显示在首页列表中...",
        }),
        cover: fields.file({
          label: "封面图",
          media: { uploadDir: "static/images/uploads" },
          validation: { isRequired: false },
        }),
        categories: fields.multiselect({
          label: "分类",
          options: [
            { label: "技术", value: "技术" },
            { label: "生活", value: "生活" },
            { label: "随笔", value: "随笔" },
            { label: "教程", value: "教程" },
          ],
          defaultValue: ["技术"],
        }),
        tags: fields.array({
          label: "标签",
          itemLabel: { field: "tag" },
          schema: {
            tag: fields.text({
              label: "标签名",
              validation: { length: { min: 1 } },
            }),
          },
        }),
        draft: fields.select({
          label: "草稿状态",
          options: [
            { value: "true", label: "是 - 草稿（不发布）" },
            { value: "false", label: "否 - 发布" },
          ],
          defaultValue: "true",
        }),
        content: fields.markdoc({
          label: "正文内容",
          options: { html: true },
        }),
      },
    }),
  },
});
