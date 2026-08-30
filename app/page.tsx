import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 20px",
      fontFamily: "'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif",
      background: "radial-gradient(ellipse at top, #160a2e, #0b0418)",
      color: "#f4eaff",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* 背景动态粒子 */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0); opacity: .4; }
          50%      { transform: translateY(-30px) rotate(180deg); opacity: 1; }
        }
        .p-bg {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 0;
        }
        .p-bg::before, .p-bg::after {
          content: '';
          position: absolute;
          width: 600px; height: 600px;
          border-radius: 50%;
          filter: blur(120px);
          animation: float 8s ease-in-out infinite;
        }
        .p-bg::before {
          background: radial-gradient(circle, #ff2bd6, transparent 60%);
          top: -200px; left: -200px;
        }
        .p-bg::after {
          background: radial-gradient(circle, #00f0ff, transparent 60%);
          bottom: -200px; right: -200px;
          animation-delay: 4s;
        }
        .c-neon {
          background: linear-gradient(90deg, #ff2bd6, #00f0ff, #9d4edd, #ff2bd6);
          background-size: 300% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: ng 6s ease infinite;
        }
        @keyframes ng {
          0%, 100% { background-position: 0% 50%; }
          50%      { background-position: 100% 50%; }
        }
        .btn-neon {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 16px 36px;
          border-radius: 999px;
          background: linear-gradient(135deg, #ff2bd6, #9d4edd);
          color: white;
          text-decoration: none;
          font-weight: 700;
          letter-spacing: 1.2px;
          font-size: 1.05rem;
          box-shadow: 0 8px 30px rgba(255,43,214,.5);
          transition: transform .3s ease, box-shadow .3s ease;
        }
        .btn-neon:hover {
          transform: translateY(-3px) scale(1.04);
          box-shadow: 0 12px 40px rgba(255,43,214,.7);
        }
        .btn-ghost {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 14px 28px;
          border-radius: 999px;
          color: #00f0ff;
          text-decoration: none;
          font-weight: 600;
          border: 1px solid rgba(0,240,255,.4);
          transition: all .3s ease;
        }
        .btn-ghost:hover {
          background: rgba(0,240,255,.1);
          border-color: #00f0ff;
          box-shadow: 0 0 20px rgba(0,240,255,.3);
        }
      `}</style>
      <div className="p-bg"></div>

      <div style={{ position: "relative", zIndex: 1, maxWidth: 720, textAlign: "center" }}>
        <div style={{ fontSize: 14, letterSpacing: 6, opacity: .7, marginBottom: 20 }}>
          ✦ KEYSTATIC CMS ✦
        </div>
        <h1 className="c-neon" style={{
          fontSize: "clamp(2.2rem, 6vw, 3.8rem)",
          fontWeight: 800,
          margin: "0 0 16px",
          lineHeight: 1.1,
        }}>
          忆梦博客 · 内容管理后台
        </h1>
        <p style={{
          fontSize: "1.1rem",
          opacity: .8,
          margin: "0 auto 36px",
          maxWidth: 540,
          lineHeight: 1.6,
        }}>
          这是你 Hugo 博客的 Keystatic CMS 管理界面。
          通过 GitHub OAuth 登录后即可创建、编辑、删除文章与站点设置。
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "center" }}>
          <Link href="/keystatic" className="btn-neon">
            <i className="fa-solid fa-arrow-right-to-bracket"></i>
            进入内容管理 →
          </Link>
          <a
            href="https://www.zhangpengchao.com"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost"
          >
            <i className="fa-solid fa-globe"></i>
            访问博客主站
          </a>
        </div>

        <div style={{
          marginTop: 56,
          padding: "24px",
          background: "rgba(22,10,46,.6)",
          border: "1px solid rgba(157,78,221,.3)",
          borderRadius: 14,
          backdropFilter: "blur(8px)",
          textAlign: "left",
          fontSize: ".92rem",
          lineHeight: 1.7,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 8, color: "#00f0ff" }}>
            <i className="fa-solid fa-circle-info"></i> 架构说明
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, opacity: .85 }}>
            <li><b style={{ color: "#ff2bd6" }}>博客主站</b>：Hugo 静态站，部署在 GitHub Pages → <a href="https://www.zhangpengchao.com" style={{ color: "#00f0ff" }}>www.zhangpengchao.com</a></li>
            <li><b style={{ color: "#ff2bd6" }}>管理后台</b>：Next.js + Keystatic，部署在 Cloudflare Workers/Pages</li>
            <li><b style={{ color: "#ff2bd6" }}>数据源</b>：通过 GitHub OAuth 操作 <code style={{ background: "rgba(255,43,214,.15)", padding: "2px 6px", borderRadius: 4 }}>YiMeng-Zpc/YiMeng-Zpc.github.io</code> 仓库的 <code style={{ background: "rgba(255,43,214,.15)", padding: "2px 6px", borderRadius: 4 }}>content/posts/*</code></li>
          </ul>
        </div>

        <div style={{ marginTop: 32, fontSize: ".8rem", opacity: .5 }}>
          Powered by Next.js · Keystatic · Cloudflare Workers
        </div>
      </div>
    </main>
  );
}