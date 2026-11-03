# -*- coding: utf-8 -*-
"""CDP 验证：相册渲染 + 网络请求统计"""
import json, urllib.request, time, websocket, sys

URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:1315/posts/hemu-snow/"

with urllib.request.urlopen("http://127.0.0.1:9222/json", timeout=8) as r:
    ts = json.load(r)
pg = [t for t in ts if t.get("type") == "page" and "127.0.0.1:1315" in t.get("url", "")]
if not pg:
    pg = [t for t in ts if t.get("type") == "page" and t.get("url") not in ("about:blank",)]
t = pg[0]
ws = websocket.create_connection(t["webSocketDebuggerUrl"], timeout=40)
i = [0]
reqs = {}

def send(m, p=None):
    i[0] += 1
    ws.send(json.dumps({"id": i[0], "method": m, "params": p or {}}))
    while True:
        r = json.loads(ws.recv())
        if r.get("id") == i[0]:
            return r
        # 收集网络事件
        meth = r.get("method")
        if meth == "Network.responseReceived":
            p_ = r["params"]
            u = p_["response"]["url"]
            if "uploads/posts" in u or "placeholder" in u:
                reqs[u.split("/")[-1]] = {
                    "status": p_["response"]["status"],
                    "size": p_["response"].get("encodedDataLength", 0),
                    "type": p_.get("type"),
                }
        elif meth == "Runtime.exceptionThrown":
            print("JS_EXC:", str(r["params"])[:200])

send("Page.enable"); send("Runtime.enable"); send("Network.enable")
ws.settimeout(3)
send("Page.navigate", {"url": URL})
time.sleep(12)

js = r"""
(() => {
  const items=[...document.querySelectorAll('.article-gallery-img')];
  const gal=document.querySelector('.article-gallery-photos');
  const gcs=gal?getComputedStyle(gal):null;
  const imgs=items.map(a=>{
    const im=a.querySelector('img'); const cs=getComputedStyle(a); const r=a.getBoundingClientRect();
    return {loaded:a.classList.contains('loaded'), disp:cs.display, w:Math.round(r.width),h:Math.round(r.height),
            src:(im.getAttribute('src')||'').slice(-30), cur:(im.currentSrc||'').slice(-30),
            nat:im.naturalWidth+'x'+im.naturalHeight, cls:im.className,
            vis:r.width>0&&r.height>0&&cs.display!=='none'};
  });
  const st=performance.getEntriesByType('resource').filter(e=>e.name.includes('uploads/posts'));
  return JSON.stringify({url:location.href, count:items.length,
    visible:imgs.filter(x=>x.vis).length, loaded:imgs.filter(x=>x.loaded).length,
    ok:imgs.filter(x=>parseInt(x.nat)>0).length,
    grid:gcs?gcs.display:null, cols:gcs?gcs.gridTemplateColumns:null,
    netCount:st.length, netBytes:st.reduce((a,e)=>a+(e.transferSize||0),0),
    netList:st.map(e=>e.name.split('/').slice(-2).join('/')+' '+(e.transferSize||0)+'B '+Math.round(e.duration)+'ms'),
    imgs});
})()
"""
res = send("Runtime.evaluate", {"expression": js, "returnByValue": True})
v = res.get("result", {}).get("result", {}).get("value")
if v:
    d = json.loads(v)
    print("URL:", d["url"])
    print(f"相册总数 {d['count']} | 可见 {d['visible']} | loaded类 {d['loaded']} | 加载成功 {d['ok']}")
    print("grid:", d["grid"], "| cols:", d["cols"])
    print(f"网络：{d['netCount']} 个图片请求，共 {d['netBytes']} 字节")
    for x in d["netList"]:
        print("   ", x)
    print("-" * 58)
    for i2, x in enumerate(d["imgs"], 1):
        print(f"{i2}. vis={x['vis']} {x['w']}x{x['h']} nat={x['nat']} cls='{x['cls']}' cur={x['cur']}")
else:
    print("EVAL_FAIL")
ws.close()
