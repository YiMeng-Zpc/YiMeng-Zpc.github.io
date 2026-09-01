#!/usr/bin/env python3
content = """seo: 站点标题改为'张鹏超' (提高搜索命中率)

用户反馈: '现在的标题是'张鹏超的博客',我需要改成'张鹏超'或者
'zhangpengchao',不然搜索引擎搜索我的名字搜不到'

改动:
- hugo.toml L3 (主 title): '张鹏超的博客' -> '张鹏超'
- hugo.toml L12 ([params] title): '张鹏超的博客' -> '张鹏超'
- description / keyword / about.md 不动 (已经包含'张鹏超',
  SEO meta tag 命中)

渲染结果:
- <title>张鹏超</title> (浏览器标签 + Google/Bing 搜索结果)
- <meta name='description' content='张鹏超 — 记录代码、旅行、
  摄影与一切在路上的人'/>
- 关于页 <title>关于 | 张鹏超</title>

注: 如果以后想海外 SEO 也能命中 'ZhangPengchao',
      可加 params.author = 'ZhangPengchao' 或 og:profile 字段,
      当前不阻塞。
"""
with open('_msg.txt', 'wb') as f:
    f.write(content.encode('utf-8'))

import subprocess, sys
r = subprocess.run(['git', 'add', '-A'], capture_output=True)
r2 = subprocess.run(['git', 'commit', '-F', '_msg.txt'], capture_output=True)

# 用 GBK 安全输出
out = (r.stdout + r2.stdout + r2.stderr).decode('gbk', errors='replace')
sys.stdout.buffer.write(out.encode('gbk', errors='replace'))
sys.stdout.buffer.write(b'\n')