# PRPS图谱是什么？怎么生成的？用来做什么？

## 知识点速览

- **PRPS**（Phase-Resolved Pulse Sequence）= 相位分辨脉冲序列图谱
- 以工频周期（50Hz, 20ms）为时间基准，将放电脉冲映射到相位-幅值平面
- X轴为相位（0°~360°），Y轴为脉冲幅值，颜色/密度表示脉冲出现频次
- 不同放电类型在PRPS图谱上呈现不同的分布模式，可用于**放电类型识别**
- 需要工频同步信号（过零点检测）来确定相位基准
- 累积多个工频周期的数据（通常50~100个周期）提高统计置信度
- 与PRPD（Phase-Resolved Partial Discharge）概念类似，但PRPS侧重脉冲序列的时序特征

## 我的实战经历

**项目背景：** T95带电检测手持终端需要对高压开关柜中的局部放电进行检测和诊断。PRPS图谱是放电模式识别的核心工具，我负责PRPS图谱生成算法的实现。

**遇到的问题：** PRPS图谱生成面临几个技术挑战：
1. 工频同步：需要精确获取50Hz工频的相位基准，手持终端没有直接的工频接入
2. 实时性：脉冲数据量大，需要在嵌入式平台上实时累积和渲染
3. 数据管理：多周期的脉冲数据需要高效存储和滚动更新

**分析与解决：**

工频同步方案：通过TEV传感器的信号中提取50Hz工频成分，用过零点检测算法确定相位基准。

数据结构设计：使用环形缓冲区存储最近N个周期的脉冲数据，每个新周期的数据加入时自动覆盖最旧的周期。

```cpp
// PRPS图谱数据结构
struct PulseEvent {
    double phase;      // 0~360°
    double amplitude;  // 脉冲幅值 (mV)
    uint32_t cycleNum; // 所属工频周期编号
};

class PRPSGenerator {
public:
    PRPSGenerator(int accumulateCycles = 50, int phaseBins = 360)
        : m_accCycles(accumulateCycles)
        , m_phaseBins(phaseBins)
    {
        // 环形缓冲区存储脉冲事件
        m_pulseBuffer.setCapacity(accumulateCycles * MAX_PULSES_PER_CYCLE);
        // PRPS网格：相位bin × 幅值bin
        m_prpsGrid.resize(phaseBins, std::vector<int>(AMPLITUDE_BINS, 0));
    }

    // 收到过零点信号，开始新周期
    void onZeroCrossing(uint64_t timestamp) {
        m_currentCycleStart = timestamp;
        m_currentCycleNum++;
        // 清除过期周期的数据
        pruneOldCycles();
    }

    // 收到一个脉冲事件
    void addPulse(uint64_t timestamp, double amplitude) {
        double elapsed = timestamp - m_currentCycleStart;
        double phase = (elapsed / CYCLE_PERIOD_US) * 360.0;
        m_pulseBuffer.push({phase, amplitude, m_currentCycleNum});
        updateGrid(phase, amplitude);
    }

    // 生成PRPS图谱数据供渲染
    const Grid2D& getPRPSGrid() const { return m_prpsGrid; }

private:
    static constexpr double CYCLE_PERIOD_US = 20000.0; // 20ms = 50Hz
    RingBuffer<PulseEvent> m_pulseBuffer;
    Grid2D m_prpsGrid;
};
```

**结果：** PRPS图谱生成算法稳定运行，累积50个周期的图谱在200ms内完成更新和渲染。图谱清晰地展示了不同放电类型的模式差异，现场工程师可以据此快速判断放电类型和严重程度。

## 深入原理

### 放电类型与PRPS模式

不同类型的局部放电在PRPS图谱上呈现特征性的分布模式：

```
内部放电 (Internal PD):          表面放电 (Surface PD):
  ^amplitude                       ^amplitude
  |   ••                           |  •••••
  |  •••• ••••                     | •••••••
  | •••••••••••                    |••••••••••
  +--+----+----+--→ phase          +--+----+----+--→ phase
   0°  90° 180° 270° 360°          0°  90° 180° 270° 360°
   (集中在90°和270°附近)            (分布范围更宽)

电晕放电 (Corona PD):
  ^amplitude
  |•
  |••
  |•••
  +--+----+----+--→ phase
   0°  90° 180° 270° 360°
   (集中在某一半周期)
```

- **内部放电**：脉冲集中在工频电压的上升沿和下降沿附近（90°和270°附近），正负半周对称分布
- **表面放电**：分布范围较宽，正负半周可能不对称
- **电晕放电**：通常集中在某一个半周期（正半周或负半周），与电极极性相关

### 工频同步的实现

```cpp
// 过零点检测算法
class ZeroCrossDetector {
public:
    // 输入工频参考信号的采样值
    bool detect(double sample) {
        bool crossing = false;
        // 检测正向过零（从负到正）
        if (m_prevSample < 0 && sample >= 0) {
            crossing = true;
            // 线性插值精确计算过零时刻
            m_zeroCrossTime = m_prevTime +
                (m_currentTime - m_prevTime) *
                (-m_prevSample) / (sample - m_prevSample);
        }
        m_prevSample = sample;
        m_prevTime = m_currentTime;
        m_currentTime += m_sampleInterval;
        return crossing;
    }

private:
    double m_prevSample = 0;
    double m_prevTime = 0;
    double m_currentTime = 0;
    double m_sampleInterval;
    double m_zeroCrossTime = 0;
};
```

过零点检测用线性插值获取亚采样点精度的过零时刻，减少相位计算误差。实际T95终端中TEV传感器的信号中含有50Hz工频分量，通过带通滤波器提取后用于同步。

### 环形缓冲区的选择

PRPS需要持续累积和滚动更新数据，环形缓冲区的优势：
- **固定内存**：不会因为长时间运行导致内存增长
- **O(1)插入和删除**：新周期数据直接覆盖最旧数据
- **缓存友好**：连续内存布局

### PRPS与PRPD的区别

| 特性 | PRPS | PRPD |
|------|------|------|
| 全称 | Phase-Resolved Pulse Sequence | Phase-Resolved Partial Discharge |
| 侧重点 | 脉冲序列时序关系 | 放电统计分布 |
| 时间信息 | 保留脉冲间的时序 | 统计分布，不保留时序 |
| 数据量 | 较大（保留每个脉冲） | 较小（只保留分布） |
| 用途 | 详细分析、深度诊断 | 快速分类、概览 |

## 面试表达建议

**开头：** "PRPS是Phase-Resolved Pulse Sequence的缩写，即相位分辨脉冲序列图谱。它以工频50Hz为时间基准，把每个放电脉冲的发生相位和幅值画在二维图上，累积多个周期就能看到放电的模式。"

**项目关联：** "在T95终端的局放检测中，我实现了PRPS图谱生成算法。核心是工频同步——通过TEV传感器信号提取50Hz过零点作为相位基准；然后用环形缓冲区累积50个工频周期的脉冲数据，生成图谱。"

**展开用途：** "PRPS图谱的价值在于放电类型识别。内部放电的脉冲集中在90°和270°附近，表面放电的分布更宽，电晕放电通常只出现在一个半周期。现场工程师看图谱就能快速判断放电类型和严重程度。"

**收尾：** "实现上的关键优化是环形缓冲区保证固定内存和O(1)操作，50个周期的图谱更新在200ms内完成。"
