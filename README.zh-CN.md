# LinkPi Companion


[![CI](https://github.com/GodsQuantum/linkpi-companion/actions/workflows/ci.yml/badge.svg)](https://github.com/GodsQuantum/linkpi-companion/actions/workflows/ci.yml) [![CodeQL](https://github.com/GodsQuantum/linkpi-companion/actions/workflows/codeql.yml/badge.svg)](https://github.com/GodsQuantum/linkpi-companion/actions/workflows/codeql.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[English](README.md) · [Français](README.fr.md) · **中文**

LinkPi ENC1 V3 系列编码器的便携式控制助手、上手向导与自动导播工具。

目标很简单：把摄像机、麦克风和存储设备接到 LinkPi，打开 `http://<LINKPI_IP>:8787`，然后按照清晰的步骤完成输入检查、编码、录制、推流和 Auto Director 配置，而无需替换 LinkPi 原生 Encoder。

## 8787 端口里有什么

默认首页是 **Guide / 指南**，共六步：

1. 摄像机 — 实时检查 HDMI 与 USB/UVC 输入。
2. 视频 + 音频 — 显示易懂的通道、编码与音频信息。
3. Auto Director — 麦克风检测、校准、CAM A / CAM B / SPLIT readiness。
4. 录制 — 外接存储、MP4 和 CAM A + CAM B + PROGRAM 工作流。
5. 推流 — RTMP/RTMPS、SRT、RTP/UDP 参数生成与校验。
6. 开播前检查 — 根据你选择的工作流显示 READY / INCOMPLETE / PROBLEM。

界面同时提供完整 **Auto Director** 控制页、状态诊断页，以及指向 LinkPi 原生 PHP 页面（Input、Encode、Stream、Push、Record、Storage、Carousel、Mix）的直接链接。

## 多语言

Companion UI 支持：

- Français
- English
- 简体中文

语言可以在界面顶部切换并保存在当前浏览器中，也可以通过 `?lang=fr`、`?lang=en` 或 `?lang=zh-CN` 直接打开指定语言。

## 当前状态

当前版本：`0.3.0-alpha.1`。

软件层面的预硬件验证已完成，但真实 Blackmagic、DJI Osmo Pocket 3、麦克风与三路同时录制的生产级测试仍需完成。因此这是 **alpha** 版本，而不是“已验证生产”的正式版。

已验证开发目标：

- LinkPi ENC1 V3 / SS524V100
- APP/SDK 5.3.0，SYS 5.3.1（20260731）
- `/usr/php/bin/php`
- 原生 Encoder `/RPC`
- Companion：`http://<LINKPI_IP>:8787`

在摄像机、独立麦克风检测、校准和 A/B/SPLIT 场景全部就绪前，服务器端会拒绝启用 `AUTO`。

## 快速安装 / 恢复

在与 LinkPi 同一局域网的电脑上：

```bash
git clone https://github.com/GodsQuantum/linkpi-companion.git
cd linkpi-companion
./scripts/install.sh <LINKPI_IP>
```

例如设备处于常见默认地址时：

```bash
./scripts/install.sh 192.168.1.217
```

在已测试的固件上，安装器使用 LinkPi 原生配置恢复接口，因此不需要 SSH。它会先备份现有 Companion/Auto Director 配置，保留硬件映射、校准、导播参数与现有 cron，然后安装运行时并验证 `:8787`。

常用命令：

```bash
./scripts/status.sh <LINKPI_IP>
./scripts/harden.sh <LINKPI_IP>
./scripts/test.sh
```

## 推流助手

当前版本不会自动改写生产推流配置，而是生成并校验需要复制到 LinkPi 原生页面中的值，便于首次硬件调试时随时回退。

支持：

- RTMP / RTMPS：服务器 + Stream Key → 完整推流地址。
- SRT：Caller / Listener / Rendezvous、主机、端口、latency、可选 passphrase 与 streamid。
- RTP / UDP：单播或组播、端口、TTL、RTP header。
- YouTube / Twitch 专用表单以及自定义 RTMP/RTMPS。

Stream Key、passphrase 等敏感值只存在于当前浏览器输入框中，不写入 Companion 配置，也不会由 Companion 诊断 API 返回。

## 录制目标

目标工作流是：**CAM A + CAM B + PROGRAM 同时录制为 MP4 到外接 USB 硬盘，同时推流 PROGRAM**。

在真实 ENC1 V3 上完成负载测试前，Companion 会明确把“三路同时录制”标记为待验证，而不会假装它已经适合生产。

## 安全模型

- LinkPi 原生 C++ Encoder 始终负责采集、编码、录制与推流。
- 不启用 Developer Mode / EncoderJS。
- 启动模式为 `OFF`。
- `DRY_RUN` 可以做导播判断，但不能切换视频。
- readiness 不完整时服务器拒绝 `AUTO`。
- Companion 的 LinkPi 诊断接口只读，并清理 credential 类字段。
- 高频状态写入 `/tmp`，避免持续写 eMMC。

## 项目结构

```text
companion/embedded/       部署到 LinkPi 内的 PHP runtime + Companion UI
companion/reference-node/ 可重复测试的参考实现
scripts/                  安装、加固、恢复、状态与测试工具
docs/                     架构、运维与硬件 commissioning 文档
```

关键文档：

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/OPERATIONS.md`](docs/OPERATIONS.md)
- [`docs/HARDWARE-COMMISSIONING.md`](docs/HARDWARE-COMMISSIONING.md)
- [`docs/PRODUCTION-READINESS-CHECKLIST.md`](docs/PRODUCTION-READINESS-CHECKLIST.md)
- [`SECURITY.md`](SECURITY.md)
- [`CONTRIBUTING.md`](CONTRIBUTING.md)

## 安全提示

`8787` 目前没有应用层登录。请把 LinkPi 和 Companion 放在可信 LAN/VLAN 中，不要把 LinkPi Web UI、RPC、SSH、RTSP 或 Companion 控制端口直接暴露到互联网。

## 许可

MIT License。详见 [`LICENSE`](LICENSE)。
