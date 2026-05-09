#! /usr/bin/env python
"""
WordFormat API 服务入口 —— 供内嵌 Python 运行时调用。

用法:
    <python-runtime>/bin/python3 electron/backend_entry.py [端口]

此脚本由 Electron 主进程 spawn，使用内嵌的 Python venv 解释器，
避免 PyInstaller fork 子进程时的线程泄漏问题。

temp/output 是内部临时文件，存放在 app 数据目录中，卸载时随 app 一起清除。
用户下载文件则通过 Electron 原生对话框保存到「下载」文件夹。
"""
import os
import sys
import socket

os.environ["MULTIPROCESSING_RESOURCE_TRACKER"] = "0"

# 跳过 multiprocessing 子进程
if len(sys.argv) >= 2 and sys.argv[-2] == "-c" and sys.argv[-1].startswith(
    ("from multiprocessing.resource_tracker import main", "from multiprocessing.forkserver import main")
):
    sys.exit(0)

from wordformat.api import app
from wordformat.log_config import setup_logger, setup_uvicorn_loguru

setup_logger()
setup_uvicorn_loguru()


def main():
    import uvicorn

    host = os.environ.get("WORDFORMAT_HOST", "127.0.0.1")
    port = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get("WORDFORMAT_PORT", "8000"))

    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        sock.bind((host, port))
        sock.close()
    except OSError:
        print(f"[Backend] 端口 {port} 已被占用", file=sys.stderr, flush=True)
        os._exit(1)

    print(f"[Backend] 启动服务 http://{host}:{port}", flush=True)

    uvicorn.run(
        app,
        host=host,
        port=port,
        log_config=None,
        access_log=False,
        reload=False,
        use_colors=False,
    )


if __name__ == "__main__":
    main()
