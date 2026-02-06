# UI刷新频率控制（控频刷新）

## 知识点速览
- 数据采集频率（kHz~MHz级）远高于显示需求（30~60fps）
- 不控频的后果：UI线程过载、界面卡顿、用户操作无响应
- 控频核心思想：数据和渲染解耦，定时器驱动UI刷新
- 关键指标：帧率、延迟、CPU占用

## 我的实战经历
T95项目中TEV检测模块的波形显示最初非常卡顿：
- 采集线程以1MHz速率产生数据，每包数据到达时都通过信号槽触发UI更新
- 结果UI线程被paintEvent淹没，延迟高达200ms，点击按钮都无响应
- 优化方案：
  1. 去掉数据到达时的直接信号连接
  2. 加入QTimer每33ms触发一次刷新（约30fps）
  3. 刷新时从共享缓冲区取最新数据快照，中间的数据不处理
  4. 引入dirty标记，数据没变化时跳过刷新
- 优化效果：延迟200ms→50ms，CPU占用降低40%，界面操作流畅

## 深入原理

### 为什么不能每包数据都刷新
```
采集频率: 1,000,000 次/秒
paintEvent: 每次约 5-10ms
UI线程吞吐量: 最多 100-200 次/秒
结论: 1MHz数据 >> 200fps上限，UI线程必然过载
```

### 控频刷新架构
```
┌──────────┐     SPSC队列     ┌──────────┐    共享缓冲    ┌──────────┐
│ 采集线程  │ ──────────────→ │ 处理线程  │ ────────────→ │ UI线程   │
│ (1MHz)   │                 │          │   dirty=true   │ QTimer   │
└──────────┘                 └──────────┘                │ (33ms)   │
                                                         │ 检查dirty │
                                                         │ 取快照    │
                                                         │ update() │
                                                         └──────────┘
```

### 实现要点

#### 1. 定时器驱动
```cpp
// UI类构造函数中
auto* timer = new QTimer(this);
connect(timer, &QTimer::timeout, this, &WaveformWidget::onRefresh);
timer->start(33); // 约30fps

void WaveformWidget::onRefresh() {
    if (!dirty_.exchange(false)) return; // 无新数据则跳过
    auto snapshot = sharedBuffer_.getSnapshot(); // 取最新快照
    updateChart(snapshot);
}
```

#### 2. 脏标记机制
```cpp
std::atomic<bool> dirty_{false};
// 数据线程中：
void onDataReady(const DataPacket& pkt) {
    sharedBuffer_.update(pkt);
    dirty_.store(true, std::memory_order_release);
}
```

#### 3. 数据快照（避免读写冲突）
- 双缓冲：写线程写buffer A，UI读buffer B，刷新时交换
- 或者加轻量锁：只在快照拷贝时短暂加锁

### 帧率选择依据
| 应用场景 | 推荐帧率 | 理由 |
|---------|---------|------|
| 波形实时显示 | 30fps | 人眼足够，降低CPU负载 |
| 动画/平滑曲线 | 60fps | 视觉流畅度要求高 |
| 数值/表格刷新 | 10fps | 数字变化太快反而看不清 |
| 告警闪烁 | 2-5fps | 吸引注意力即可 |

## 面试表达建议
这是一个很好的性能优化故事，按"问题→分析→方案→效果"讲述：UI卡顿是因为数据频率远高于显示需求，通过控频+脏标记+快照解耦数据和渲染，延迟从200ms降到50ms。数据说话，面试官印象深刻。
