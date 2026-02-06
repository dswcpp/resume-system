# Qt Model/View架构的核心概念？如何实现自定义模型？

## 知识点速览

Qt的Model/View架构是经典MVC模式的变体，将**数据管理(Model)**、**数据展示(View)**、**数据编辑(Delegate)** 三者分离。

```mermaid
flowchart LR
    M[Model-数据+访问接口] <-->|QModelIndex| V[View-布局+展示]
    V <-->|编辑交互| D[Delegate-渲染+编辑器]
    D <-->|setData/data| M
```

**自定义Model必须实现的接口：**

| 函数 | 用途 |
|------|------|
| `rowCount()` | 返回行数 |
| `columnCount()` | 返回列数 |
| `data(index, role)` | 根据索引和角色返回数据 |
| `setData()` | 可编辑时实现 |
| `flags()` | 返回Qt::ItemIsEditable等标志 |

## 我的实战经历

**项目背景：** 在南京华乘电气T95带电检测手持终端中，主界面有一张**设备数据表**，展示当前连接的所有检测设备的实时状态（设备名、检测类型、信号强度、告警级别等）。数据每秒更新多次，设备数量可达十几台。

**遇到的问题：** 初版用`QTableWidget`直接操作单元格——每收到一帧数据就遍历所有行找对应设备，然后`setItem()`更新。问题有二：
1. **性能差**：每秒几十次数据更新，每次setItem都触发View重绘，表格肉眼可见地卡顿闪烁
2. **耦合重**：数据处理逻辑和UI代码混在一起，加一列字段要改好几处代码

**分析与解决：** 我把设备数据表重构为自定义`QAbstractTableModel`：

```cpp
class DeviceDataModel : public QAbstractTableModel {
    Q_OBJECT
public:
    int rowCount(const QModelIndex& parent = {}) const override {
        return m_devices.size();
    }
    int columnCount(const QModelIndex& parent = {}) const override {
        return Column::COUNT;
    }
    QVariant data(const QModelIndex& index, int role) const override {
        if (role == Qt::DisplayRole) {
            const auto& dev = m_devices[index.row()];
            switch (index.column()) {
                case Column::Name:   return dev.name;
                case Column::Type:   return dev.typeName();
                case Column::Signal: return dev.signalStrength;
                case Column::Alarm:  return dev.alarmLevelText();
                case Column::Status: return dev.statusText();
            }
        }
        if (role == Qt::ForegroundRole && index.column() == Column::Alarm)
            return alarmColor(m_devices[index.row()].alarmLevel);
        return {};
    }
public slots:
    void updateDeviceData(const QList<DeviceInfo>& newData);
private:
    QList<DeviceInfo> m_devices;
    int m_dirtyRowMin = INT_MAX;
    int m_dirtyRowMax = -1;
};
```

关键优化是**批量更新通知**——累积变更范围，用定时器50ms触发一次批量通知：

```cpp
void DeviceDataModel::updateDeviceData(const QList<DeviceInfo>& newData) {
    for (int i = 0; i < newData.size(); ++i) {
        if (i < m_devices.size() && m_devices[i] != newData[i]) {
            m_devices[i] = newData[i];
            m_dirtyRowMin = qMin(m_dirtyRowMin, i);
            m_dirtyRowMax = qMax(m_dirtyRowMax, i);
        }
    }
}

void DeviceDataModel::flushChanges() {
    if (m_dirtyRowMax >= 0) {
        emit dataChanged(index(m_dirtyRowMin, 0),
                         index(m_dirtyRowMax, Column::COUNT - 1));
        m_dirtyRowMin = INT_MAX;
        m_dirtyRowMax = -1;
    }
}
```

**结果：** 重构后表格不再卡顿闪烁，CPU占用从15%降到3%。后来加新列只需在Model中加一个enum值和data()分支，View零改动。还额外得到了排序和过滤能力——只需设置`QSortFilterProxyModel`。

## 深入原理

### data()的role机制

| Role | 用途 | 返回类型 |
|------|------|---------|
| DisplayRole | 显示文本 | QString |
| EditRole | 编辑时的值 | 任意QVariant |
| DecorationRole | 图标 | QIcon/QPixmap |
| ForegroundRole | 文字颜色 | QBrush/QColor |
| BackgroundRole | 背景色 | QBrush/QColor |
| ToolTipRole | 悬浮提示 | QString |
| UserRole | 自定义数据 | 任意 |

### 代理模型(Proxy Model)

```cpp
QSortFilterProxyModel* proxy = new QSortFilterProxyModel(this);
proxy->setSourceModel(deviceModel);
proxy->setFilterKeyColumn(Column::Type);
proxy->setFilterFixedString("TEV");
tableView->setModel(proxy);  // View看到过滤后的数据
```

### 数据变更通知

| 变化类型 | 通知方式 |
|---------|---------|
| 已有行数据变化 | `emit dataChanged(topLeft, bottomRight)` |
| 插入新行 | `beginInsertRows()` → 插入 → `endInsertRows()` |
| 删除行 | `beginRemoveRows()` → 删除 → `endRemoveRows()` |
| 大规模重置 | `beginResetModel()` → 重置 → `endResetModel()` |

### 常见陷阱

1. **忘记begin/end配对**：insertRows没有配对调用会导致View崩溃
2. **在begin/end之外修改数据**：Model内部数据和通知不同步
3. **dataChanged范围错误**：范围太大导致不必要的重绘
4. **存储QModelIndex**：QModelIndex是临时的，存储后可能失效

## 面试表达建议

**开头：** "Qt Model/View是MVC的变体，核心是把数据管理和展示分离。Model通过QModelIndex提供数据，View负责展示，Delegate处理渲染和编辑。"

**重点展开：** 用T95设备数据表的故事——从QTableWidget直接操作导致卡顿闪烁，到自定义Model加批量dataChanged通知，CPU从15%降到3%。

**收尾：** "Model/View最大的好处是数据和展示的彻底解耦。我们后来加了好几列新字段，View完全不用改。通过累积变更、一次性发dataChanged的优化技巧，即使高频数据更新也很流畅。"