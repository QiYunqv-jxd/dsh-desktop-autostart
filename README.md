# dsh-desktop-autostart

给 DeepSeek Harness 桌面版加一个「登录自启动」的 Windows 小插件。

## 起因

我每一次使用DSH都需要手动打开，就想到给它添加一个开机自启动的插件。

翻了社区里好多带 autostart 的插件，发现它们要么起一个 `dsh web` 后台服务，要么自己再加一层托盘、桌面的壳。我用的就是官方桌面版，所以写了个把桌面版放进启动项的插件

## 做了什么

- 开关（0.2 版）：在插件里打开或关闭登录自启
- 指向当前正在跑的桌面版 exe，路径没有写死
- 自检：条目在不在、指向对不对（重复项检测排在 0.2）
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

v0.1 预发布。自启引擎已写完并在本机自测通过，设置页开关排在 0.2。注意：目前关闭/卸载插件不会自动删除启动项（防止误删你手工创建的快捷方式）；要停用自启，请等 0.2 的开关，或手动删掉启动文件夹里的 `DeepSeek Harness.lnk`。

有问题直接开 issue，我看到了会回。

## License

MIT
