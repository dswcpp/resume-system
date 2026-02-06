#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generate detail.md files for Qt interview questions."""
import os

BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "qt")

def w(qid, content):
    p = os.path.join(BASE, qid, "detail.md")
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        f.write(content.strip() + "\n")
    print(f"Created: {qid}/detail.md")

# ===== qt_001 =====
w("qt_001", """# Qt信号槽机制的工作原理是什么？

## 知识点速览

Qt信号槽是一种**类型安全的观察者模式**实现，是Qt框架最核心的通信机制。它让对象之间的通信完全解耦——发送者不需要知道谁在接收，接收者也不需要知道信号从哪来。

整个机制依赖**元对象系统(Meta-Object System)**，涉及三个关键组件：`Q_OBJECT`宏、`moc`预处理器、`QMetaObject`元信息。

```mermaid
sequenceDiagram
    participant MOC as moc预处理器
    participant Compiler as C++编译器
    participant Runtime as 运行时

    Note over MOC: 编译前阶段
    MOC->>MOC: 扫描Q_OBJECT宏
    MOC->>MOC: 生成moc_xxx.cpp(元信息表+信号实现)
    MOC->>Compiler: 输出生成文件

    Note over Compiler: 编译阶段
    Compiler->>Compiler: 编译源文件+moc文件

    Note over Runtime: 运行时阶段
    Runtime->>Runtime: connect()注册连接到Connection列表
    Runtime->>Runtime: emit信号 → 遍历Connection列表
    Runtime->>Runtime: Direct直接调用 / Queued投递事件队列
```

**核心流程：**

| 阶段 | 动作 | 产物 |
|------|------|------|
| 预处理 | moc扫描Q_OBJECT | moc_*.cpp，包含元信息表和信号函数实现 |
| 编译期 | 正常C++编译 | 元信息嵌入二进制 |
| 运行时connect | 在sender的connectionList注册 | Connection记录(receiver指针+槽index) |
| 运行时emit | 遍历connectionList，按连接类型分发 | 直接调用或事件队列投递 |

## 我的实战经历

**项目背景：** 在南京华乘电气T95带电检测手持终端项目中，我负责核心模块架构设计。终端要同时支持TEV、UHF、AE等多种检测方式，各模块产生的数据需要同时送到UI显示、日志记录、告警判断等多个消费方。

**遇到的问题：** 项目初期，数据模块直接持有UI组件的指针来更新显示。后来要加日志模块和告警模块时，数据模块的代码越改越乱——每加一个消费方就要改数据模块的头文件引入新依赖，模块间耦合严重。有一次改告警逻辑，连带UI刷新出了bug，排查半天才定位到。

**分析与解决：** 我把数据模块重构为纯粹的信号发射者。每当采集到一帧数据，数据模块只管`emit dataReady(const DetectionData& data)`，不关心谁在用这个数据。

```cpp
// 数据模块 —— 只发信号，不依赖任何消费方
class DetectionDataModule : public QObject {
    Q_OBJECT
signals:
    void dataReady(const DetectionData& data);
    void deviceStatusChanged(DeviceStatus status);
    void errorOccurred(int code, const QString& msg);
};
```

在主窗口的初始化阶段统一做connect：

```cpp
// UI模块订阅数据
connect(dataModule, &DetectionDataModule::dataReady,
        waveformWidget, &WaveformWidget::updateWaveform);
// 日志模块订阅数据
connect(dataModule, &DetectionDataModule::dataReady,
        logger, &DataLogger::recordData);
// 告警模块订阅数据和状态
connect(dataModule, &DetectionDataModule::dataReady,
        alarmManager, &AlarmManager::checkThreshold);
```

**结果：** 后来产品经理要求加一个远程数据上传功能，我只需写好上传模块，加一行connect就搞定了，数据模块一行代码不用动。整个架构变成了"发布-订阅"模式，新增功能的集成时间从之前的一两天缩短到几个小时。因为数据模块和UI模块在不同线程，信号槽自动走Queued连接，天然线程安全。

## 深入原理

### moc生成了什么？

moc为每个含Q_OBJECT的类生成`moc_classname.cpp`，核心内容包括：

1. **元信息字符串表**：所有信号、槽、属性的名称和参数类型
2. **信号函数实现**：signals声明的函数体由moc自动生成，内部调用`QMetaObject::activate()`
3. **qt_metacall()函数**：运行时根据索引调用对应槽函数的分派器

```cpp
// moc自动生成的信号实现（简化）
void DetectionDataModule::dataReady(const DetectionData& _t1) {
    void *_a[] = { nullptr, const_cast<void*>(reinterpret_cast<const void*>(&_t1)) };
    QMetaObject::activate(this, &staticMetaObject, 0 /*信号索引*/, _a);
}
```

### connect内部做了什么？

```mermaid
flowchart LR
    A[connect调用] --> B{检查信号/槽签名匹配}
    B -->|匹配| C[创建Connection对象]
    C --> D[记录: sender + signal_index]
    C --> E[记录: receiver + slot_index/functor]
    C --> F[记录: connectionType]
    D --> G[加入sender的connectionList链表]
    E --> G
    F --> G
    B -->|不匹配| H[返回false, 运行时警告]
```

### emit的分发过程

`emit`本身只是一个空宏（`#define emit`），实际调用的是moc生成的信号函数。函数内部：
1. 调用`QMetaObject::activate(sender, metaObject, signalIndex, args)`
2. 遍历sender的connectionList，找到signal_index匹配的所有连接
3. 对每个连接根据`connectionType`执行：
   - **DirectConnection**：直接在当前线程调用槽函数
   - **QueuedConnection**：将调用封装为`QMetaCallEvent`，通过`postEvent()`投递到receiver线程的事件队列
   - **AutoConnection**（默认）：判断sender和receiver是否同线程，同线程走Direct，跨线程走Queued

### 性能考量

| 机制 | 调用开销 | 说明 |
|------|---------|------|
| 直接函数调用 | ~1ns | 直接跳转 |
| Direct信号槽 | ~10-20ns | 遍历列表+间接调用 |
| Queued信号槽 | ~1-5μs | 参数拷贝+事件投递+事件循环分发 |
| 虚函数调用 | ~2-3ns | 一次间接寻址 |

### 常见陷阱

1. **忘记Q_OBJECT宏**：没有这个宏moc不会处理该类，connect在运行时会失败并输出警告
2. **信号槽参数类型不匹配**：新语法在编译期就能检查，旧宏语法要到运行时才报错
3. **跨线程传递引用**：Queued连接会拷贝参数，如果参数类型没有注册到元类型系统(qRegisterMetaType)会崩溃
4. **Lambda捕获悬空指针**：connect到lambda时如果捕获了this，对象销毁后lambda仍可能被调用

## 面试表达建议

**开头：** "Qt信号槽本质是一个类型安全的观察者模式，底层依赖元对象系统。简单说就是三步：moc预处理生成元信息，connect注册连接关系，emit时遍历连接列表分发调用。"

**重点展开：** 结合T95项目说明信号槽的解耦优势——数据模块发信号，UI、日志、告警各自订阅，新增远程上传功能只需一行connect。再提一下跨线程自动走Queued的机制。

**收尾：** "我在项目中特别注意两点：一是跨线程传递自定义类型要qRegisterMetaType，二是lambda中用QPointer防止悬空指针。信号槽虽然比直接调用有一点开销，但带来的解耦和线程安全收益远大于这点性能代价。"
""")

