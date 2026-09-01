with open('static/css/cyber.css', 'rb') as f:
    content = f.read()
idx = content.find(b'@keyframes oceanAmberGradient')
print(repr(content[idx:idx+200].decode('utf-8', errors='replace')))
print('---')
# 找 oceanAmberGradient 的整段
end = content.find(b'}', idx + 200)
print(repr(content[idx:idx+300].decode('utf-8', errors='replace')))