import { config, collection, fields } from "@keystatic/core";

export default config({
  storage: {
    kind: "github",
    repo: "YiMeng-Zpc/YiMeng-Zpc.github.io",
  },
  ui: {
    brand: {
      name: "忆梦博客管理",
    },
  },
  collections: {
    posts: collection({
      label: "文章",
      slugField: "title",
      path: "content/posts/*",
      format: { contentField: "content" },
      schema: {
        title: fields.slug({ name: { label: "标题" } }),
        date: fields.date({ label: "发布日期", defaultValue: { kind: "today" } }),
        description: fields.text({ label: "描述", multiline: true }),
        tags: fields.array(
          fields.text({ label: "标签名" }),
          {
            label: "标签",
            itemLabel: (props) => String(props.value) ?? "标签",
          }
        ),
        draft: fields.checkbox({ label: "草稿", defaultValue: true }),
        content: fields.markdoc({
          label: "内容",
        }),
      },
    }),
  },
});
