# dsh-desktop-autostart

给 DeepSeek Harness 桌面版加一个「登录自启动」的 Windows 小插件。

## 起因

我每一次使用DSH都需要手动打开，就想到给它添加一个开机自启动的插件。

翻了社区里好多带 autostart 的插件，发现它们要么起一个 `dsh web` 后台服务，要么自己再加一层托盘、桌面的壳。我用的就是官方桌面版，所以写了个把桌面版放进启动项的插件

## 做了什么

- 设置页：装好之后「设置」左栏会多一项「开机自启」，里面是一个开关和一个文件名（默认 `DeepSeek Harness.lnk`）
- 指向当前正在跑的桌面版 exe，路径没有写死
- 自检：条目在不在、指向对不对；顺带只读扫一遍注册表 `Run` 键和计划任务，如果别处还有指向 DSH 的自启，会在设置页提示一行（只提示，不动它）
- 写后读回、删后确认，总之任何一步失败都会报错，不会静默留下坏状态

## 原理

就是在 Windows 的启动文件夹里放一个快捷方式：

```
%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
```

创建和删除走 `WScript.Shell` COM（用 PowerShell 调一次），不写注册表、不建计划任务、当然也不需要管理员权限。

## 安装

```bash
dsh plugin add github:QiYunqv-jxd/dsh-desktop-autostart
```

## 现状

v0.3。自启引擎、设置页开关、其他来源提示都写完了，开关在「设置 → 开机自启」。默认关着：装上看不出任何变化，你去打开它才会写启动项。扫描只读，不改注册表和计划任务。

## License

MIT