# ===== qt_002 =====
w("qt_002", """# 信号槽和回调函数有什么区别？

## 知识点速览

信号槽和回调函数都是实现"事件发生时通知相关方"的机制，但设计哲学完全不同。回调是C语言时代的产物，简单直接；信号槽是Qt在此基础上的抽象升级，为GUI框架量身打造。

```mermaid
flowchart LR
    subgraph 回调模式
        A[调用者] -->|持有函数指针| B[被调者]
        A -->|直接调用| B
    end

    subgraph 信号槽模式
        C[发送者] -->|emit信号| D[元对象系统]
        D -->|分发| E[接收者1]
        D -->|分发| F[接收者2]
        D -->|分发| G[接收者N]
    end
```

**四维度对比：**

| 维度 | 回调函数 | 信号槽 |
|------|---------|--------|
| 耦合性 | 调用者必须知道回调函数签名，紧耦合 | 发送者完全不知道接收者，松耦合 |
| 一对多 | 需自己维护回调列表 | 天然支持一个信号连多个槽 |
| 线程安全 | 在调用者线程直接执行，跨线程需手动加锁 | Queued连接自动跨线程投递 |
| 生命周期 | 不感知对象销毁，可能悬空调用 | QObject析构自动断开连接 |
| 性能 | 接近直接函数调用 | Direct约10倍开销，Queued更高 |

## 我的实战经历

**项目背景：** 我在两家公司经历了从回调到信号槽的演变过程。2020年在江西威力固做PCB喷墨机项目时，项目用了大量C风格回调；后来2023年到南京华乘电气做T95带电检测终端，全面采用Qt信号槽架构。两段经历让我对二者的优劣有切身体会。

**威力固时期的回调困境：** PCB喷墨机需要控制多个运动轴，底层驱动是C接口，通过函数指针回调上报轴状态。当时的做法是每个轴注册一个回调函数：

```cpp
// 威力固时期 —— 回调方式
typedef void (*AxisCallback)(int axisId, AxisStatus status, void* userData);
void registerAxisCallback(int axisId, AxisCallback cb, void* userData);
```

问题逐渐暴露：
- UI层和控制层都要关心轴状态，但一个轴只能注册一个回调，于是搞了个手动分发列表
- 跨线程回调直接操作UI导致崩溃，得在回调里手动PostMessage到UI线程
- 有一次轴控制模块先析构了，回调还在触发，userData变成野指针，设备直接死机

**华乘T95时期的信号槽重构：** 到了T95项目，我做硬件抽象层时就选择了信号槽。每个检测设备封装为QObject派生类，状态变化通过信号上报：

```cpp
class DetectionDevice : public QObject {
    Q_OBJECT
signals:
    void dataReady(const QByteArray& rawData);
    void statusChanged(DeviceStatus status);
    void errorOccurred(int code);
};
```

多个模块可以自由订阅同一个信号，互不影响。设备对象销毁时Qt自动断开所有连接，不会出现悬空回调。跨线程通信通过Queued连接自动处理，不需要一行同步代码。

**结果：** 信号槽架构下新增一个状态消费方只需一行connect，模块间完全不需要互相引入头文件。威力固那个项目后期维护时有两次因回调顺序问题引发的诡异bug，在T95项目中从未出现过。

## 深入原理

### 回调函数的本质

回调函数本质上是把函数指针作为参数传递，让被调用方在合适时机"回调"调用方的逻辑。回调的核心问题是**调用者必须持有回调对象的引用/指针**，形成强依赖关系。

### 信号槽的间接层

信号槽在发送者和接收者之间插入了一个间接层——`QMetaObject`。connect时注册到sender的connectionList，emit时通过元对象系统遍历分发。这个间接层就是解耦的关键。

### 什么时候还是应该用回调？

1. **对性能极度敏感的热路径**：比如每秒调用百万次的排序比较函数
2. **非QObject的场景**：纯算法库、STL容器的谓词等不适合引入Qt依赖
3. **同步返回值**：回调可以直接返回结果，信号槽的槽函数返回值不易获取
4. **C接口对接**：底层硬件驱动通常只提供C回调接口

### 性能对比数据

| 调用方式 | 单次开销 | 说明 |
|---------|---------|------|
| 直接调用 | ~1ns | 编译器可内联 |
| 函数指针回调 | ~2ns | 一次间接寻址 |
| std::function | ~3-5ns | 有类型擦除开销 |
| Direct信号槽 | ~15-25ns | 元对象遍历+间接调用 |
| Queued信号槽 | ~1-5μs | 参数序列化+事件投递 |

## 面试表达建议

**开头：** "信号槽和回调都是对象间通信机制，但我从两个项目的经历中深刻体会到它们的区别。我总结为四个维度：解耦、一对多、线程安全、生命周期。"

**重点展开：** 讲威力固PCB喷墨机用回调遇到的三个痛点（一对多难搞、跨线程崩溃、悬空指针死机），再说T95项目用信号槽后这些问题都自然消失了。

**收尾：** "当然回调也不是没有场景——性能敏感的热路径、非QObject的算法库、C接口对接这些情况我还是会用回调。但在Qt应用开发中，信号槽应该是默认选择。"
""")

