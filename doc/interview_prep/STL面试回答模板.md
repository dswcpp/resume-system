# STL 面试回答模板（可直接背、可灵活裁剪）

## 一、一个总开场：STL 使用原则（先抛框架）

> 面试官问：你平时 STL 用得多吗？常用哪些容器？怎么选？

平时我用 STL 的习惯是：
- 能用 `std::vector` 就用 `std::vector`，需要关联容器时再考虑 `std::map` / `std::unordered_map`，真正需要频繁在中间插入/删除、又必须保持迭代器稳定，才会考虑 `std::list`。
- 在 Qt 项目里，我会根据场景在 `std::vector` 和 `QVector`、`std::map` 和 `QMap` 之间做选择，核心考虑是：底层结构、时间复杂度和内存局部性，以及和 Qt 其他组件的兼容性。

## 二、vector / list + QVector / QList

### 1）std::vector vs std::list（核心回答）

> 面试官问：vector 和 list 有什么区别？什么时候用 list？

从底层实现看：
- `std::vector` 是动态数组，内存连续，随机访问是 O(1)，在尾部 `push_back` 很高效；在中间插入/删除需要移动后面的元素，时间复杂度是 O(n)。
- `std::list` 是双向链表，每个节点分散在堆上，插入和删除某个位置本身是 O(1)，但是为了找到这个位置通常要遍历，整体还是 O(n)，而且因为链表不连续，对 CPU cache 不友好。

所以大部分情况下我优先选 `std::vector`，原因是：
1. 内存连续，对 cache 友好，遍历性能很好。
2. 很多算法可以用 `memcpy` / SIMD 等手段优化。
3. 即使在中间插入/删除，只要数据量不是特别夸张，整体性能通常也比 list 好。

只有在必须频繁在中间插入/删除，而且又需要稳定迭代器/引用时，才会考虑用 `std::list`，但这种场景在实际项目里其实并不多。

### 2）QVector / QList 简短带一下

在 Qt 里：
- `QVector` 本质上和 `std::vector` 类似，也是连续内存，非常适合和 C 接口、底层 buffer 打交道。
- `QList` 在 Qt5 里底层是“数组 + 间接指针”，在小对象场景下会多一次指针跳转，不一定比 `QVector` 快；Qt6 之后 `QList` 已经基本等同于 `QVector`。

所以在新项目里，习惯是优先用 `QVector` 或 `std::vector`，避免滥用 `QList`。

### 3）项目里怎么举例（可直接使用）

在带电检测终端里，我采集到的一帧波形数据用 `std::vector<float>` 或 `QVector<float>` 存，因为：
- 需要频繁做 FFT、滤波运算，连续内存可以直接传给底层算法库；
- 遍历访问非常多，而中间插入几乎没有。

曾经使用 `QList<float>`，在大量数据点情况下性能明显差一些，统一换成 `QVector` 后，整条处理链路的 CPU 占用有明显下降。

## 三、map / QMap vs unordered_map

### 1）std::map vs std::unordered_map（重点）

> 面试官问：map 和 unordered_map 有什么区别？怎么选？

- `std::map` 底层一般是红黑树，是有序关联容器，key 有序；查找、插入、删除都是 O(log n)，支持有序遍历、`lower_bound`。
- `std::unordered_map` 底层是哈希表，是无序容器；平均查找、插入、删除是 O(1)，最坏 O(n)；不能有序遍历，但大数据量下查找通常更好。

选择习惯：
- 需要有序遍历 / 范围查询（如按 key 顺序导出配置）用 `std::map` / `QMap`。
- 只是频繁查找、不关心顺序，用 `std::unordered_map` 做字典，并注意 `reserve` 预留 bucket，减少 rehash。

### 2）QMap 简要说明

`QMap` 底层也是平衡树，语义更接近 `std::map`；和 Qt 的信号槽、序列化、`QVariant` 配合更顺畅，涉及 Qt 生态时可优先用 `QMap`。

### 3）项目例子（柜外/营业厅/检测终端）

在柜外交互终端里，用 `std::unordered_map<std::string, DeviceHandler>` 管理设备 ID 到处理对象的映射，因为：
- 设备 ID 查找非常频繁，但不关心遍历顺序；
- 哈希表查找接近 O(1)，比 `std::map` 更合适。

而在配置管理场景，比如按 key 排序展示，使用 `std::map` 或 `QMap`，直接利用其有序性遍历输出。

## 四、常见考点：迭代器失效（一定要带一句）

在实际使用 STL 容器时，需要注意迭代器失效问题：
- `std::vector` 扩容时，之前所有迭代器、指针、引用都会失效；中间插入/删除也会让后面元素的迭代器失效。
- `std::list` 在插入、删除其他元素时，已有元素的迭代器稳定，这是其优势之一。
- `std::map` / `std::unordered_map` 在插入/删除时有各自的迭代器/引用失效规则，需查文档或谨慎使用。

实践习惯：容器操作（特别是插入/删除）后，尽量不要复用之前保存的迭代器/引用，而是用新的 `begin()` / `find()` 重新获取，或把生命周期控制在小范围内，避免踩坑。

可用技巧：
- 不在遍历过程中直接删除当前元素，而用 `erase(it++)` 模式；
- 或先记录 key，遍历结束后统一删除。

## 五、综合回答（一段话直接说）

平时 STL 用得比较多，整体原则是：能用 `std::vector` 就用 `std::vector`，关联容器用 `std::map` / `std::unordered_map`，只有在需要稳定迭代器且频繁中间插入的特殊场景才考虑 `std::list`。`std::vector` 底层是动态数组，内存连续，适合大量遍历和算法运算，随机访问 O(1)、尾部插入高效；缺点是中间插入/删除要移动元素。`std::list` 是双向链表，插入/删除当前节点 O(1)，但因为节点分散、cache 友好度差、定位也要遍历，所以并不常用。在 Qt 里，`QVector` 类似 `std::vector`，处理波形数据、FFT 等场景我都用 `QVector<float>`；`QList` 在 Qt5 的很多场景性能不如 `QVector`，新代码倾向于用 `QVector`。关联容器方面，`std::map` / `QMap` 有序、O(log n)，适合有序遍历/范围查询；`std::unordered_map` 是哈希表，平均 O(1) 查找，适合字典型映射，如设备 ID 到处理对象。实际项目里，在带电检测终端一帧采样数据用 `QVector<float>` 存储便于算法运算；在柜外交互终端中管理多个设备/会话用 `std::unordered_map<std::string, Session>` 做映射。另会注意不同容器的迭代器失效规则，例如在 `std::vector` 中扩容或中间插入后旧迭代器会失效，遍历删元素时用 `erase(it++)` 或先记录 key 再统一删除，避免问题。