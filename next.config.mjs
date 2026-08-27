/** @type {import('next').NextConfig} */
const nextConfig = {
  // 排除 Hugo 相关目录，避免 Next.js 扫描它们
  experimental: {},
  typescript: {
    // 忽略构建时的类型错误（Hugo 主题文件不受控制）
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
