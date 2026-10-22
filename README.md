# dsh-desktop-autostart

给 DeepSeek Harness 桌面版加一个「登录后自动启动」的 Windows 小插件。

## 起因

我开机之后基本第一件事就是点开 Harness，每天都要手动开一次，很烦。

翻了社区里所有带 autostart 的插件，发现它们要么起一个 `dsh web` 后台服务，要么自己再包一层托盘、桌面壳。我用的就是官方桌面版，不需要多一个进程、多一个端口、多一个要维护的东西，所以写了个只干一件事的插件：把桌面版自己放进启动项。

## 做了什么

- 开关：在插件里打开或关闭登录自启
- 指向当前正在跑的桌面版 exe，不写死路径
- 自检：条目在不在、指向还对不对、有没有重复
- 写后读回、删后确认，任何一步失败都会报错，不会静默留下坏状态

## 原理

就是在 Windows 的启动文件夹里放一个快捷方式：

```
%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
```

创建和删除走 `WScript.Shell` COM（用 PowerShell 调一次），不写注册表、不建计划任务、不需要管理员权限。

## 安装

```bash
dsh plugin add github:QiYunqv-jxd/dsh-desktop-autostart
```

## 现状

v0.1 预发布。自启那块逻辑写完了，在本机自测通过；设置页里的开关还在接。

有问题直接开 issue，我看到了会回。

## License

MIT
