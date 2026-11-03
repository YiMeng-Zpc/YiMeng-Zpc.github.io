#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
针对指定元素（CSS 选择器）截图，用于验证文章内图库的排版效果。

用法：
    python scripts/shot-element.py <url路径> <CSS选择器> <输出名> [宽]
例：
    python scripts/shot-element.py /posts/hemu-snow/ .article-gallery-photos gal_only 1440
"""

import base64
import json
import os
import socket
import struct
import subprocess
import sys
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.path.join(ROOT, ".workbuddy", "tmp", "shots")
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PORT = 8899
DEBUG_PORT = 9345


def http_json(path: str, method: str = "GET", body=None):
    url = f"http://127.0.0.1:{DEBUG_PORT}{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data,
                                 headers={"Content-Type": "application/json"}, method=method)
    return json.loads(urllib.request.urlopen(req, timeout=30).read())


class CDP:
    def __init__(self):
        tabs = http_json("/json/list")
        page = [t for t in tabs if t["type"] == "page"][0]
        ws = page["webSocketDebuggerUrl"]
        path = ws.split(str(DEBUG_PORT), 1)[1]
        self.sock = socket.create_connection(("127.0.0.1", DEBUG_PORT))
        key = base64.b64encode(os.urandom(16)).decode()
        req = (f"GET {path} HTTP/1.1\r\nHost: 127.0.0.1:{DEBUG_PORT}\r\n"
               f"Upgrade: websocket\r\nConnection: Upgrade\r\n"
               f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n")
        self.sock.send(req.encode())
        buf = b""
        while b"\r\n\r\n" not in buf:
            buf += self.sock.recv(4096)
        self._id = 0

    def _send(self, method, params=None):
        self._id += 1
        payload = json.dumps({"id": self._id, "method": method,
                              "params": params or {}}).encode()
        n = len(payload)
        mask = os.urandom(4)
        hdr = b"\x81"
        if n < 126:
            hdr += bytes([0x80 | n])
        elif n < 65536:
            hdr += bytes([0x80 | 126]) + struct.pack(">H", n)
        else:
            hdr += bytes([0x80 | 127]) + struct.pack(">Q", n)
        masked = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
        self.sock.send(hdr + mask + masked)
        return self._id

    def _recv(self):
        h = self.sock.recv(2)
        ln = h[1] & 0x7F
        if ln == 126:
            ln = struct.unpack(">H", self.sock.recv(2))[0]
        elif ln == 127:
            ln = struct.unpack(">Q", self.sock.recv(8))[0]
        data = b""
        while len(data) < ln:
            data += self.sock.recv(ln - len(data))
        return json.loads(data)

    def call(self, method, params=None, timeout=40):
        want = self._send(method, params)
        deadline = time.time() + timeout
        while time.time() < deadline:
            self.sock.settimeout(max(1, int(deadline - time.time())))
            try:
                msg = self._recv()
            except socket.timeout:
                continue
            if msg.get("id") == want:
                return msg
        raise TimeoutError(method)


def main():
    path = sys.argv[1]
    selector = sys.argv[2]
    name = sys.argv[3]
    width = int(sys.argv[4]) if len(sys.argv) > 4 else 1440

    os.makedirs(SHOTS, exist_ok=True)
    out = os.path.join(SHOTS, f"{name}.png")
    prof = os.path.join(ROOT, ".workbuddy", "tmp", f"cprof_{name}")
    subprocess.run(["cmd", "/c", "rmdir", "/s", "/q", prof], capture_output=True)

    chrome = subprocess.Popen(
        [CHROME, "--headless=new", "--disable-gpu", "--no-sandbox",
         f"--user-data-dir={prof}", f"--remote-debugging-port={DEBUG_PORT}",
         f"--window-size={width},1200", "--hide-scrollbars", "--no-first-run",
         f"http://127.0.0.1:{PORT}{path}"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    try:
        for _ in range(60):
            try:
                http_json("/json/version")
                break
            except Exception:
                time.sleep(0.5)

        cdp = CDP()
        cdp.call("Page.enable")
        cdp.call("Runtime.enable")
        cdp.call("Emulation.setDeviceMetricsOverride",
                 {"width": width, "height": 1200, "deviceScaleFactor": 1, "mobile": False})
        cdp.call("Page.navigate", {"url": f"http://127.0.0.1:{PORT}{path}"})
        time.sleep(7)

        # 等待图库里所有图片加载完成
        expr = f"""
        (() => {{
          const els = document.querySelectorAll('{selector}');
          if (!els.length) return 'NO_ELEMENT';
          const imgs = els[0].querySelectorAll('img');
          let pending = 0;
          imgs.forEach(i => {{ if (!i.complete) pending++; }});
          if (pending === 0) return 'READY';
          return 'PENDING:' + pending;
        }})()
        """
        for _ in range(20):
            r = cdp.call("Runtime.evaluate", {"expression": expr, "returnByValue": True})
            val = r.get("result", {}).get("result", {}).get("value", "")
            if val == "READY":
                break
            if str(val).startswith("NO_ELEMENT"):
                print("选择器未匹配:", selector)
                break
            time.sleep(1.5)
        time.sleep(2)

        box = cdp.call("Runtime.evaluate", {
            "expression": f"""
            (() => {{
              const e = document.querySelector('{selector}');
              if (!e) return null;
              const r = e.getBoundingClientRect();
              return {{x: r.x + window.scrollX, y: r.y + window.scrollY,
                       w: r.width, h: r.height}};
            }})()
            """, "returnByValue": True})
        rect = box.get("result", {}).get("result", {}).get("value")
        if not rect:
            print("取不到元素位置")
            return 1

        # 让页面滚过去并设置视口，保证 lazy 图片被加载
        cdp.call("Emulation.setDeviceMetricsOverride", {
            "width": width, "height": int(min(rect["h"] + 120, 4000)),
            "deviceScaleFactor": 1, "mobile": False})
        cdp.call("Runtime.evaluate", {
            "expression": f"document.querySelector('{selector}').scrollIntoView()"})
        time.sleep(3)

        shot = cdp.call("Page.captureScreenshot", {"format": "png"})
        if "result" not in shot:
            print("截图失败:", str(shot)[:300])
            return 1
        open(out, "wb").write(base64.b64decode(shot["result"]["data"]))
        print(f"OK {out}  元素尺寸 {int(rect['w'])}x{int(rect['h'])}")
        return 0
    finally:
        chrome.terminate()


if __name__ == "__main__":
    raise SystemExit(main())
