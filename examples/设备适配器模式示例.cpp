/**
 * 设备适配器模式（Adapter Pattern）
 *
 * 面试关联：简历中"设计设备适配器模式，统一管理多种RS485设备"、
 *          "支持15+种不同硬件设备的即插即用"
 *
 * 核心思路：
 * - 定义统一的设备接口（IDevice）
 * - 为每种设备编写适配器，将其私有协议转换为统一接口
 * - 设备管理器通过接口操作设备，不关心具体协议细节
 * - 新增设备只需要新增适配器，不修改已有代码（开闭原则）
 *
 * 编译：g++ -std=c++17 -O2 设备适配器模式示例.cpp -o adapter_demo
 */

#include <iostream>
#include <string>
#include <memory>
#include <vector>
#include <unordered_map>
#include <functional>

// ============================================================
// 1. 统一设备接口
// ============================================================

/// 设备状态
enum class DeviceStatus { Offline, Online, Error };

/// 统一设备接口：所有设备适配器必须实现
class IDevice {
public:
    virtual ~IDevice() = default;

    virtual bool open() = 0;
    virtual void close() = 0;
    virtual DeviceStatus status() const = 0;

    /// 发送指令并获取响应
    virtual std::string sendCommand(const std::string& cmd) = 0;

    /// 设备名称（用于日志和管理）
    virtual std::string name() const = 0;
};

// ============================================================
// 2. 具体设备（模拟真实硬件SDK）
// ============================================================

/// 模拟：温度传感器（Modbus RTU 协议）
class ModbusTemperatureSensor {
public:
    bool connect(int addr) {
        addr_ = addr;
        connected_ = true;
        std::cout << "  [Modbus] 连接从站 " << addr << std::endl;
        return true;
    }

    void disconnect() {
        connected_ = false;
        std::cout << "  [Modbus] 断开从站 " << addr_ << std::endl;
    }

    // Modbus 原始读取：功能码03，寄存器地址，数量
    uint16_t readRegister(uint16_t regAddr) {
        // 模拟返回温度值（实际是发送 Modbus RTU 帧）
        return 2350;  // 代表 23.50°C
    }

    bool isConnected() const { return connected_; }

private:
    int addr_ = 0;
    bool connected_ = false;
};

/// 模拟：MQTT 环境监测设备
class MqttEnvironmentMonitor {
public:
    bool subscribe(const std::string& topic) {
        topic_ = topic;
        subscribed_ = true;
        std::cout << "  [MQTT] 订阅 " << topic << std::endl;
        return true;
    }

    void unsubscribe() {
        subscribed_ = false;
        std::cout << "  [MQTT] 取消订阅 " << topic_ << std::endl;
    }

    // MQTT 消息格式（JSON）
    std::string getLatestMessage() {
        return R"({"humidity": 65.2, "pm25": 35})";
    }

    bool isSubscribed() const { return subscribed_; }

private:
    std::string topic_;
    bool subscribed_ = false;
};

// ============================================================
// 3. 适配器：将具体设备适配为统一接口
// ============================================================

/// Modbus 温度传感器适配器
class ModbusTempAdapter : public IDevice {
public:
    explicit ModbusTempAdapter(int slaveAddr)
        : slaveAddr_(slaveAddr) {}

    bool open() override {
        return sensor_.connect(slaveAddr_);
    }

    void close() override {
        sensor_.disconnect();
    }

    DeviceStatus status() const override {
        return sensor_.isConnected() ? DeviceStatus::Online
                                     : DeviceStatus::Offline;
    }

    std::string sendCommand(const std::string& cmd) override {
        if (cmd == "read_temp") {
            uint16_t raw = sensor_.readRegister(0x0001);
            double temp = raw / 100.0;
            return "温度: " + std::to_string(temp) + "°C";
        }
        return "未知指令: " + cmd;
    }

    std::string name() const override {
        return "Modbus温度传感器(从站" + std::to_string(slaveAddr_) + ")";
    }

private:
    ModbusTemperatureSensor sensor_;
    int slaveAddr_;
};

