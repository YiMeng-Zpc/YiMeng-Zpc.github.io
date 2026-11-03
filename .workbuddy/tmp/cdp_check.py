# -*- coding: utf-8 -*-
"""通过 CDP 检测文章页相册图片的渲染与加载情况"""
import json, urllib.request, time, sys, socket

try:
    import websocket  # websocket-client
except ImportError:
    print("NO_WS"); sys.exit(2)

def get_targets():
    with urllib.request.urlopen("http://127.0.0.1:9222/json", timeout=8) as r:
        return json.load(r)

def pick_page():
    for t in get_targets():
        if t.get("type") == "page" and "127.0.0.1:1314" in t.get("url", ""):
            return t
    for t in get_targets():
        if t.get("type") == "page":
            return t
    return None

t = pick_page()
if not t:
    print("NO_TARGET"); sys.exit(3)

ws = websocket.create_connection(t["webSocketDebuggerUrl"], timeout=30)
_id = [0]
def send(method, params=None, wait=True):
    _id[0] += 1
    msg = {"id": _id[0], "method": method, "params": params or {}}
    ws.send(json.dumps(msg))
    if not wait: return None
    while True:
        r = json.loads(ws.recv())
        if r.get("id") == _id[0]:
            return r

send("Page.enable")
send("Runtime.enable")
send("Network.enable")

# 采集网络请求
send("Page.reload", {"ignoreCache": False})
time.sleep(9)

js = r"""
(() => {
  const items = [...document.querySelectorAll('.article-gallery-img')];
  const imgs = items.map(a => {
    const im = a.querySelector('img');
    const cs = getComputedStyle(a);
    const r = a.getBoundingClientRect();
    return {
      loaded: a.classList.contains('loaded'),
      aDisplay: cs.display, aPos: cs.position,
      w: Math.round(r.width), h: Math.round(r.height),
      imgSrc: (im.getAttribute('src')||'').slice(-40),
      imgCurrent: (im.currentSrc||'').slice(-40),
      natural: im.naturalWidth + 'x' + im.naturalHeight,
      complete: im.complete,
      cls: im.className,
      visible: r.width > 0 && r.height > 0 && cs.display !== 'none'
    };
  });
  const gal = document.querySelector('.article-gallery-photos');
  const gcs = gal ? getComputedStyle(gal) : null;
  return JSON.stringify({
    count: items.length,
    visibleCount: imgs.filter(x=>x.visible).length,
    loadedCount: imgs.filter(x=>x.loaded).length,
    okCount: imgs.filter(x=>x.natural.split('x')[0] > 0).length,
    gridDisplay: gcs ? gcs.display : null,
    gridCols: gcs ? gcs.gridTemplateColumns : null,
    imgs
  });
})()
"""
res = send("Runtime.evaluate", {"expression": js, "returnByValue": True})
val = res.get("result", {}).get("result", {}).get("value")
if val:
    d = json.loads(val)
    print("相册项总数:", d["count"])
    print("可见数(display!=none且有尺寸):", d["visibleCount"])
    print("带 loaded 类:", d["loadedCount"])
    print("图片实际加载成功(naturalWidth>0):", d["okCount"])
    print("grid display:", d["gridDisplay"], "| cols:", d["gridCols"])
    print("-" * 60)
    for i, x in enumerate(d["imgs"], 1):
        print(f"{i}. vis={x['visible']} loaded={x['loaded']} {x['w']}x{x['h']} natural={x['natural']} cls={x['cls']}")
        print(f"   src={x['imgSrc']}")
else:
    print("EVAL_FAIL", json.dumps(res)[:400])

ws.close()
