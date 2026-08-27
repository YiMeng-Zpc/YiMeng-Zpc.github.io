import Link from "next/link";

export default function HomePage() {
  return (
    <div style={{ padding: "40px", fontFamily: "sans-serif", maxWidth: "600px", margin: "0 auto" }}>
      <h1>忆梦博客管理后台</h1>
      <p>使用 Keystatic CMS 管理你的 Hugo 博客内容。</p>
      <a href="/keystatic" style={{ display: "inline-block", padding: "12px 24px", background: "#0070f3", color: "white", textDecoration: "none", borderRadius: "6px", marginTop: "20px" }}>
        进入内容管理 →
      </a>
    </div>
  );
}
