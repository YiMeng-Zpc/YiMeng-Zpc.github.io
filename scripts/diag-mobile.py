import base64, json, os, socket, struct, subprocess, sys, time, urllib.request
CHROME = r"C:/Program Files/Google/Chrome/Application/chrome.exe"
DP = 9347
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def hj(path, method="GET", body=None):
    url=f"http://127.0.0.1:{DP}{path}"; data=json.dumps(body).encode() if body is not None else None
    req=urllib.request.Request(url,data=data,headers={"Content-Type":"application/json"},method=method)
    return json.loads(urllib.request.urlopen(req,timeout=30).read())
prof=os.path.join(ROOT,".workbuddy","tmp","cprof_diag")
subprocess.run(["cmd","/c","rmdir","/s","/q",prof],capture_output=True)
ch=subprocess.Popen([CHROME,"--headless=new","--disable-gpu","--no-sandbox",f"--user-data-dir={prof}",
    f"--remote-debugging-port={DP}","--window-size=1440,1200","--hide-scrollbars","--no-first-run",
    "http://127.0.0.1:8899/"],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
    for _ in range(60):
        try: hj("/json/version"); break
        except Exception: time.sleep(0.5)
    tabs=hj("/json/list"); page=[t for t in tabs if t["type"]=="page"][0]
    ws=page["webSocketDebuggerUrl"]; path=ws.split(str(DP),1)[1]
    s=socket.create_connection(("127.0.0.1",DP))
    key=base64.b64encode(os.urandom(16)).decode()
    s.send((f"GET {path} HTTP/1.1\r\nHost: 127.0.0.1:{DP}\r\nUpgrade: websocket\r\n"
            f"Connection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n").encode())
    buf=b""
    while b"\r\n\r\n" not in buf: buf+=s.recv(4096)
    _id=[0]
    def send(m,p=None):
        _id[0]+=1; pay=json.dumps({"id":_id[0],"method":m,"params":p or {}}).encode()
        n=len(pay); mk=os.urandom(4); h=b"\x81"
        if n<126: h+=bytes([0x80|n])
        elif n<65536: h+=bytes([0x80|126])+struct.pack(">H",n)
        else: h+=bytes([0x80|127])+struct.pack(">Q",n)
        s.send(h+mk+bytes(b^mk[i%4] for i,b in enumerate(pay))); return _id[0]
    def recv():
        h=s.recv(2); ln=h[1]&0x7F
        if ln==126: ln=struct.unpack(">H",s.recv(2))[0]
        elif ln==127: ln=struct.unpack(">Q",s.recv(8))[0]
        d=b""
        while len(d)<ln: d+=s.recv(ln-len(d))
        return json.loads(d)
    def call(m,p=None,timeout=40):
        want=send(m,p); dl=time.time()+timeout
        while time.time()<dl:
            s.settimeout(max(1,int(dl-time.time())))
            try: msg=recv()
            except socket.timeout: continue
            if msg.get("id")==want: return msg
        raise TimeoutError(m)
    call("Page.enable"); call("Runtime.enable")
    call("Emulation.setDeviceMetricsOverride",{"width":420,"height":1200,"deviceScaleFactor":1,"mobile":True})
    call("Page.navigate",{"url":"http://127.0.0.1:8899/"})
    time.sleep(8)
    expr = """(() => {
      const g = document.querySelector('.home-posts-grid');
      if (!g) return {err:'no grid'};
      const items = [...g.querySelectorAll('.post-card')];
      return {
        docW: document.documentElement.clientWidth,
        scrollW: document.documentElement.scrollWidth,
        gridW: g.clientWidth, gridH: g.clientHeight,
        gridDisplay: getComputedStyle(g).display,
        cols: getComputedStyle(g).gridTemplateColumns,
        items: items.map(it => {
          const r = it.getBoundingClientRect();
          const cs = getComputedStyle(it);
          const link = it.querySelector('.post-card-link');
          const lr = link ? link.getBoundingClientRect() : null;
          const body = it.querySelector('.post-card-body');
          const br = body ? body.getBoundingClientRect() : null;
          return {cardW: Math.round(r.width), cardRight: Math.round(r.right),
                  linkW: lr?Math.round(lr.width):0, linkRight: lr?Math.round(lr.right):0,
                  bodyW: br?Math.round(br.width):0, bodyRight: br?Math.round(br.right):0,
                  scrollDisp: it.querySelector('.post-card-scroll')?getComputedStyle(it.querySelector('.post-card-scroll')).display:'none'};
        })
      };
    })()"""
    r=call("Runtime.evaluate",{"expression":expr,"returnByValue":True})
    print(json.dumps(r.get("result",{}).get("result",{}).get("value"),ensure_ascii=False,indent=1))
finally:
    ch.terminate()
