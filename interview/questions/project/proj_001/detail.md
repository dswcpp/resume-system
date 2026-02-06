# 你的SPSC无锁队列是怎么设计的？为什么不用mutex？

## 知识点速览

SPSC（Single Producer Single Consumer）无锁队列的核心是**环形缓冲区 + 两个原子索引 + 内存序**。生产者只写 head，消费者只写 tail，各自只读对方的变量来判断满/空，不存在写-写竞争，因此不需要互斥锁。关键在于用 `memory_order_release` 和 `memory_order_acquire` 配对，保证"数据先写入 buffer，消费者才能看到 head 更新"。

**核心概念：**
- **环形缓冲区**：固定大小数组，容量取 2 的幂方便位运算取模
- **head/tail 原子索引**：`alignas(64)` 缓存行对齐避免 false sharing
- **memory_order**：release 保证写入顺序，acquire 保证读取可见性
- **与 mutex 对比**：mutex 每次 push/pop 都要加锁解锁，1000Hz 意味着每秒 2000 次锁操作

## 我的实战经历

**公司/项目：** 南京华乘电气 · T95 带电检测手持终端

**问题（Situation + Task）：**
T95 上线初期，现场工程师反馈界面卡顿严重。UHF 检测模式下波形图刷新明显掉帧，有时甚至出现"假死"。我用 Qt Creator 的 Profiler 分析后发现三个核心问题：

1. 数据采集线程和 UI 线程用 `QMutex` 同步，锁竞争占 CPU 时间 20% 以上
2. UI 线程被动响应数据——每来一帧就刷新一次，但采集速率 1000Hz，屏幕才 60Hz
3. 每次刷新都深拷贝整个数据包，拷贝开销大

根本原因：采集线程 1000Hz 产生数据，UI 线程 30Hz 消费，两者速率差 33 倍，mutex 同步在高频场景下锁竞争非常严重。

**解决（Action）：**
我主导了数据管线重构，分三步实施：

**第一步：SPSC 无锁队列替代 mutex**

分析场景后发现恰好是"一个采集线程写、一个 UI 线程读"的 SPSC 模式，这是无锁队列最简单也最高效的场景。核心实现：

```cpp
template<typename T, size_t Capacity>
class SPSCQueue {
    static_assert((Capacity & (Capacity - 1)) == 0, "Capacity must be power of 2");
    std::array<T, Capacity> buffer_;
    alignas(64) std::atomic<size_t> head_{0};  // 生产者写，独占缓存行
    alignas(64) std::atomic<size_t> tail_{0};  // 消费者写，独占缓存行

public:
    bool push(const T& item) {
        const size_t head = head_.load(std::memory_order_relaxed);  // 读自己的，relaxed够用
        const size_t next = (head + 1) & (Capacity - 1);
        if (next == tail_.load(std::memory_order_acquire))  // 读对方的，要acquire
            return false;
        buffer_[head] = item;
        head_.store(next, std::memory_order_release);  // 写完数据后release，让消费者看到
        return true;
    }

    bool pop(T& item) {
        const size_t tail = tail_.load(std::memory_order_relaxed);
        if (tail == head_.load(std::memory_order_acquire))
            return false;
        item = buffer_[tail];
        tail_.store((tail + 1) & (Capacity - 1), std::memory_order_release);
        return true;
    }
};
```

**第二步：控频刷新**

UI 不再被动响应数据到来，改为主动按 30Hz 拉取最新帧：

```cpp
void DisplayManager::onRefreshTimer() {  // 每33ms触发
    DataPacketPtr packet;
    while (dataQueue_.pop(packet)) {
        latestPacket_ = std::move(packet);  // 只保留最新帧
    }
    if (latestPacket_) {
        updateDisplay(latestPacket_);
    }
}
```

**第三步：shared_ptr 零拷贝**

```cpp
using DataPacketPtr = std::shared_ptr<DataPacket>;
SPSCQueue<DataPacketPtr, 64> dataQueue_;  // 传指针不传数据
```

分阶段上线：先替换 UHF 模块验证一周没问题，再推广到 TEV、AE、红外模块，最后删除旧的加锁队列代码。

**结果（Result）：**

| 指标 | 优化前 | 优化后 |
|------|--------|--------|
| UI 刷新延迟 | 200ms | 50ms |
| CPU 占用（UI 线程） | 45% | 18% |
| 整体 CPU 占用 | 85% | 45% |
| 切换模式卡顿 | 1-2 秒 | 无感知 |

实测吞吐量对比：mutex 队列约 500 万次/秒，SPSC 无锁队列约 1 亿次/秒，快 20 倍。

## 深入原理

### memory_order 详解

现代 CPU 会乱序执行，编译器也会重排指令。如果不控制，可能出现：生产者先更新 head 再写 buffer，消费者看到 head 更新了但数据还没写入。

六种 memory_order 从弱到强：
- `relaxed`：只保证原子性，允许任意重排
- `acquire`：之后的读写不能重排到前面（读屏障）
- `release`：之前的读写不能重排到后面（写屏障）
- `seq_cst`：最强顺序一致性，默认值，性能最差

SPSC 中的配对关系：
- 生产者 `release` 写 head → 消费者 `acquire` 读 head
- 消费者 `release` 写 tail → 生产者 `acquire` 读 tail

这保证了"数据写入一定在索引更新之前完成"。

### false sharing 与缓存行对齐

head 和 tail 如果在同一个缓存行（通常 64 字节），一个 CPU 改 head 会导致另一个 CPU 的 tail 缓存失效（即使 tail 没变）。`alignas(64)` 让两个变量各占独立缓存行，消除 false sharing。

### 容量选择

容量必须是 2 的幂，用位运算 `& (Capacity - 1)` 代替取模 `% Capacity`，性能更好。容量根据最大延迟估算：1000Hz 生产，消费者最多卡 100ms → 需要 100 个槽位 → 取 128。

### 常见面试追问

- **为什么不用 Qt 信号槽？** 信号槽底层也是事件队列，但有类型擦除和 QVariant 转换开销，跨线程时动态分配内存。我们场景固定、性能敏感，自己实现更可控。
- **无锁队列会丢数据吗？** 会，队列满了 push 返回 false。但采集 1000Hz 显示 30Hz，大部分帧本来就不显示，关键是保证"最新数据能显示"。
- **多生产者怎么办？** SPSC 不支持，可以每个生产者一个队列消费者轮询，或用 MPSC 队列。我们项目每个检测模块一个队列，恰好是 SPSC。
- **ABA 问题？** SPSC 没有 ABA 问题，因为 head/tail 只会单向递增，不会出现"改了又改回来"的情况。

## 面试表达建议

**开头先给结论：** "我用 SPSC 无锁队列把 UI 延迟从 200ms 降到 50ms。核心原理是环形缓冲区加两个原子索引，配合 memory_order 保证可见性。"

**中间讲清 Why：** "选无锁而非 mutex 是因为场景恰好单生产单消费，1000Hz 采集 30Hz 显示，mutex 的锁竞争是实测出来的瓶颈——Profiler 显示锁等待占 CPU 20%。"

**结尾量化收尾：** "优化后延迟从 200ms 降到 50ms，CPU 从 85% 降到 45%。这个方案后来推广到了所有检测模块。"

**如果被追问 memory_order：** 画图解释 release-acquire 配对，强调"写完数据后 release，读到索引后 acquire"的逻辑。不要把六种都背一遍，重点讲 SPSC 中怎么用。
