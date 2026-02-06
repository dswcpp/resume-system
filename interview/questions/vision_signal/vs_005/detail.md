# 相机标定和坐标系转换怎么做？图像坐标怎么映射到物理坐标？

## 知识点速览

- **相机标定**的目的是求解相机的内参（焦距、主点、畸变系数）和外参（旋转、平移）
- **内参**描述相机自身光学特性，标定一次即可，换镜头/调焦距需重新标定
- **外参**描述相机与世界坐标系的相对位置关系，相机移动后需重新求解
- **畸变类型**：径向畸变（桶形/枕形）和切向畸变（镜头与传感器不平行）
- 标定板常用棋盘格（角点检测方便）或圆点阵列（圆心定位精度更高）
- **仿射变换**适用于2D平面映射（3对点，6参数）
- **透视变换**适用于有视角变化的场景（4对点，8参数）
- Halcon的标定精度通常优于OpenCV，尤其在工业测量场景

## 我的实战经历

**项目背景：** PCB激光打标系统中，工业相机俯拍PCB板面，视觉系统需要把识别到的Mark点图像坐标精确转换为PCB板上的物理坐标，再传给运动控制系统驱动激光头到目标位置。

**标定方案设计：**

分为两个阶段：离线标定（求内参）和在线映射（求外参/仿射变换）。

**阶段一：离线相机标定**

```cpp
// Halcon标定流程
void CameraCalibrator::calibrate() {
    // 1. 准备标定板描述
    HTuple calPlateDescr = "caltab_30mm.descr";  // 标定板描述文件

    // 2. 创建标定数据模型
    HTuple calDataID;
    create_calib_data("calibration_object", 1, 1, &calDataID);

    // 设置相机初始参数（近似值）
    HTuple startParam;
    // 面阵相机，焦距16mm，像元尺寸3.45μm，分辨率2592×1944
    set_calib_data_cam_param(calDataID, 0, "area_scan_division",
        startParam);
    set_calib_data_calib_object(calDataID, 0, calPlateDescr);

    // 3. 多角度拍摄标定板（15-20张）
    for (int i = 0; i < m_calImages.size(); ++i) {
        // 提取标定板角点
        HTuple row, col, index, pose;
        find_calib_object(m_calImages[i], calDataID, 0, 0, i,
                         "caltab", "default");
        // 获取角点坐标并添加到标定数据
        get_calib_data_observ_points(calDataID, 0, 0, i,
                                    &row, &col, &index, &pose);
        set_calib_data_observ_points(calDataID, 0, 0, i,
                                    row, col, index, pose);
    }

    // 4. 执行标定，求解内参
    HTuple error;
    calibrate_cameras(calDataID, &error);
    // error = 重投影误差，通常 < 0.3 像素为合格

    // 5. 获取标定结果
    get_calib_data(calDataID, "camera", 0, "params", &m_camParams);
}
```

**阶段二：在线坐标映射**

每块PCB板到位后，通过Mark点建立当前板的图像坐标到物理坐标的映射：

```cpp
// 在线仿射变换
void OnlineMapper::computeMapping(
    const std::vector<MarkResult>& marks,    // 图像中检测到的Mark点
    const std::vector<Point2D>& pcbMarks)    // PCB设计文件中Mark点的物理坐标
{
    // 先用内参做畸变校正
    HTuple correctedRow, correctedCol;
    for (auto& m : marks) {
        HTuple cr, cc;
        // 去畸变：图像坐标 → 理想无畸变坐标
        change_radial_distortion_cam_par("fixed",
            m_camParams, 0, &m_undistortParams);
    }

    // 3个Mark点建立仿射变换
    HTuple imgRow, imgCol, phyX, phyY;
    for (size_t i = 0; i < marks.size(); ++i) {
        imgRow.Append(marks[i].row);
        imgCol.Append(marks[i].col);
        phyX.Append(pcbMarks[i].x);
        phyY.Append(pcbMarks[i].y);
    }
    vector_to_hom_mat2d(imgRow, imgCol, phyX, phyY, &m_homMat);
}

// 任意图像点 → 物理坐标
Point2D OnlineMapper::toPhysical(double imgRow, double imgCol) {
    HTuple px, py;
    affine_trans_point_2d(m_homMat, imgRow, imgCol, &px, &py);
    return {px.D(), py.D()};
}
```

