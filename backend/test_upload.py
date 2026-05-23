import urllib.request
import json

content = b"INFO Server started\nWARNING Memory usage high\nERROR Database connection failed\nINFO User login\nERROR Redis timeout"
boundary = b"PythonBoundary123"

body = (
    b"--" + boundary + b"\r\n"
    b"Content-Disposition: form-data; name=\"file\"; filename=\"test.log\"\r\n"
    b"Content-Type: text/plain\r\n\r\n"
    + content
    + b"\r\n--" + boundary + b"--\r\n"
)

req = urllib.request.Request(
    "http://localhost:8000/analyze",
    data=body,
    headers={"Content-Type": "multipart/form-data; boundary=PythonBoundary123"},
    method="POST",
)

with urllib.request.urlopen(req) as r:
    data = json.loads(r.read())
    print(json.dumps(data, indent=2))
