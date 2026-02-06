# Mark点定位算法是怎么做的？精度怎么保证达到±0.05mm？

## 知识点速览

- **Mark点**是PCB板上的定位基准标记，通常为圆形铜箔图案，用于确定板的位置和角度
- 定位流程：图像采集 → 预处理 → 模板匹配 → 亚像素坐标提取 → 坐标变换
- Halcon的**Shape-Based Matching**可实现亚像素精度的模板匹配（精度~0.02像素）
- **仿射变换**用至少3对点（图像坐标↔物理坐标）建立映射，消除旋转、平移、缩放
- 精度影响因素：相机分辨率、镜头畸变、光照稳定性、匹配算法精度
- ±0.05mm精度 ≈ 1-2像素偏差（取决于视场和分辨率），亚像素匹配可以达到

## 我的实战经历

**项目背景：** PCB激光打标系统中，激光头需要在PCB板上的指定位置打印序列号和二维码。每块板上贴有2-3个Mark点，视觉系统通过识别Mark点确定板的精确位置和角度，然后计算出打标坐标。精度要求±0.05mm。

**遇到的挑战：**
1. PCB板在传送带上的位置和角度每次都不一样，需要实时定位
2. Mark点周围可能有其他铜箔图案干扰
3. 光照条件在产线上会有波动
4. ±0.05mm的精度要求非常高，接近硬件极限

**完整的定位流程实现：**

```cpp
class MarkPointLocator {
public:
    // 初始化：创建模板
    void createTemplate(const HObject& templateImage) {
        // 提取Mark点ROI
        HObject modelRegion;
        threshold(templateImage, &modelRegion, 0, 128);
        reduce_domain(templateImage, modelRegion, &m_modelImage);

        // 创建形状模板
        // 参数：角度范围±22°，自动金字塔层数
        create_shape_model(m_modelImage,
            "auto",           // 金字塔层数
            HTuple(-0.39),    // 起始角度 -22°
            HTuple(0.39),     // 终止角度 +22°
            "auto",           // 角度步长
            "auto",           // 优化
            "use_polarity",   // 使用极性（明暗方向）
            "auto",           // 对比度
            "auto",           // 最小对比度
            &m_modelID);
    }

    // 定位：在采集图像中搜索Mark点
    struct MarkResult {
        double row, col;    // 亚像素坐标
        double angle;       // 旋转角度
        double score;       // 匹配得分
    };

    MarkResult locate(const HObject& image) {
        HTuple row, col, angle, score;
        find_shape_model(image, m_modelID,
            HTuple(-0.39), HTuple(0.39),  // 搜索角度范围
            0.7,          // 最小匹配分数
            1,            // 最多找1个
            0.5,          // 最大重叠
            "least_squares",  // 亚像素精度方法
            0, 0.9,
            &row, &col, &angle, &score);

        return {row.D(), col.D(), angle.D(), score.D()};
    }

    // 多Mark点仿射变换
    void computeTransform(
        const std::vector<MarkResult>& imagePoints,
        const std::vector<Point2D>& physicalPoints)
    {
        HTuple imgRow, imgCol, phyX, phyY;
        for (size_t i = 0; i < imagePoints.size(); ++i) {
            imgRow.Append(imagePoints[i].row);
            imgCol.Append(imagePoints[i].col);
            phyX.Append(physicalPoints[i].x);
            phyY.Append(physicalPoints[i].y);
        }
        // 建立仿射变换矩阵
        vector_to_hom_mat2d(imgRow, imgCol, phyX, phyY, &m_homMat);
    }

    // 图像坐标 → 物理坐标
    Point2D transformToPhysical(double imgRow, double imgCol) {
        HTuple phyX, phyY;
        affine_trans_point_2d(m_homMat, imgRow, imgCol, &phyX, &phyY);
        return {phyX.D(), phyY.D()};
    }
};
```

**精度保证的具体措施：**