/// MQTT 环境监测适配器
class MqttEnvAdapter : public IDevice {
public:
    explicit MqttEnvAdapter(const std::string& topic)
        : topic_(topic) {}

    bool open() override {
        return monitor_.subscribe(topic_);
    }

    void close() override {
        monitor_.unsubscribe();
    }

    DeviceStatus status() const override {
        return monitor_.isSubscribed() ? DeviceStatus::Online
                                       : DeviceStatus::Offline;
    }

    std::string sendCommand(const std::string& cmd) override {
        if (cmd == "read_env") {
            return "环境数据: " + monitor_.getLatestMessage();
        }
        return "未知指令: " + cmd;
    }

    std::string name() const override {
        return "MQTT环境监测(" + topic_ + ")";
    }

private:
    MqttEnvironmentMonitor monitor_;
    std::string topic_;
};

// ============================================================
// 4. 设备管理器（不依赖具体设备类型）
// ============================================================

class DeviceManager {
public:
    /// 注册设备
    void addDevice(const std::string& id, std::unique_ptr<IDevice> device) {
        devices_[id] = std::move(device);
    }

    /// 连接所有设备
    void connectAll() {
        std::cout << "\n--- 连接所有设备 ---" << std::endl;
        for (auto& [id, dev] : devices_) {
            std::cout << "连接 [" << id << "] " << dev->name() << std::endl;
            if (!dev->open()) {
                std::cout << "  连接失败!" << std::endl;
            }
        }
    }

    /// 查询所有设备状态
    void printStatus() {
        std::cout << "\n--- 设备状态 ---" << std::endl;
        for (auto& [id, dev] : devices_) {
            const char* statusStr =
                dev->status() == DeviceStatus::Online  ? "在线" :
                dev->status() == DeviceStatus::Offline ? "离线" : "异常";
            std::cout << "[" << id << "] " << dev->name()
                      << " → " << statusStr << std::endl;
        }
    }

    /// 向指定设备发送命令
    std::string sendTo(const std::string& id, const std::string& cmd) {
        auto it = devices_.find(id);
        if (it == devices_.end()) return "设备不存在: " + id;
        return it->second->sendCommand(cmd);
    }

    /// 断开所有设备
    void disconnectAll() {
        std::cout << "\n--- 断开所有设备 ---" << std::endl;
        for (auto& [id, dev] : devices_) {
            std::cout << "断开 [" << id << "] " << dev->name() << std::endl;
            dev->close();
        }
    }

private:
    std::unordered_map<std::string, std::unique_ptr<IDevice>> devices_;
};

// ============================================================
// 5. 演示
// ============================================================

int main() {
    DeviceManager mgr;

    // 注册不同类型的设备 —— 管理器不关心具体协议
    mgr.addDevice("temp_01", std::make_unique<ModbusTempAdapter>(1));
    mgr.addDevice("temp_02", std::make_unique<ModbusTempAdapter>(2));
    mgr.addDevice("env_hall", std::make_unique<MqttEnvAdapter>("building/hall/env"));

    // 统一操作
    mgr.connectAll();
    mgr.printStatus();

    // 统一发送指令
    std::cout << "\n--- 读取数据 ---" << std::endl;
    std::cout << mgr.sendTo("temp_01", "read_temp") << std::endl;
    std::cout << mgr.sendTo("temp_02", "read_temp") << std::endl;
    std::cout << mgr.sendTo("env_hall", "read_env") << std::endl;

    mgr.disconnectAll();

    std::cout << "\n=== 适配器模式优势 ===" << std::endl;
    std::cout << "1. 新增设备只需编写适配器，不修改管理器代码" << std::endl;
    std::cout << "2. 设备管理器通过统一接口操作，代码简洁" << std::endl;
    std::cout << "3. 隔离了具体协议（Modbus/MQTT/...），易于测试和维护" << std::endl;

    return 0;
}
