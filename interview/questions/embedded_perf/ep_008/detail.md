# 看门狗与异常恢复机制

## 知识点速览
- 看门狗分为硬件看门狗（MCU/SoC级）和软件看门狗（进程级）
- 软件看门狗 = 守护进程 + 心跳检测 + 自动重启
- 异常捕获层次：C++ try-catch → 信号处理 → 进程管理器
- 生产环境必须有崩溃日志和自动恢复能力

## 我的实战经历
营业厅项目部署在客户现场的工控机上，7×24小时运行，稳定性要求极高：
- 开发了软件看门狗守护进程，每5秒通过心跳机制检查主进程存活状态
- 主进程注册了SIGSEGV和SIGABRT信号处理器，崩溃时将堆栈信息写入crash log
- 看门狗检测到主进程异常后，先记录日志，再自动重新启动
- 连续崩溃时采用指数退避策略（5s→10s→20s→...），避免反复快速重启消耗系统资源
- 连续失败超过5次触发告警，通知运维远程介入
- 配合分级日志系统（DEBUG/INFO/WARN/ERROR/FATAL），运维可以远程查看日志定位问题

## 深入原理

### 硬件看门狗 vs 软件看门狗
| 特性 | 硬件看门狗 | 软件看门狗 |
|------|----------|----------|
| 实现层级 | MCU/SoC硬件模块 | 用户态守护进程 |
| 超时动作 | 硬件复位（整个系统重启） | 杀掉并重启目标进程 |
| 喂狗方式 | 写寄存器 | 心跳包/共享内存/kill -0 |
| 适用场景 | 裸机/RTOS | Linux/Windows应用 |
| 可靠性 | 极高（硬件保证） | 取决于守护进程本身 |

### 软件看门狗架构
```
┌────────────────────────────────┐
│ 看门狗守护进程 (Watchdog)       │
│  ┌──────────────────────────┐  │
│  │ 心跳检测循环 (5s间隔)     │  │
│  │  ├─ kill(pid, 0) 检查存活 │  │
│  │  ├─ 或读取心跳文件/管道    │  │
│  │  └─ 超时判定              │  │
│  └──────────────────────────┘  │
│  ┌──────────────────────────┐  │
│  │ 恢复策略                  │  │
│  │  ├─ 记录crash日志         │  │
│  │  ├─ 重启进程              │  │
│  │  ├─ 指数退避重试           │  │
│  │  └─ 超过阈值→告警通知      │  │
│  └──────────────────────────┘  │
└────────────────────────────────┘
         ↕ 心跳
┌────────────────────────────────┐
│ 主业务进程                      │
│  ├─ 定期发送心跳               │
│  ├─ 注册信号处理器             │
│  └─ try-catch保护关键逻辑      │
└────────────────────────────────┘
```

### 异常捕获的三个层次

#### 1. C++异常层
```cpp
try {
    mainLoop();
} catch (const std::exception& e) {
    LOG_FATAL("Unhandled exception: {}", e.what());
    // 保存状态，清理资源
    saveRecoveryState();
} catch (...) {
    LOG_FATAL("Unknown exception caught");
}
```

#### 2. 系统信号层
```cpp
#include <signal.h>
#include <execinfo.h>

void crashHandler(int sig) {
    // 获取堆栈信息
    void* frames[64];
    int n = backtrace(frames, 64);
    // 写入crash log（信号处理器中只能用async-signal-safe函数）
    int fd = open("/tmp/crash.log", O_WRONLY|O_CREAT|O_APPEND, 0644);
    backtrace_symbols_fd(frames, n, fd);
    close(fd);
    _exit(1); // 不能用exit()，不安全
}

// 注册
signal(SIGSEGV, crashHandler);
signal(SIGABRT, crashHandler);
```

#### 3. 进程管理层
```ini
# systemd service文件
[Service]
ExecStart=/opt/app/main_process
Restart=always
RestartSec=5
StartLimitBurst=5
StartLimitIntervalSec=60
```

### 指数退避策略
```
第1次重启: 等待 5秒
第2次重启: 等待 10秒
第3次重启: 等待 20秒
第4次重启: 等待 40秒
第5次重启: 触发告警，停止自动重启，等待人工介入
成功运行超过5分钟: 重置计数器
```

### 信号处理器注意事项
- 只能调用async-signal-safe函数（write、_exit等）
- 不能调用malloc、printf、new等函数
- 不能操作锁（可能是在持锁时崩溃的）
- 尽量只做最小工作：写crash log然后退出

## 面试表达建议
按层次讲：先说C++层的try-catch（最基本的异常保护），再说信号处理器（捕获段错误等致命异常），最后说看门狗（进程级的保障）。结合营业厅项目的实际部署经验：7×24小时运行、自动拉起、远程日志排查。强调这是一套"纵深防御"体系。
