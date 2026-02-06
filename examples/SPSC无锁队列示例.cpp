/**
 * SPSC (Single Producer Single Consumer) 无锁队列
 *
 * 面试关联：简历中"采用SPSC无锁队列降低线程同步开销，UI刷新延迟从200ms降至50ms"
 *
 * 核心原理：
 * - 单生产者单消费者场景下，不需要互斥锁
 * - 使用原子变量 + memory_order 保证线程安全
 * - 环形缓冲区避免动态内存分配
 *
 * 编译：g++ -std=c++17 -O2 -pthread SPSC无锁队列示例.cpp -o spsc_demo
 */

#include <atomic>
#include <array>
#include <thread>
#include <iostream>
#include <chrono>
#include <cassert>

template <typename T, size_t Capacity>
class SPSCQueue {
    static_assert((Capacity & (Capacity - 1)) == 0,
                  "Capacity must be a power of 2");

public:
    SPSCQueue() : head_(0), tail_(0) {}

    // 禁止拷贝
    SPSCQueue(const SPSCQueue&) = delete;
    SPSCQueue& operator=(const SPSCQueue&) = delete;

    /// 生产者调用：尝试入队
    /// @return true 成功，false 队列已满
    bool push(const T& item) {
        const size_t head = head_.load(std::memory_order_relaxed);
        const size_t next = (head + 1) & (Capacity - 1);

        // 队列满判断：下一个写入位置 == 消费者读取位置
        if (next == tail_.load(std::memory_order_acquire)) {
            return false;  // 队列满
        }

        buffer_[head] = item;

        // release 保证 buffer_ 的写入对消费者可见
        head_.store(next, std::memory_order_release);
        return true;
    }

    /// 消费者调用：尝试出队
    /// @return true 成功，false 队列为空
    bool pop(T& item) {
        const size_t tail = tail_.load(std::memory_order_relaxed);

        // 队列空判断：消费者位置 == 生产者位置
        if (tail == head_.load(std::memory_order_acquire)) {
            return false;  // 队列空
        }

        item = buffer_[tail];

        // release 保证消费完成后生产者才能覆盖该位置
        tail_.store((tail + 1) & (Capacity - 1), std::memory_order_release);
        return true;
    }

    /// 当前队列中的元素数量（近似值）
    size_t size() const {
        const size_t head = head_.load(std::memory_order_relaxed);
        const size_t tail = tail_.load(std::memory_order_relaxed);
        return (head - tail) & (Capacity - 1);
    }

    bool empty() const {
        return head_.load(std::memory_order_relaxed)
            == tail_.load(std::memory_order_relaxed);
    }

private:
    // 缓存行对齐，避免 false sharing
    alignas(64) std::atomic<size_t> head_;
    alignas(64) std::atomic<size_t> tail_;
    std::array<T, Capacity> buffer_;
};

// ---- 演示 ----

struct SensorData {
    int channel;
    double value;
    uint64_t timestamp;
};

int main() {
    constexpr size_t QUEUE_SIZE = 1024;  // 必须是2的幂
    constexpr int TOTAL_ITEMS = 100000;

    SPSCQueue<SensorData, QUEUE_SIZE> queue;

    auto start = std::chrono::high_resolution_clock::now();

    // 生产者线程：模拟数据采集
    std::thread producer([&]() {
        for (int i = 0; i < TOTAL_ITEMS; ++i) {
            SensorData data{i % 4, i * 0.1, static_cast<uint64_t>(i)};

            // 自旋等待直到入队成功（实际项目中可加 yield 或退避策略）
            while (!queue.push(data)) {
                std::this_thread::yield();
            }
        }
    });

    // 消费者线程：模拟数据处理/UI刷新
    int received = 0;
    std::thread consumer([&]() {
        SensorData data;
        while (received < TOTAL_ITEMS) {
            if (queue.pop(data)) {
                received++;
                // 模拟处理（实际项目中这里是UI更新或数据存储）
            } else {
                std::this_thread::yield();
            }
        }
    });

    producer.join();
    consumer.join();

    auto end = std::chrono::high_resolution_clock::now();
    auto duration = std::chrono::duration_cast<std::chrono::microseconds>(end - start);

    std::cout << "=== SPSC 无锁队列性能测试 ===" << std::endl;
    std::cout << "传输数据量: " << TOTAL_ITEMS << " 条" << std::endl;
    std::cout << "耗时: " << duration.count() << " us" << std::endl;
    std::cout << "吞吐量: " << (TOTAL_ITEMS * 1000000.0 / duration.count())
              << " 条/秒" << std::endl;
    std::cout << "队列剩余: " << queue.size() << std::endl;

    assert(received == TOTAL_ITEMS);
    std::cout << "全部数据正确接收" << std::endl;

    return 0;
}