1. **硬件层面**：选用500万像素工业相机，视场150mm×100mm，单像素对应0.03mm，理论精度裕度充足
2. **匹配算法**：`find_shape_model`的`"least_squares"`参数启用最小二乘亚像素精化，精度达0.02像素≈0.0006mm
3. **多点定位**：用3个Mark点建立仿射变换，过定义系统通过最小二乘求解，抗噪声能力强于2点
4. **标定消畸变**：离线标定消除镜头径向畸变，避免图像边缘处精度下降

**结果：** 实际精度达到±0.03mm，优于±0.05mm的指标要求。定位耗时约30ms，满足产线节拍。

## 深入原理

### Shape-Based Matching原理

Halcon的Shape-Based Matching不依赖灰度值，而是基于**边缘方向梯度**：

```
1. 模板创建阶段：
   模板图像 → 边缘提取 → 计算每个边缘点的梯度方向
   → 存储为 (x, y, direction) 向量集

2. 搜索阶段（金字塔加速）：
   顶层（粗分辨率）→ 快速定位候选区域
   ↓
   中间层 → 精化候选位置
   ↓
   底层（原始分辨率）→ 亚像素精化

3. 匹配评分：
   score = Σ cos(θ_template - θ_image) / N
   θ = 边缘梯度方向
```

基于梯度方向而非灰度值的优势：对光照强度变化不敏感，只要边缘方向一致就能匹配。

### 亚像素精度的实现

`find_shape_model`返回的坐标是浮点数，亚像素精度通过以下方法实现：

```
整像素定位后，在最佳匹配位置的邻域内：

  得分
   ^
   |    *
   |   * *
   |  *   *
   | *     *
   +--+--+--→ 位置
   -1  0  +1

通过抛物线拟合三个点的得分值：
  score(x) = ax² + bx + c
  极值点 x_sub = -b/(2a)  ← 这就是亚像素偏移量
```

Halcon的`"least_squares"`模式使用更精确的最小二乘优化代替简单的抛物线拟合。

### 仿射变换数学

仿射变换矩阵（2D）：

```
[X]   [a11  a12  tx] [u]
[Y] = [a21  a22  ty] [v]
[1]   [ 0    0    1] [1]

其中 (u,v)=图像坐标，(X,Y)=物理坐标
6个未知数，需要至少3对点（6个方程）
```

3个Mark点正好提供6个方程求解6个参数，超过3个点则用最小二乘拟合提高鲁棒性。

### 精度预算分析

```
误差来源分解：
  像素量化误差:    ±0.5px → 亚像素匹配后 ±0.02px = ±0.0006mm
  镜头畸变误差:    标定后残差 ±0.01mm
  仿射变换拟合误差: 3点最小二乘 ±0.005mm
  机械振动误差:    ±0.01mm
  温度漂移:       ±0.005mm
  ─────────────────────────────────
  总误差(RSS):     √(0.0006² + 0.01² + 0.005² + 0.01² + 0.005²)
                  ≈ ±0.016mm  << ±0.05mm ✓
```

RSS（Root Sum of Squares）合成后总误差远小于0.05mm，精度裕度充足。

## 面试表达建议

**开头：** "Mark点定位的流程分五步：采集图像、预处理、模板匹配、亚像素坐标提取、仿射变换到物理坐标。核心是Halcon的Shape-Based Matching，基于边缘梯度方向做匹配，不受光照变化影响。"

**精度部分：** "±0.05mm的精度通过几个层面保证：硬件上选500万像素相机使单像素对应0.03mm；算法上用Halcon亚像素匹配精度达0.02像素；3个Mark点仿射变换用最小二乘拟合提高鲁棒性；再加上相机标定消除镜头畸变。误差预算合成下来总误差约±0.016mm，裕度充足。"

**收尾：** "实际产线上达到了±0.03mm的精度，定位耗时30ms，完全满足产线节拍要求。"
