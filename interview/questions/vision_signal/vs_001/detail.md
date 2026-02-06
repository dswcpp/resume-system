# FFT频谱分析的原理？在你的项目里怎么用的？

## 知识点速览

- **FFT（快速傅里叶变换）** 是DFT（离散傅里叶变换）的高效算法，复杂度从O(N²)降到O(N log N)
- 时域信号通过FFT变换为频域信号，揭示各频率分量的幅值和相位
- **采样定理（Nyquist）**：采样率必须 ≥ 2×信号最高频率，否则发生混叠
- **频率分辨率** = 采样率 / FFT点数，点数越多分辨率越高
- **窗函数**（汉宁窗、海明窗、布莱克曼窗）用于减少有限长信号截断带来的频谱泄漏
- FFT结果是对称的（实信号），只需取前半部分（N/2+1个点）
- 幅值谱需要归一化：除以FFT点数N，直流分量除以N，其余除以N/2

## 我的实战经历

**项目背景：** 在T95带电检测手持终端项目中，UHF（超高频）局部放电检测模块需要对传感器采集到的时域信号进行频谱分析，以识别不同类型的放电信号特征。

**遇到的问题：** UHF传感器采集到的原始信号是时域波形，里面混杂了局部放电信号、背景噪声和干扰信号。直接看时域波形很难区分放电类型。不同类型的局部放电（如内部放电、表面放电、电晕放电）在频域上有明显不同的频率特征，所以需要FFT将信号转到频域分析。

**分析与解决：**

我负责实现UHF信号的频谱分析管线：

```cpp
// 简化的FFT频谱分析流程
class SpectrumAnalyzer {
public:
    SpectrumAnalyzer(int fftSize = 4096, double sampleRate = 1e9)
        : m_fftSize(fftSize), m_sampleRate(sampleRate)
    {
        // 预计算汉宁窗系数
        m_window.resize(fftSize);
        for (int i = 0; i < fftSize; ++i) {
            m_window[i] = 0.5 * (1.0 - cos(2.0 * M_PI * i / (fftSize - 1)));
        }
        // 从内存池分配FFT缓冲区
        m_fftIn = m_memPool.allocate<double>(fftSize);
        m_fftOut = m_memPool.allocate<complex<double>>(fftSize / 2 + 1);
    }

    void analyze(const double* signal, int length) {
        // 1. 加窗
        for (int i = 0; i < m_fftSize; ++i)
            m_fftIn[i] = signal[i] * m_window[i];

        // 2. 执行FFT
        fft_execute(m_fftIn, m_fftOut, m_fftSize);

        // 3. 计算幅值谱
        for (int i = 0; i <= m_fftSize / 2; ++i) {
            double magnitude = std::abs(m_fftOut[i]) * 2.0 / m_fftSize;
            double frequency = i * m_sampleRate / m_fftSize;
            m_spectrum[i] = {frequency, magnitude};
        }
    }

private:
    int m_fftSize;
    double m_sampleRate;
    std::vector<double> m_window;
    MemoryPool m_memPool;  // 自定义内存池
};
```

关键设计决策：
1. **FFT点数选4096**：UHF信号采样率1GHz，4096点给出约244kHz的频率分辨率，足以区分不同放电类型
2. **预计算窗函数**：窗系数在构造时一次性计算，避免每帧重复计算三角函数
3. **内存池管理缓冲区**：FFT输入输出缓冲区从内存池分配，避免实时处理中频繁malloc/free

**结果：** 频谱分析模块能实时处理UHF信号（处理延迟<5ms），提取的频率特征成功用于放电类型分类，检测准确率达到90%以上。

## 深入原理

### DFT到FFT的加速

DFT的定义：

$$X[k] = \sum_{n=0}^{N-1} x[n] \cdot e^{-j2\pi kn/N}, \quad k = 0, 1, ..., N-1$$

直接计算DFT需要O(N²)次复数乘法。FFT利用**蝶形运算**（Butterfly Operation）的对称性，将N点DFT分解为两个N/2点DFT，递归下去复杂度降到O(N log N)。

```
N=8的FFT蝶形运算结构：

x[0] ──┬──○──┬──○──┬──○── X[0]
x[4] ──┘  ╲  │  ╲  │  ╲
x[2] ──┬──○──┘  ○──┘  ○── X[1]
x[6] ──┘  ╲     ╲     ╲
x[1] ──┬──○──┬──○──┬──○── X[2]
x[5] ──┘  ╲  │  ╲  │  ...
x[3] ──┬──○──┘  ○──┘
x[7] ──┘

Stage 1    Stage 2    Stage 3
(N/2对)    (N/2对)    (N/2对)
```

### 窗函数选择

| 窗函数 | 主瓣宽度 | 旁瓣衰减 | 适用场景 |
|-------|---------|---------|---------|
| 矩形窗 | 最窄 | -13dB | 频率分辨率优先 |
| 汉宁窗 | 中等 | -31dB | 通用，平衡选择 |
| 海明窗 | 中等 | -42dB | 需要较好旁瓣抑制 |
| 布莱克曼窗 | 较宽 | -58dB | 旁瓣抑制优先 |

T95项目选用**汉宁窗**，因为它在频率分辨率和旁瓣抑制之间取得了较好平衡，适合UHF信号中多种频率成分共存的情况。

### 频谱泄漏与零填充

- **频谱泄漏**：有限长信号截断相当于乘以矩形窗，频域表现为sinc函数的旁瓣扩散。加窗可以降低旁瓣，代价是主瓣变宽。
- **零填充**：在信号末尾补零增加FFT点数，不增加频率分辨率（由信号实际时长决定），但可以使频谱曲线更平滑，便于观察峰值位置。

### 实时FFT的性能优化

```cpp
// 优化策略
// 1. FFT点数选2的幂，利用基2 FFT算法
constexpr int FFT_SIZE = 4096;  // 2^12

// 2. 使用FFTW库或Intel MKL的优化实现
// FFTW会根据硬件自动选择最优算法

// 3. 重叠保留法处理连续信号流
// 每次移动50%窗长，既保证连续性又不遗漏信号
void processStream(const double* stream, int totalLength) {
    int hopSize = FFT_SIZE / 2;  // 50%重叠
    for (int offset = 0; offset + FFT_SIZE <= totalLength; offset += hopSize) {
        analyze(stream + offset, FFT_SIZE);
    }
}
```

## 面试表达建议

**开头：** "FFT是把时域信号变换到频域的算法，能看出信号里包含哪些频率成分。它是DFT的快速版本，复杂度从O(N²)降到O(N log N)。"

**项目关联：** "在T95项目中，UHF局放检测模块需要对传感器信号做频谱分析。不同类型的局部放电在频域特征不同，通过FFT提取频率特征可以辅助判断放电类型。"

**技术细节（追问时展开）：** "实现上有几个关键点：一是选合适的窗函数减少频谱泄漏，我们用的汉宁窗；二是FFT点数选2的幂方便蝶形运算加速；三是预计算窗系数和用内存池管理缓冲区来保证实时性能。"

**收尾：** "频谱分析模块处理延迟控制在5ms以内，提取的特征用于放电类型识别准确率超过90%。"