**结果：** 标定重投影误差0.15像素，在线映射精度±0.03mm，优于±0.05mm指标。

## 深入原理

### 相机成像模型

```
世界坐标 (Xw, Yw, Zw)
    ↓ [R|t] 外参（旋转+平移）
相机坐标 (Xc, Yc, Zc)
    ↓ 透视投影 (f/Zc)
归一化坐标 (x, y) = (Xc/Zc, Yc/Zc)
    ↓ 畸变模型
畸变坐标 (x_d, y_d)
    ↓ 内参矩阵 K
像素坐标 (u, v)
```

内参矩阵K：

```
K = [fx   0  cx]
    [ 0  fy  cy]
    [ 0   0   1]

fx, fy = 焦距（像素单位）= f / pixel_size
cx, cy = 主点坐标（通常接近图像中心）
```

### 畸变模型

**径向畸变**（最常见）：
```
x_corrected = x(1 + k1*r² + k2*r⁴ + k3*r⁶)
y_corrected = y(1 + k1*r² + k2*r⁴ + k3*r⁶)
其中 r² = x² + y²

k1 > 0: 枕形畸变（图像边缘向外弯）
k1 < 0: 桶形畸变（图像边缘向内弯）
```

**切向畸变**（镜头与传感器不严格平行）：
```
x_corrected = x + 2*p1*x*y + p2*(r² + 2*x²)
y_corrected = y + p1*(r² + 2*y²) + 2*p2*x*y
```

工业场景中径向畸变是主要误差源，切向畸变通常较小但精密测量时不能忽略。

### 仿射变换 vs 透视变换

```
仿射变换（6参数，3对点）：
  [X]   [a11 a12 tx] [u]
  [Y] = [a21 a22 ty] [v]
  [1]   [ 0   0   1] [1]
  保持平行线平行，适用于相机正对平面的情况

透视变换（8参数，4对点）：
  [X']   [h11 h12 h13] [u]
  [Y'] = [h21 h22 h23] [v]
  [w ]   [h31 h32  1 ] [1]
  X = X'/w, Y = Y'/w
  平行线可以不再平行，适用于有视角的情况
```

PCB打标系统中相机正对板面安装，仿射变换足够。如果相机有倾斜角度则需要透视变换。

### 标定质量评估

标定质量通过**重投影误差**评估：
1. 用标定得到的参数将3D标定点投影回图像平面
2. 计算投影坐标与实际检测坐标的距离
3. 重投影误差 < 0.3像素通常认为合格

```
重投影误差过大的排查：
  > 1.0px: 标定板可能不平整，或角点检测错误
  0.5~1.0px: 标定图像角度覆盖不够，或图像质量差
  0.3~0.5px: 基本合格，可尝试增加标定图像改善
  < 0.3px: 合格
  < 0.1px: 过拟合风险，检查标定点是否太少
```

## 面试表达建议

**开头：** "相机标定分两步：先离线标定求内参——用标定板在不同位置拍15-20张照片，求解焦距、主点和畸变系数；然后在线运行时通过Mark点建立当前图像到物理坐标的仿射映射。"

**核心概念：** "内参描述相机光学特性，标定一次就行；畸变校正消除镜头带来的形变，尤其是边缘处的径向畸变；仿射变换通过已知坐标的Mark点建立图像到物理的映射关系。"

**项目结合：** "在PCB打标项目中，我用Halcon的calibrate_cameras做离线标定，重投影误差控制在0.15像素。在线阶段每块板通过3个Mark点的仿射变换定位，精度达到±0.03mm。"

**收尾：** "关键是标定板要涵盖足够多角度、标定图像质量要好、Mark点数量多于最低要求以提高鲁棒性。"
