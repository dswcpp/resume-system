# 线程池设计与任务调度策略

## 知识点速览
- 线程池 = 预创建线程 + 任务队列 + 同步机制
- 解决的问题：避免频繁创建/销毁线程的开销，控制并发度
- 核心组件：工作线程数组、线程安全任务队列、条件变量、停止标志
- 调度策略：FIFO、优先级、工作窃取

## 我的实战经历
在T95项目中，多个检测模块（TEV、局放、超声波）需要并行处理数据：
- 使用线程池管理数据处理任务，线程数设为CPU核心数（RK3399是6核）
- 每个检测通道的数据处理作为独立任务提交到线程池
- 任务提交使用std::future获取返回值，方便异步获取处理结果
- 优雅关闭：析构时设置stop标志，notify_all唤醒所有等待线程，join等待完成

## 深入原理

### 线程池生命周期
```
构造阶段：创建N个工作线程，全部在cv.wait()上等待
运行阶段：
  提交任务 → 加锁入队 → cv.notify_one() → 某线程被唤醒 → 取任务执行
关闭阶段：
  设置stop_=true → cv.notify_all() → 所有线程退出循环 → join()等待结束
```

### 完整实现要点
```cpp
template<class F, class... Args>
auto submit(F&& f, Args&&... args) -> std::future<decltype(f(args...))> {
    using RetType = decltype(f(args...));
    auto task = std::make_shared<std::packaged_task<RetType()>>(
        std::bind(std::forward<F>(f), std::forward<Args>(args)...)
    );
    std::future<RetType> result = task->get_future();
    {
        std::unique_lock lock(mtx_);
        if (stop_) throw std::runtime_error("submit on stopped pool");
        tasks_.emplace([task]() { (*task)(); });
    }
    cv_.notify_one();
    return result;
}
```

### 调度策略对比
| 策略 | 实现方式 | 适用场景 | 缺点 |
|------|---------|---------|------|
| FIFO | std::queue | 通用场景，任务优先级相同 | 无法处理紧急任务 |
| 优先级 | priority_queue | 任务有紧急程度区分 | 低优先级可能饿死 |
| 工作窃取 | 每线程一个deque | 任务粒度不均匀 | 实现复杂 |
| 分组 | 多个队列按类型 | 不同类型任务隔离 | 负载可能不均 |

### 线程数选择
- **CPU密集型**：线程数 = CPU核心数（或核心数+1）
- **I/O密集型**：线程数 = CPU核心数 × (1 + I/O等待时间/计算时间)
- **混合型**：分两个池，CPU密集和I/O密集分开

### 需要注意的坑
1. **条件变量虚假唤醒**：wait必须用谓词版本（lambda判断条件）
2. **任务异常**：task()抛异常不能让工作线程挂掉，要catch
3. **死锁风险**：任务中不能再submit并wait结果（递归提交）
4. **关闭顺序**：必须先设stop再notify，最后join

## 面试表达建议
先说线程池的组成（三要素：线程数组、任务队列、同步机制），再写一个简化版代码展示核心逻辑，然后说调度策略的选择依据，最后结合项目经验说线程数怎么定的。如果面试官追问，可以聊工作窃取或者任务异常处理。
