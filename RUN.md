# 运行说明（RUN.md）

> 个人主页 MVP · 本地运行方法 · 2026-09-22

## 一句话

这是一个**纯静态网站**：不需要安装任何依赖，用 Python 自带的小工具就能在本地跑起来。

## 一、启动（3 步）

1. 打开终端（Windows 用「命令提示符」或 PowerShell 都可以）
2. 进入项目文件夹：
   ```
   cd D:\Changda\Documents\vibe_coding
   ```
3. 启动本地服务器：
   ```
   python -m http.server 8000
   ```

看到类似 `Serving HTTP on ... port 8000` 就说明启动成功。

## 二、打开页面

浏览器地址栏输入：

```
http://localhost:8000
```

就能看到首页；点任意作品卡片可进入详情页。

## 三、停止

在终端里按 **Ctrl + C** 即可停止。

## 四、常见问题

| 问题 | 原因 | 解决 |
|---|---|---|
| 提示 `python` 不是命令 | 没装 Python，或没勾选 "Add to PATH" | 装 Python 时勾选加入 PATH（注意：本机用 `python`，不是 `python3`） |
| 提示端口被占用（Address already in use） | 8000 端口被别的程序占用 | 换端口：`python -m http.server 8080`，然后访问 `http://localhost:8080` |
| 页面打不开 | 服务器没在项目目录里启动 | 先 `cd` 进 `vibe_coding` 文件夹，再启动 |

## 五、另一种方式（双击直接看）

直接双击 `index.html` 也能打开页面（地址栏是 `file:///...`）。

> 区别：`file://` 也能看，但**交作业截图要求地址栏是 `localhost` 开头**，所以请用上面「启动」的方式。

## 六、项目文件清单

| 文件 | 作用 |
|---|---|
| `index.html` | 首页 |
| `work.html` | 作品详情页 |
| `style.css` | 全部样式 |
| `img-*.jpg` | 图片（头像、背景、作品图） |
| `AGENTS.md` / `research.md` / `PRD.md` / `TECH_DESIGN.md` | 项目文档 |
