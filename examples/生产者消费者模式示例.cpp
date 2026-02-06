/**
 * 生产者-消费者模式（线程安全队列）
 *
 * 面试关联：简历中"采用生产者-消费者模式解耦数据采集与UI刷新"
 *
 * 核心原理：
 * - 使用 std::mutex + std::condition_variable 实现线程同步
 * - 有界队列防止内存无限增长
 * - 支持优雅关闭（stop 标志）
 *
 * 适用场景：多生产者多消费者（MPMC），需要同步保证
 * 与SPSC无锁队列的区别：
 * - SPSC：单生产者单消费者，无锁，延迟低
 * - 本方案：多对多，有锁，更通用
 *
 * 编译：g++ -std=c++17 -O2 -pthread 生产者消费者模式示例.cpp -o pc_demo
 */

#include <queue>
#include <mutex>
#include <condition_variable>
#include <thread>
#include <vector>
#include <iostream>
#include <chrono>
#include <atomic>
#include <functional>
#include <optional>

template <typename T>
class BoundedBlockingQueue {
public:
    explicit BoundedBlockingQueue(size_t maxSize)
        : maxSize_(maxSize), stopped_(false) {}

    // 禁止拷贝
    BoundedBlockingQueue(const BoundedBlockingQueue&) = delete;
    BoundedBlockingQueue& operator=(const BoundedBlockingQueue&) = delete;

    /// 入队（阻塞等待直到有空间或被停止）
    /// @return true 成功入队，false 队列已停止
    bool push(const T& item) {
        std::unique_lock<std::mutex> lock(mutex_);

        // 等待条件：队列未满 或 已停止
        notFull_.wait(lock, [this]() {
            return queue_.size() < maxSize_ || stopped_;
        });

        if (stopped_) return false;

        queue_.push(item);
        notEmpty_.notify_one();  // 通知消费者
        return true;
    }

    /// 出队（阻塞等待直到有数据或被停止）
    /// @return 数据（有值）或 nullopt（队列已停止且为空）
    std::optional<T> pop() {
        std::unique_lock<std::mutex> lock(mutex_);

        // 等待条件：队列非空 或 已停止
        notEmpty_.wait(lock, [this]() {
            return !queue_.empty() || stopped_;
        });

        if (queue_.empty()) return std::nullopt;

        T item = queue_.front();
        queue_.pop();
        notFull_.notify_one();  // 通知生产者
        return item;
    }

    /// 带超时的出队
    std::optional<T> tryPopFor(std::chrono::milliseconds timeout) {
        std::unique_lock<std::mutex> lock(mutex_);

        if (!notEmpty_.wait_for(lock, timeout, [this]() {
            return !queue_.empty() || stopped_;
        })) {
            return std::nullopt;  // 超时
        }

        if (queue_.empty()) return std::nullopt;

        T item = queue_.front();
        queue_.pop();
        notFull_.notify_one();
        return item;
    }

    /// 停止队列（唤醒所有等待线程）
    void stop() {
        {
            std::lock_guard<std::mutex> lock(mutex_);
            stopped_ = true;
        }
        notEmpty_.notify_all();
        notFull_.notify_all();
    }

    size_t size() const {
        std::lock_guard<std::mutex> lock(mutex_);
        return queue_.size();
    }

    bool empty() const {
        std::lock_guard<std::mutex> lock(mutex_);
        return queue_.empty();
    }

private:
    mutable std::mutex mutex_;
    std::condition_variable notEmpty_;
    std::condition_variable notFull_;
    std::queue<T> queue_;
    size_t maxSize_;
    bool stopped_;
};

// ---- 演示：模拟数据采集→处理流水线 ----

struct DetectionData {
    int sensorId;
    double reading;
    int sequence;
};

int main() {
    constexpr size_t QUEUE_CAPACITY = 64;
    constexpr int TOTAL_SAMPLES = 1000;
    constexpr int NUM_PRODUCERS = 3;  // 3个传感器（采集线程）
    constexpr int NUM_CONSUMERS = 2;  // 2个处理线程

    BoundedBlockingQueue<DetectionData> dataQueue(QUEUE_CAPACITY);
    std::atomic<int> totalProduced{0};
    std::atomic<int> totalConsumed{0};

    auto start = std::chrono::high_resolution_clock::now();

    // 启动生产者（模拟多传感器采集）
    std::vector<std::thread> producers;
    for (int id = 0; id < NUM_PRODUCERS; ++id) {
        producers.emplace_back([&, id]() {
            int count = TOTAL_SAMPLES / NUM_PRODUCERS;
            for (int i = 0; i < count; ++i) {
                DetectionData data{id, i * 0.5 + id, totalProduced.load()};
                if (!dataQueue.push(data)) {
                    break;  // 队列已停止
                }
                totalProduced.fetch_add(1);

                // 模拟采集间隔
                std::this_thread::sleep_for(std::chrono::microseconds(10));
            }
        });
    }

    // 启动消费者（模拟数据处理）
    std::vector<std::thread> consumers;
    for (int id = 0; id < NUM_CONSUMERS; ++id) {
        consumers.emplace_back([&, id]() {
            while (true) {
                auto data = dataQueue.tryPopFor(std::chrono::milliseconds(100));
                if (!data.has_value()) {
                    // 超时或队列已停止，检查是否所有数据已处理
                    if (totalConsumed.load() >= TOTAL_SAMPLES / NUM_PRODUCERS * NUM_PRODUCERS) {
                        break;
                    }
                    continue;
                }
                totalConsumed.fetch_add(1);
                // 模拟处理耗时
                std::this_thread::sleep_for(std::chrono::microseconds(5));
            }
        });
    }

    // 等待生产者完成
    for (auto& t : producers) t.join();

    // 等待消费者处理完剩余数据后停止
    for (auto& t : consumers) t.join();
    dataQueue.stop();

    auto end = std::chrono::high_resolution_clock::now();
    auto duration = std::chrono::duration_cast<std::chrono::milliseconds>(end - start);

    std::cout << "=== 生产者-消费者模式演示 ===" << std::endl;
    std::cout << "生产者数量: " << NUM_PRODUCERS << std::endl;
    std::cout << "消费者数量: " << NUM_CONSUMERS << std::endl;
    std::cout << "队列容量: " << QUEUE_CAPACITY << std::endl;
    std::cout << "生产总量: " << totalProduced.load() << std::endl;
    std::cout << "消费总量: " << totalConsumed.load() << std::endl;
    std::cout << "耗时: " << duration.count() << " ms" << std::endl;
    std::cout << "队列剩余: " << dataQueue.size() << std::endl;

    return 0;
}
