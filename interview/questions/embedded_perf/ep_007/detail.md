# 跨平台抽象层设计

## 知识点速览
- 跨平台的核心是隔离平台差异，对上层提供统一接口
- 常见差异：文件路径、设备名、系统调用、字节序、线程API
- 抽象手段：接口继承、条件编译、框架封装（Qt）、构建系统隔离
- 目标：业务代码完全不感知平台，编译即可切换目标

## 我的实战经历
T95项目需要同时支持Windows开发调试和Linux（RK3399 ARM64）生产部署：
- 使用Qt框架作为基础抽象层，QSerialPort/QFile/QThread屏蔽了大部分平台差异
- 对于Qt未覆盖的部分（如USB设备枚举、系统级看门狗），定义了IDeviceEnumerator接口，Windows和Linux各有一套实现
- 串口名称差异通过配置文件解决：Windows读COM3，Linux读/dev/ttyUSB0
- 构建系统使用CMake，通过toolchain file切换交叉编译

在营业厅项目中，同一套代码需要跑在x86工控机和ARM64开发板上，通过Qt + CMake实现了零代码修改的跨平台部署。

## 深入原理

### 平台差异清单
| 差异类型 | Windows | Linux | 解决方案 |
|---------|---------|-------|---------|
| 文件路径 | C:\data\log | /opt/data/log | QDir::separator() 或统一用 / |
| 串口名 | COM3 | /dev/ttyUSB0 | 配置文件 / QSerialPortInfo枚举 |
| 动态库 | .dll | .so | CMake自动处理 |
| 进程间通信 | Named Pipe | Unix Socket | Qt QLocalSocket |
| 定时器精度 | ~15ms | ~1ms | Qt QTimer / timerfd |
| 字节序 | 小端 | 可能大端 | qFromBigEndian/qToBigEndian |

### 抽象层设计模式

#### 1. 接口抽象 + 工厂模式
```cpp
// 平台无关接口
class ISerialPort {
public:
    virtual bool open(const QString& port, int baud) = 0;
    virtual QByteArray read(int maxSize) = 0;
    virtual qint64 write(const QByteArray& data) = 0;
    virtual void close() = 0;
    virtual ~ISerialPort() = default;
};

// 工厂函数
std::unique_ptr<ISerialPort> createSerialPort() {
#ifdef USE_QT_SERIAL
    return std::make_unique<QtSerialPort>();
#else
    return std::make_unique<PosixSerialPort>();
#endif
}
```

#### 2. 条件编译隔离
```cpp
// platform_utils.h
#ifdef _WIN32
    #include "platform/win32_impl.h"
#elif defined(__linux__)
    #include "platform/linux_impl.h"
#endif
```

#### 3. CMake源文件隔离
```cmake
if(WIN32)
    target_sources(mylib PRIVATE src/platform/win32.cpp)
elseif(UNIX)
    target_sources(mylib PRIVATE src/platform/linux.cpp)
endif()
```

### Qt作为跨平台抽象层的优势
- 统一的API覆盖文件、网络、串口、线程、GUI
- 信号槽机制本身就是跨平台的事件通信
- QMake/CMake原生支持多平台构建
- 丰富的平台检测宏（Q_OS_WIN、Q_OS_LINUX等）

### 跨平台开发的常见坑
1. **路径分隔符**：永远用QDir::separator()或统一正斜杠
2. **文件权限**：Linux有执行权限概念，Windows没有
3. **换行符**：\\r\\n vs \\n，用QTextStream自动处理
4. **大小写敏感**：Linux文件名区分大小写，Windows不区分
5. **编码问题**：Windows默认GBK，Linux默认UTF-8，统一用UTF-8

## 面试表达建议
先说为什么要跨平台（开发在Windows，部署在Linux ARM），然后说抽象策略（Qt框架 + 接口抽象 + 配置文件），再举一个具体的例子（串口抽象），最后说效果（业务代码零修改即可跨平台部署）。面试官可能追问条件编译的弊端，可以说"条件编译容易导致代码碎片化，能用接口抽象就不用条件编译"。
