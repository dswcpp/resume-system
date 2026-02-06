# 集成周期从3个月缩短到约50天，具体怎么做到的？

## 知识点速览

模块化集成框架的核心思路是**定义统一接口 + 抽取通用基础设施 + 工厂注册机制**。通过面向接口编程，让新模块只需关注自身业务逻辑，框架自动处理连接管理、协议解析、数据流转、UI绑定等通用需求。

**关键设计要素：**
- **IDetectionModule 抽象基类**：定义生命周期、连接、采集三层接口
- **ModuleFactory 工厂模式**：宏注册 + 运行时创建
- **通用基础设施复用**：ConnectionStateMachine、FrameParser、DataPipeline
- **模块管理器**：统一加载/卸载、信号转发、错误隔离

## 我的实战经历

**公司/项目：** 南京华乘电气 · T95 带电检测手持终端

**问题（Situation + Task）：**
T95 需要集成多种检测技术：红外测温、UHF 超高频局放、TEV 暂态地电压、AE 声发射，未来还可能有更多。原来每接入一个新模块需要 3 个月（约 14 周），时间分配大致是：

| 阶段 | 耗时 | 说明 |
|------|------|------|
| 研究 SDK | 2 周 | 读文档、跑 demo、理解数据格式 |
| 写连接管理 | 1 周 | 每个模块重新写一套 |
| 写协议解析 | 2 周 | 帧格式不统一，重复造轮子 |
| 写数据处理 | 2 周 | 缓存、格式转换、滤波 |
| 写 UI 显示 | 2 周 | 图表控件、温度标注 |
| 集成到主程序 | 1 周 | 改主框架代码 |
| 联调测试 | 2 周 | 和其他模块一起跑 |

根本问题是每个模块都在**重复造轮子**——连接管理、错误处理、日志记录每次都从头写；代码风格不统一，不同人写的结构不同；没有统一接口，每次集成都要改主程序。

**解决（Action）：**

**第一步：设计统一接口 IDetectionModule**

经过分析所有模块的共同行为，抽象出三层接口：

```cpp
class IDetectionModule {
public:
    virtual ~IDetectionModule() = default;
    // 生命周期
    virtual bool initialize() = 0;
    virtual void shutdown() = 0;
    // 连接管理
    virtual bool connect() = 0;
    virtual void disconnect() = 0;
    virtual ConnectionState getConnectionState() const = 0;
    // 数据采集
    virtual bool startAcquisition() = 0;
    virtual void stopAcquisition() = 0;
    virtual bool isAcquiring() const = 0;
    // 信息查询
    virtual ModuleType getType() const = 0;
    virtual QString getName() const = 0;
};
```

接口设计原则：最小化（只定义必须的方法）、生命周期分层（初始化/连接/采集三层分离）、信号通知（dataReady/stateChanged/errorOccurred 通过 Qt 信号异步解耦）。

**第二步：抽取通用基础设施**

- **ConnectionStateMachine**：通用连接状态机，处理 Disconnected→Connecting→Initializing→Ready→Error 的转换，包含超时、重试、自动重连逻辑。所有模块复用同一套。
- **FrameParser**：可配置帧格式的通用协议解析器（帧头/长度/数据/CRC），状态机驱动逐字节解析。
- **DataPipeline**：处理管线，串联多个 IProcessor，SPSC 队列解耦输入输出。

**第三步：工厂注册机制**

```cpp
#define REGISTER_MODULE(Type, Class) \
    static bool _registered_##Class = []() { \
        ModuleFactory::instance().registerModule(Type, []() { return new Class(); }); \
        return true; \
    }();

// 模块实现文件中一行搞定注册
REGISTER_MODULE(ModuleType::IR, IrModule)
```

新模块注册后，ModuleManager 自动处理加载/卸载、信号连接、错误隔离。

**第四步：红外模块作为首个试点验证**

用新框架接入红外模块：
- 第 1 周：研究 SDK，只关注核心 API（6 个函数）
- 第 2-3 周：继承 IDetectionModule 实现，复用 ConnectionStateMachine
- 第 4 周：配置 DataPipeline（伪彩色映射、温度计算），复用通用显示控件
- 第 5 周：统一测试框架跑测试

**结果（Result）：**

| 项目 | 原来 | 现在 | 节省 |
|------|------|------|------|
| 连接管理 | 1 周 | 复用 | 1 周 |
| 协议解析 | 2 周 | 配置化 | 1.5 周 |
| 数据处理 | 2 周 | 管线配置 | 1 周 |
| UI 显示 | 2 周 | 控件复用 | 1 周 |
| 集成 | 1 周 | 自动注册 | 1 周 |
| 测试 | 2 周 | 统一框架 | 1 周 |
| **总计** | **14 周** | **约 6-7 周** | **约 8 周** |

红外模块 5 周完成，AE 模块 4 周。后续模块稳定在 4-6 周（约 50 天）。

## 深入原理

### 接口设计的取舍

接口设计最难的是"放什么进去"。太多方法增加实现成本，太少又不够通用。我的原则：
1. 只放所有模块都需要的方法
2. 特殊需求通过扩展接口或配置参数解决
3. 不符合接口的模块用**适配器模式**包装

### 模块间隔离

每个模块独立线程、独立数据队列、只通过 IDetectionModule 接口通信、不使用全局变量。一个模块出错不影响其他模块——实测关闭 TEV 模块时红外模块照常工作。

### 为什么不用插件系统（DLL 动态加载）？

考虑过，但 T95 是手持终端，模块在编译期就确定了，不需要运行时动态加载。静态注册更简单、调试更方便、启动更快。如果将来有需求再扩展。

## 面试表达建议

**开头用对比数据：** "原来接一个新检测模块要 3 个月，我设计了统一的模块化框架后，缩短到约 50 天。红外模块是首个试点，5 周就上线了。"

**中间讲核心思路：** "做了三件事——统一接口规范让新模块只关注业务逻辑、抽取通用基础设施避免重复造轮子、工厂注册机制实现零框架改动的集成。"

**收尾展示方法论：** "这件事让我理解到，好的架构不是一开始就设计出来的，而是在痛点积累到足够多之后，有针对性地抽象。我总结成了一套接入指南，新人也能按文档独立开发模块。"
