# 15MB/s的实时数据流是怎么处理的？

## 知识点速览

处理大数据流的核心策略是**流水线并行 + 零拷贝 + 控频显示**。将采集、解析、处理、显示分到独立线程，用无锁队列解耦；通过内存池和 shared_ptr 避免数据拷贝和运行时分配；UI 按固定帧率只渲染最新帧。

**数据量拆解：**
| 模块 | 采样率 | 每帧大小 | 数据率 |
|------|--------|----------|--------|
| 红外 | 25Hz | 640×480×2B = 600KB | 15MB/s |
| UHF | 1000Hz | 1024×2B = 2KB | 2MB/s |
| TEV | 1000Hz | 512×2B = 1KB | 1MB/s |
| AE | 1000Hz | 1024×2B = 2KB | 2MB/s |

红外是绝对大头，单模块就 15MB/s。

## 我的实战经历

**公司/项目：** 南京华乘电气 · T95 带电检测手持终端

**问题（Situation + Task）：**
T95 多个检测模块同时采集数据，总数据量约 20MB/s。优化前代码在 SDK 回调里同步做数据拷贝（200μs）+ 格式转换（5000μs）+ UI 更新（10000μs），单帧处理就要 15ms。红外 25Hz 需要 40ms/帧的预算，处理完已经用了近一半，再加上采集、排队等开销，整个管线跟不上。

实测问题：
- 优化前帧率只能到 18fps（目标 25fps）
- 吞吐量 10.5MB/s 不达标
- CPU 占用 85%，设备发烫

**解决（Action）：**

**第一步：流水线架构——各环节并行**

把串行的"采集→解析→处理→显示"拆成四个独立线程，用 SPSC 队列连接：

```cpp
class IrDataPipeline {
    SPSCQueue<RawFramePtr, 8> rawQueue_;        // 采集→解析
    SPSCQueue<ParsedFramePtr, 8> parsedQueue_;  // 解析→处理
    SPSCQueue<DisplayFramePtr, 4> displayQueue_;// 处理→显示

    std::thread parseThread_;
    std::thread processThread_;
    // 采集在SDK回调线程，显示在UI主线程
};
```

这样四个环节可以并行执行——当处理线程在处理第 N 帧时，采集线程已经在接收第 N+2 帧。

**第二步：零拷贝设计**

- SDK buffer 通过 shared_ptr 直接传递，不做深拷贝
- 内存池预分配 20 帧 buffer（约 12MB），运行时不再 malloc
- 帧数据用引用计数管理生命周期

```cpp
FramePool pool_(FRAME_SIZE, 20);  // 预分配20帧

void onRawFrame(uint8_t* sdkBuffer, size_t len) {
    auto frame = std::make_shared<Frame>();
    frame->data = sdkBuffer;  // 直接用SDK buffer
    frame->releaseFunc = [sdkBuffer]() { SDK_ReleaseBuffer(sdkBuffer); };
    rawQueue_.push(frame);
}
```

**第三步：控频显示——UI 只渲染最新帧**

```cpp
void DisplayManager::refresh() {  // 30Hz定时器
    if (frameUpdated_.exchange(false)) {
        displayWidget_->setFrame(latestFrame_);
        displayWidget_->update();
    }
}
```

处理线程产出帧后，只保留最新帧到显示队列，旧帧丢弃。采集 25fps 显示 30Hz，不丢帧。

**第四步：批量处理与降级策略**

- 处理线程一次取多帧批量操作，减少原子操作和线程切换
- 系统负载高时自动降级：降低分辨率（2x 降采样）或降低帧率（25fps→15fps）

**结果（Result）：**

| 配置 | FPS | 吞吐量 | CPU 占用 |
|------|-----|--------|---------|
| 优化前 | 18 | 10.5MB/s | 85% |
| +流水线+零拷贝 | 25 | 15MB/s | 70% |
| +控频显示 | 30 | 18MB/s | 50% |

最终稳定处理 25fps × 600KB = 15MB/s 红外数据流，CPU 50% 左右还有余量，端到端延迟 80-100ms，丢帧率 < 0.1%。

## 深入原理

### 瓶颈定位方法

分段埋时间戳，逐环节测量耗时：
1. 采集回调到入队：5ms
2. 解析：2ms
3. 处理（颜色映射等）：50ms ← 主要瓶颈
4. UI 刷新：100ms ← 第二瓶颈

处理瓶颈通过 SIMD 优化颜色映射（8 像素并行），从 3000μs 降到 400μs。UI 瓶颈通过控频刷新解决。

### 延迟 vs 吞吐量的权衡

- 增加队列深度 → 吞吐量↑，延迟↑
- 减少队列深度 → 延迟↓，可能丢帧

我们的选择：采集队列 8 帧（保证不丢帧）、显示队列 2 帧（保证实时性）。对电力检测场景，100ms 延迟可接受，丢帧不可接受。

### 内存占用分析

每帧 600KB × 流水线 3 个队列 × 每个 8 帧深度 = 最坏 14.4MB。实际用内存池预分配 20 帧 = 12MB。对 1-2GB 的 ARM 平台完全可接受，且运行时零碎片。

## 面试表达建议

**开头给数据：** "15MB/s 主要来自红外模块——640×480 分辨率 × 16bit × 25fps。处理的关键是流水线并行加零拷贝。"

**中间讲架构：** "把串行的四个环节拆成四个线程并行，用无锁队列解耦。采集不等处理，处理不等显示，各干各的。数据通过 shared_ptr 传递不拷贝，内存池预分配避免运行时 malloc。"

**如果被问'数据量再大 10 倍怎么办'：** "150MB/s 就需要硬件方案了——FPGA 做前端处理、GPU 加速、DMA 直接传输。软件层面可以降采样、压缩传输。我们当前 ARM 平台 15MB/s 是合理上限。"