# ===== qt_003 =====
w("qt_003", """# 信号槽的连接类型有哪些？分别用在什么场景？

## 知识点速览

Qt提供五种连接类型，控制信号触发时槽函数在**哪个线程**、以**何种方式**被调用。理解连接类型是正确使用跨线程信号槽的关键。

```mermaid
flowchart TD
    E[emit信号] --> A{连接类型}
    A -->|AutoConnection| B{sender和receiver同线程?}
    B -->|是| C[DirectConnection<br/>直接调用]
    B -->|否| D[QueuedConnection<br/>事件队列投递]
    A -->|DirectConnection| C
    A -->|QueuedConnection| D
    A -->|BlockingQueuedConnection| F[投递+阻塞等待完成]
    A -->|UniqueConnection| G[先检查是否已连接<br/>再按其他类型执行]
```

**五种连接类型总结：**

| 类型 | 执行线程 | 同步/异步 | 典型场景 |
|------|---------|----------|---------|
| Auto（默认） | 自动判断 | 视情况 | 大多数场景，省心之选 |
| Direct | 发送者线程 | 同步 | 同线程、需要即时响应 |
| Queued | 接收者线程 | 异步 | 跨线程通信 |
| BlockingQueued | 接收者线程 | 同步阻塞 | 跨线程但需等待结果 |
| Unique | 同上 | 同上 | 防止重复连接 |

## 我的实战经历

**项目背景：** 在南京华乘电气T95带电检测手持终端项目中，架构上采用"采集线程+UI主线程"分离模式。TEV/UHF传感器的数据采集运行在独立的工作线程中，UI线程负责波形展示和用户交互。

**遇到的问题：** 项目初期，一位初级工程师在connect时显式指定了`DirectConnection`，想着"直接调用快一些"。结果采集线程发`dataReady`信号时，槽函数直接在采集线程执行，操作了UI控件——QLabel::setText在非UI线程调用，程序时不时崩溃，而且是随机崩溃，非常难复现。

**分析与解决：** 我排查后发现是连接类型用错了。采集线程和UI线程是不同线程，必须用Queued或Auto连接。我跟团队统一规范：

```cpp
// 采集线程 -> UI线程：用默认Auto即可，Qt自动判断走Queued
connect(tevWorker, &TEVWorker::dataReady,
        this, &MainWindow::updateWaveform);

// 同线程内的UI组件通信：Auto自动走Direct
connect(startButton, &QPushButton::clicked,
        this, &MainWindow::onStartClicked);
```

还有一个场景用到了`BlockingQueuedConnection`：采集线程需要从UI线程获取当前配置参数：

```cpp
connect(worker, &AcquisitionWorker::requestConfig,
        configDialog, &ConfigDialog::getCurrentConfig,
        Qt::BlockingQueuedConnection);
```

设备连接管理器里用到了`UniqueConnection`——设备重连时防止重复connect：

```cpp
connect(device, &DetectionDevice::statusChanged,
        statusBar, &StatusBar::updateDeviceStatus,
        Qt::UniqueConnection);
```

**结果：** 统一规范后团队再也没出现过"跨线程操作UI"的崩溃。我总结了一条原则告诉两个初级同事：**绝大多数情况用默认Auto，不确定时就不要指定连接类型，Qt比你更清楚该用哪种。**

## 深入原理

### AutoConnection的判断逻辑

Auto连接在**每次emit时**动态判断（不是connect时），比较当前执行线程和receiver的`thread()`属性。

### QueuedConnection的参数传递

Queued连接需要拷贝参数，所以：
1. 参数类型必须可拷贝构造
2. 自定义类型需要用`qRegisterMetaType<MyType>()`注册
3. 参数被序列化到`QMetaCallEvent`中

```cpp
// 必须在使用前注册自定义类型
qRegisterMetaType<DetectionData>("DetectionData");
```

### BlockingQueuedConnection的死锁风险

```mermaid
flowchart LR
    A[线程A: emit信号] -->|投递事件到B| B[线程B的事件队列]
    A -->|阻塞等待| A
    B -->|事件循环处理| C[执行槽函数]
    C -->|完成通知| A
```

死锁场景：如果sender和receiver在同一线程，sender发信号后阻塞等待receiver的事件循环处理——但sender阻塞了事件循环，永远等不到。

### 常见陷阱

1. **Auto不是"一次判断"**：同一个connect，不同次emit可能走不同路径
2. **BlockingQueued + 同线程 = 死锁**：最常见的新手坑
3. **Queued连接中Lambda捕获局部变量**：lambda在不同线程异步执行时，局部变量可能已超出作用域
4. **忘记注册元类型**：自定义类型走Queued连接时不注册会运行时报错

## 面试表达建议

**开头：** "Qt有五种连接类型，核心区别在于槽函数在哪个线程、以同步还是异步方式执行。最常用的是Auto，Qt自动判断走Direct还是Queued。"

**重点展开：** 用T95项目举例——采集线程到UI线程用Auto自动走Queued，获取配置用BlockingQueued，设备重连用Unique防重复。特别强调一次因为误用Direct导致跨线程操作UI崩溃的排查经历。

**收尾：** "我的经验是，默认用Auto就对了，只有在明确需要同步阻塞返回值时才用BlockingQueued，而且一定要确认不在同线程。"
""")

print("qt_001 to qt_003 detail.md done!")
