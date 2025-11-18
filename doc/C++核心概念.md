# C++核心概念技术笔记

## 目录
1. [C++语言基础](#c语言基础)
2. [面向对象编程](#面向对象编程)
3. [C++11/14/17新特性](#c111417新特性)
4. [内存管理](#内存管理)
5. [STL库使用与原理](#stl库使用与原理)
6. [多线程与并发](#多线程与并发)

---

## C++语言基础

### 数据类型与类型转换
- 基本数据类型、自定义类型
- 隐式转换与显式转换
- `static_cast`、`dynamic_cast`、`const_cast`、`reinterpret_cast`的区别与使用场景

### 函数高级特性
- 函数重载与参数匹配规则
- 默认参数与陷阱
- 内联函数优化
- 函数指针与函数对象

### 预处理器与宏定义
- 条件编译技术
- 宏定义的优缺点
- 宏与内联函数的选择

## 面向对象编程

### 类与对象
- 封装、继承、多态的实现机制
- 构造函数、析构函数、拷贝构造、移动语义
- 虚函数表与动态绑定原理

### 继承与组合
- 公有继承、保护继承、私有继承的区别
- 虚继承解决菱形继承问题
- 组合优于继承原则

### 多态与虚函数
- 纯虚函数与抽象类
- 运行时多态与编译时多态
- 虚析构函数的必要性
- override与final关键字

## C++11/14/17新特性

### 现代C++语法
- auto与decltype类型推导
- 范围for循环
- 统一初始化列表
- 委托构造函数

### 智能指针
- `shared_ptr`实现原理与使用
- `unique_ptr`的独占所有权
- `weak_ptr`解决循环引用
- 自定义删除器

### Lambda表达式
- 捕获列表、参数列表、返回值
- 闭包与函数对象的关系
- Lambda在STL算法中的应用

### 右值引用与移动语义
- 左值与右值的区别
- std::move的实现与使用
- 完美转发std::forward
- 移动构造函数与移动赋值运算符

## 内存管理

### 内存模型
- 栈、堆、全局/静态区、常量区、代码区
- 对象生命周期管理
- RAII设计模式

### 内存分配
- new/delete与malloc/free的区别
- placement new的使用
- 内存池与自定义分配器
- 内存对齐与padding

### 内存问题排查

#### 内存泄漏检测技术

**什么是内存泄漏？**
想象你在家里用完东西后不收拾，时间长了家里就会越来越乱。内存泄漏就像这样：程序申请了内存空间（就像拿出东西使用），但用完后忘记释放（忘记收拾），导致内存越用越少，最终可能让电脑变慢甚至崩溃。

**内存泄漏的常见情况：**

1. **忘记delete**
```cpp
// 错误示例：申请了内存但忘记释放
void badFunction() {
    int* ptr = new int(42);  // 申请内存
    // 函数结束时忘记 delete ptr，内存泄漏！
}

// 正确示例：记得释放内存
void goodFunction() {
    int* ptr = new int(42);  // 申请内存
    // ... 使用ptr ...
    delete ptr;  // 释放内存
    ptr = nullptr;  // 防止野指针
}
```

2. **异常导致的泄漏**
```cpp
// 危险：如果中间抛出异常，delete不会执行
void riskyFunction() {
    int* ptr = new int(42);
    someRiskyOperation();  // 可能抛出异常
    delete ptr;  // 如果上面抛异常，这行不会执行
}

// 安全：使用智能指针自动管理
void safeFunction() {
    std::unique_ptr<int> ptr(new int(42));
    someRiskyOperation();  // 即使抛异常，ptr也会自动释放
}
```

**检测内存泄漏的方法：**

**1. 手动检查法（适合初学者）**
```cpp
// 简单的内存跟踪类
class MemoryTracker {
private:
    static int allocCount;
    static int deallocCount;

public:
    static void* allocate(size_t size) {
        allocCount++;
        std::cout << "分配内存，当前分配次数: " << allocCount << std::endl;
        return malloc(size);
    }

    static void deallocate(void* ptr) {
        deallocCount++;
        std::cout << "释放内存，当前释放次数: " << deallocCount << std::endl;
        free(ptr);
    }

    static void report() {
        std::cout << "总分配: " << allocCount
                  << ", 总释放: " << deallocCount
                  << ", 泄漏: " << (allocCount - deallocCount) << std::endl;
    }
};

int MemoryTracker::allocCount = 0;
int MemoryTracker::deallocCount = 0;
```

**2. 使用智能指针预防泄漏**
```cpp
#include <memory>

// 用智能指针替代原始指针
void modernApproach() {
    // unique_ptr：独占所有权，自动释放
    std::unique_ptr<int> ptr1 = std::make_unique<int>(42);

    // shared_ptr：共享所有权，引用计数为0时自动释放
    std::shared_ptr<int> ptr2 = std::make_shared<int>(100);

    // 不需要手动delete，作用域结束时自动释放
}
```

**3. 使用专业工具检测**

**Valgrind（Linux/Mac）：**
```bash
# 编译程序时加上调试信息
g++ -g -o myprogram myprogram.cpp

# 使用valgrind检测内存泄漏
valgrind --leak-check=full ./myprogram
```

**Visual Studio（Windows）：**
```cpp
// 在程序开头添加这些代码
#ifdef _DEBUG
#define _CRTDBG_MAP_ALLOC
#include <crtdbg.h>
#endif

int main() {
#ifdef _DEBUG
    // 程序结束时检查内存泄漏
    _CrtSetDbgFlag(_CRTDBG_ALLOC_MEM_DF | _CRTDBG_LEAK_CHECK_DF);
#endif

    // 你的程序代码...

    return 0;
}
```

**4. 自制简单的内存泄漏检测器**
```cpp
#include <map>
#include <iostream>

class SimpleLeakDetector {
private:
    static std::map<void*, size_t> allocations;

public:
    static void* allocate(size_t size, const char* file, int line) {
        void* ptr = malloc(size);
        allocations[ptr] = size;
        std::cout << "分配 " << size << " 字节在 "
                  << file << ":" << line << std::endl;
        return ptr;
    }

    static void deallocate(void* ptr, const char* file, int line) {
        auto it = allocations.find(ptr);
        if (it != allocations.end()) {
            std::cout << "释放 " << it->second << " 字节在 "
                      << file << ":" << line << std::endl;
            allocations.erase(it);
        }
        free(ptr);
    }

    static void checkLeaks() {
        if (!allocations.empty()) {
            std::cout << "发现内存泄漏！" << std::endl;
            for (const auto& pair : allocations) {
                std::cout << "泄漏地址: " << pair.first
                          << ", 大小: " << pair.second << " 字节" << std::endl;
            }
        } else {
            std::cout << "没有内存泄漏，很棒！" << std::endl;
        }
    }
};

std::map<void*, size_t> SimpleLeakDetector::allocations;

// 宏定义，方便使用
#define NEW(size) SimpleLeakDetector::allocate(size, __FILE__, __LINE__)
#define DELETE(ptr) SimpleLeakDetector::deallocate(ptr, __FILE__, __LINE__)
```

**实际使用示例：**
```cpp
int main() {
    // 测试内存泄漏检测
    int* ptr1 = (int*)NEW(sizeof(int));
    int* ptr2 = (int*)NEW(sizeof(int) * 10);

    DELETE(ptr1);  // 正确释放
    // 忘记释放ptr2，会被检测到

    SimpleLeakDetector::checkLeaks();  // 检查泄漏
    return 0;
}
```

**预防内存泄漏的最佳实践：**

1. **优先使用智能指针**：`unique_ptr`、`shared_ptr`
2. **遵循RAII原则**：资源获取即初始化
3. **成对使用new/delete**：每个new都要有对应的delete
4. **使用容器替代原始数组**：`std::vector`、`std::array`
5. **异常安全**：使用智能指针或try-catch保护

**总结：**
内存泄漏就像忘记关水龙头，时间长了会造成浪费。通过使用智能指针、专业工具检测、养成良好编程习惯，我们可以有效避免和发现内存泄漏问题。记住：每申请一块内存，就要负责释放它！

#### 野指针与悬垂引用

**什么是野指针？**
想象你有一把钥匙，但是锁已经被换了，这把钥匙就没用了，甚至可能打开错误的门。野指针就像这样：指针指向的内存已经被释放或者根本不存在，但指针还在"指着"那个位置。

**野指针的常见情况：**

1. **未初始化的指针**
```cpp
// 危险：指针没有初始化，指向随机位置
void badExample1() {
    int* ptr;  // 野指针！指向未知位置
    *ptr = 42; // 崩溃！向随机内存写入数据
}

// 安全：总是初始化指针
void goodExample1() {
    int* ptr = nullptr;  // 明确指向空
    if (ptr != nullptr) {
        *ptr = 42;  // 只有在非空时才使用
    }
}
```

2. **释放后继续使用**
```cpp
// 危险：释放内存后继续使用指针
void badExample2() {
    int* ptr = new int(42);
    delete ptr;     // 释放内存
    *ptr = 100;     // 野指针！内存已经不属于我们了
}

// 安全：释放后立即置空
void goodExample2() {
    int* ptr = new int(42);
    delete ptr;     // 释放内存
    ptr = nullptr;  // 防止野指针

    if (ptr != nullptr) {
        *ptr = 100; // 这行不会执行，安全
    }
}
```

3. **返回局部变量的地址**
```cpp
// 危险：返回局部变量的指针
int* badFunction() {
    int localVar = 42;
    return &localVar;  // 危险！局部变量在函数结束后被销毁
}

// 安全：返回动态分配的内存或使用引用
int* goodFunction() {
    int* ptr = new int(42);  // 动态分配，调用者负责释放
    return ptr;
}
```

**什么是悬垂引用？**
悬垂引用就像野指针的"兄弟"，但它是引用版本。引用必须在创建时就绑定到一个对象，但如果被引用的对象被销毁了，引用就变成了"悬垂引用"。

```cpp
// 危险：悬垂引用示例
int& getDanglingReference() {
    int localVar = 42;
    return localVar;  // 返回局部变量的引用，函数结束后变量被销毁
}

void testDanglingReference() {
    int& ref = getDanglingReference();  // 悬垂引用
    std::cout << ref << std::endl;      // 未定义行为，可能崩溃
}
```

**检测野指针的方法：**

1. **使用调试工具**
```cpp
// 在Debug模式下，很多编译器会帮助检测
#ifdef _DEBUG
    // Visual Studio会在Debug模式下填充特殊值
    // 0xCCCCCCCC表示未初始化的栈内存
    // 0xDDDDDDDD表示已释放的堆内存
#endif
```

2. **手动检查模式**
```cpp
class SafePointer {
private:
    int* ptr;
    bool isValid;

public:
    SafePointer() : ptr(nullptr), isValid(false) {}

    SafePointer(int* p) : ptr(p), isValid(p != nullptr) {}

    ~SafePointer() {
        if (isValid && ptr) {
            delete ptr;
            ptr = nullptr;
            isValid = false;
        }
    }

    int& operator*() {
        if (!isValid || ptr == nullptr) {
            throw std::runtime_error("试图使用无效指针！");
        }
        return *ptr;
    }

    void reset() {
        if (isValid && ptr) {
            delete ptr;
        }
        ptr = nullptr;
        isValid = false;
    }
};
```

**预防野指针的最佳实践：**

1. **总是初始化指针**
```cpp
int* ptr = nullptr;  // 好习惯
```

2. **释放后立即置空**
```cpp
delete ptr;
ptr = nullptr;
```

3. **使用智能指针**
```cpp
std::unique_ptr<int> smartPtr = std::make_unique<int>(42);
// 自动管理，不会产生野指针
```

4. **检查指针有效性**
```cpp
if (ptr != nullptr) {
    // 安全使用指针
    *ptr = value;
}

#### 内存破坏与越界访问

**什么是内存破坏？**
想象你在图书馆，每个人都有自己的座位和书桌。如果你把东西放到别人的桌子上，或者在别人的书上乱写，这就是"破坏"了别人的东西。内存破坏就是这样：程序错误地修改了不属于自己的内存区域。

**内存破坏的常见情况：**

1. **数组越界访问**
```cpp
// 危险：数组越界写入
void arrayOverflow() {
    int arr[5] = {1, 2, 3, 4, 5};  // 只有5个元素，索引0-4

    // 越界写入，破坏了其他内存
    arr[10] = 999;  // 危险！索引10超出了数组范围
    arr[-1] = 888;  // 危险！负索引也是越界
}

// 安全：检查数组边界
void safeArrayAccess() {
    int arr[5] = {1, 2, 3, 4, 5};
    int index = 10;

    // 检查边界
    if (index >= 0 && index < 5) {
        arr[index] = 999;  // 只有在范围内才写入
    } else {
        std::cout << "索引 " << index << " 超出数组范围！" << std::endl;
    }
}
```

2. **缓冲区溢出**
```cpp
// 危险：字符串缓冲区溢出
void bufferOverflow() {
    char buffer[10];  // 只能存储9个字符+1个结束符

    // 危险！字符串太长，会覆盖其他内存
    strcpy(buffer, "这是一个非常长的字符串，会造成缓冲区溢出");
}

// 安全：使用安全的字符串函数
void safeStringCopy() {
    char buffer[10];
    const char* source = "这是一个非常长的字符串";

    // 使用strncpy限制复制长度
    strncpy(buffer, source, sizeof(buffer) - 1);
    buffer[sizeof(buffer) - 1] = '\0';  // 确保字符串结束

    // 更好的方法：使用std::string
    std::string safeString = "任意长度的字符串都没问题";
}
```

3. **堆溢出**
```cpp
// 危险：动态分配的内存越界
void heapOverflow() {
    int* ptr = new int[5];  // 分配5个int的空间

    // 越界写入，破坏堆内存
    for (int i = 0; i < 10; i++) {  // 循环10次，但只有5个位置
        ptr[i] = i;  // 后5次写入会破坏其他内存
    }

    delete[] ptr;
}

// 安全：严格控制访问范围
void safeHeapAccess() {
    const int SIZE = 5;
    int* ptr = new int[SIZE];

    // 严格按照分配的大小访问
    for (int i = 0; i < SIZE; i++) {
        ptr[i] = i;  // 安全
    }

    delete[] ptr;
}
```

**检测内存破坏的方法：**

1. **使用边界检查容器**
```cpp
#include <vector>
#include <stdexcept>

// 自制带边界检查的数组
template<typename T, size_t N>
class SafeArray {
private:
    T data[N];

public:
    T& operator[](size_t index) {
        if (index >= N) {
            throw std::out_of_range("数组索引越界！索引: " +
                                  std::to_string(index) +
                                  ", 最大索引: " + std::to_string(N-1));
        }
        return data[index];
    }

    const T& operator[](size_t index) const {
        if (index >= N) {
            throw std::out_of_range("数组索引越界！");
        }
        return data[index];
    }

    size_t size() const { return N; }
};

// 使用示例
void testSafeArray() {
    SafeArray<int, 5> arr;

    try {
        arr[0] = 1;   // 正常
        arr[4] = 5;   // 正常
        arr[10] = 99; // 抛出异常，防止越界
    } catch (const std::out_of_range& e) {
        std::cout << "捕获到越界错误: " << e.what() << std::endl;
    }
}
```

2. **内存保护技术**
```cpp
// 在分配的内存前后添加"哨兵"值
class MemoryGuard {
private:
    static const uint32_t GUARD_VALUE = 0xDEADBEEF;

public:
    static void* allocateWithGuard(size_t size) {
        // 分配额外空间存储哨兵值
        size_t totalSize = size + 2 * sizeof(uint32_t);
        uint8_t* ptr = (uint8_t*)malloc(totalSize);

        // 在前面和后面放置哨兵值
        *(uint32_t*)ptr = GUARD_VALUE;
        *(uint32_t*)(ptr + sizeof(uint32_t) + size) = GUARD_VALUE;

        // 返回实际数据区域的指针
        return ptr + sizeof(uint32_t);
    }

    static bool checkGuard(void* userPtr, size_t size) {
        uint8_t* ptr = (uint8_t*)userPtr - sizeof(uint32_t);

        // 检查前哨兵
        if (*(uint32_t*)ptr != GUARD_VALUE) {
            std::cout << "检测到内存破坏：前哨兵被修改！" << std::endl;
            return false;
        }

        // 检查后哨兵
        if (*(uint32_t*)(ptr + sizeof(uint32_t) + size) != GUARD_VALUE) {
            std::cout << "检测到内存破坏：后哨兵被修改！" << std::endl;
            return false;
        }

        return true;
    }

    static void deallocateWithGuard(void* userPtr, size_t size) {
        if (checkGuard(userPtr, size)) {
            std::cout << "内存完整，安全释放" << std::endl;
        }

        uint8_t* ptr = (uint8_t*)userPtr - sizeof(uint32_t);
        free(ptr);
    }
};
```

**预防内存破坏的最佳实践：**

1. **使用STL容器**
```cpp
// 用vector替代原始数组
std::vector<int> vec(5);
vec.at(10);  // 会抛出异常，而不是静默破坏内存
```

2. **启用编译器检查**
```bash
# GCC/Clang编译时启用边界检查
g++ -fsanitize=address -g -o program program.cpp
```

3. **使用静态分析工具**
```cpp
// 代码中添加断言
#include <cassert>

void accessArray(int* arr, size_t size, size_t index) {
    assert(index < size);  // Debug模式下会检查
    arr[index] = 42;
}

#### Valgrind工具使用详解

**什么是Valgrind？**
Valgrind就像一个超级细心的"内存侦探"，它会监视你的程序运行，发现各种内存问题。就像有一个老师在旁边看着你做作业，发现错误就立即指出来。

**Valgrind能检测什么问题？**
1. 内存泄漏（忘记释放内存）
2. 野指针访问（使用已释放的内存）
3. 数组越界（访问超出范围的内存）
4. 未初始化变量的使用
5. 重复释放内存

**安装Valgrind：**
```bash
# Ubuntu/Debian
sudo apt-get install valgrind

# CentOS/RHEL
sudo yum install valgrind

# macOS (需要Homebrew)
brew install valgrind
```

**基本使用方法：**

1. **编译程序时加调试信息**
```bash
# 编译时必须加上-g参数，这样Valgrind能显示具体的代码行号
g++ -g -o myprogram myprogram.cpp

# 也可以关闭优化，获得更准确的结果
g++ -g -O0 -o myprogram myprogram.cpp
```

2. **基本内存检查**
```bash
# 最基本的内存检查
valgrind ./myprogram

# 详细的内存泄漏检查
valgrind --leak-check=full ./myprogram

# 显示所有可能的泄漏
valgrind --leak-check=full --show-leak-kinds=all ./myprogram
```

**实际使用示例：**

创建一个有问题的测试程序：
```cpp
// test_memory.cpp - 故意包含各种内存问题
#include <iostream>
#include <cstring>

void memoryLeak() {
    int* ptr = new int[100];  // 内存泄漏：忘记delete
    *ptr = 42;
    // 忘记 delete[] ptr;
}

void useAfterFree() {
    int* ptr = new int(42);
    delete ptr;
    *ptr = 100;  // 野指针：使用已释放的内存
}

void arrayOverflow() {
    int arr[5];
    arr[10] = 999;  // 数组越界
}

void uninitializedRead() {
    int x;
    if (x == 42) {  // 使用未初始化的变量
        std::cout << "Lucky number!" << std::endl;
    }
}

int main() {
    std::cout << "开始测试内存问题..." << std::endl;

    memoryLeak();
    useAfterFree();
    arrayOverflow();
    uninitializedRead();

    std::cout << "测试完成" << std::endl;
    return 0;
}
```

**编译和运行：**
```bash
# 编译
g++ -g -o test_memory test_memory.cpp

# 用Valgrind检查
valgrind --leak-check=full --track-origins=yes ./test_memory
```

**Valgrind输出解读：**

```
==12345== Memcheck, a memory error detector
==12345== Copyright (C) 2002-2017, and GNU GPL'd, by Julian Seward et al.
==12345== Using Valgrind-3.15.0 and LibVEX; rerun with -h for copyright info
==12345== Command: ./test_memory
==12345==

开始测试内存问题...

==12345== Invalid write of size 4
==12345==    at 0x109195: useAfterFree() (test_memory.cpp:12)
==12345==    at 0x1091E8: main (test_memory.cpp:28)
==12345== Address 0x4d2dc80 is 0 bytes inside a block of size 4 free'd
==12345==    at 0x483CA3F: operator delete(void*) (in vgpreload_memcheck-amd64-linux.so)
==12345==    at 0x109188: useAfterFree() (test_memory.cpp:11)
==12345==    at 0x1091E8: main (test_memory.cpp:28)

测试完成

==12345== HEAP SUMMARY:
==12345==     in use at exit: 400 bytes in 1 blocks
==12345==     total heap usage: 3 allocs, 2 frees, 72,704 bytes allocated
==12345==
==12345== 400 bytes in 1 blocks are definitely lost in loss record 1 of 1
==12345==    at 0x483B7F3: operator new[](unsigned long) (in vgpreload_memcheck-amd64-linux.so)
==12345==    at 0x109165: memoryLeak() (test_memory.cpp:6)
==12345==    at 0x1091E4: main (test_memory.cpp:27)
==12345==
==12345== LEAK SUMMARY:
==12345==     definitely lost: 400 bytes in 1 blocks
==12345==     indirectly lost: 0 bytes in 0 blocks
==12345==       possibly lost: 0 bytes in 0 blocks
==12345==     still reachable: 0 bytes in 0 blocks
==12345==         suppressed: 0 bytes in 0 blocks
```

**输出解读说明：**

1. **Invalid write**：检测到野指针写入
   - 在`test_memory.cpp:12`行发生错误
   - 试图写入已经释放的内存

2. **HEAP SUMMARY**：堆内存使用总结
   - `in use at exit: 400 bytes`：程序结束时还有400字节未释放
   - `total heap usage: 3 allocs, 2 frees`：总共分配3次，释放2次

3. **LEAK SUMMARY**：内存泄漏总结
   - `definitely lost: 400 bytes`：确定泄漏了400字节

**常用Valgrind选项：**

```bash
# 完整的内存检查套餐
valgrind --tool=memcheck \
         --leak-check=full \
         --show-leak-kinds=all \
         --track-origins=yes \
         --verbose \
         --log-file=valgrind_output.txt \
         ./myprogram

# 各选项说明：
# --tool=memcheck        : 使用内存检查工具（默认）
# --leak-check=full      : 详细的泄漏检查
# --show-leak-kinds=all  : 显示所有类型的泄漏
# --track-origins=yes    : 追踪未初始化值的来源
# --verbose              : 详细输出
# --log-file=filename    : 将结果保存到文件
```

**其他有用的Valgrind工具：**

1. **Cachegrind**：分析程序的缓存使用
```bash
valgrind --tool=cachegrind ./myprogram
```

2. **Callgrind**：分析函数调用和性能
```bash
valgrind --tool=callgrind ./myprogram
```

3. **Helgrind**：检测多线程程序的竞态条件
```bash
valgrind --tool=helgrind ./myprogram
```

**在代码中配合Valgrind的技巧：**

```cpp
// 添加Valgrind专用的注释
#include <valgrind/memcheck.h>

void advancedMemoryTest() {
    char* buffer = new char[100];

    // 告诉Valgrind这块内存现在是"未定义"的
    VALGRIND_MAKE_MEM_UNDEFINED(buffer, 100);

    // 标记某块内存为"不可访问"
    VALGRIND_MAKE_MEM_NOACCESS(buffer + 50, 50);

    // 使用前50字节是安全的
    buffer[0] = 'H';
    buffer[1] = 'i';

    // 访问后50字节会被Valgrind检测到
    // buffer[60] = '!';  // 这行会触发错误

    delete[] buffer;
}
```

**总结：**
Valgrind是C++程序员的好朋友，它能帮我们发现很多隐藏的内存问题。就像有一个非常仔细的老师在检查我们的作业，虽然程序运行会变慢，但能发现平时注意不到的错误。记住：在发布程序之前，用Valgrind检查一遍是个好习惯！
```
```

## STL库使用与原理

**什么是STL？**
STL（Standard Template Library）就像一个超级工具箱，里面装满了各种编程工具。就像木匠有锤子、锯子、螺丝刀一样，程序员有容器、算法、迭代器等工具。这些工具都是经过精心设计的，既好用又高效！

### 容器详解

**什么是容器？**
容器就像生活中的各种"盒子"，用来装东西。不同的盒子有不同的特点，适合装不同的东西。

#### 序列容器

**1. vector - 动态数组（像可伸缩的书架）**
```cpp
#include <vector>
#include <iostream>

void vectorExample() {
    // 创建一个空的整数vector，就像准备一个空书架
    std::vector<int> bookshelf;

    // 添加书籍（元素）
    bookshelf.push_back(1);  // 第一本书
    bookshelf.push_back(2);  // 第二本书
    bookshelf.push_back(3);  // 第三本书

    std::cout << "书架上有 " << bookshelf.size() << " 本书" << std::endl;

    // 访问特定位置的书
    std::cout << "第一本书是: " << bookshelf[0] << std::endl;
    std::cout << "最后一本书是: " << bookshelf.back() << std::endl;

    // 在中间插入一本书
    bookshelf.insert(bookshelf.begin() + 1, 99);

    // 遍历所有书籍
    std::cout << "所有书籍: ";
    for (int book : bookshelf) {
        std::cout << book << " ";
    }
    std::cout << std::endl;

    // vector的特点：
    // 优点：随机访问快（O(1)），末尾添加快
    // 缺点：中间插入慢（O(n)），需要移动后面的元素
}
```

**2. list - 双向链表（像火车车厢）**
```cpp
#include <list>

void listExample() {
    // 创建一个火车，每节车厢装一个数字
    std::list<int> train;

    // 在火车头加车厢
    train.push_front(1);  // 第一节车厢
    train.push_front(0);  // 新的火车头

    // 在火车尾加车厢
    train.push_back(2);   // 火车尾
    train.push_back(3);   // 新的火车尾

    std::cout << "火车车厢: ";
    for (int carriage : train) {
        std::cout << carriage << " ";
    }
    std::cout << std::endl;

    // 在中间插入车厢（比vector快）
    auto it = train.begin();
    ++it;  // 移动到第二个位置
    train.insert(it, 99);  // 插入新车厢

    // list的特点：
    // 优点：任意位置插入删除都很快（O(1)）
    // 缺点：不能随机访问，只能从头或尾开始遍历
}
```

**3. deque - 双端队列（像两头都能开的抽屉）**
```cpp
#include <deque>

void dequeExample() {
    // 创建一个双端抽屉
    std::deque<int> drawer;

    // 从前面放东西
    drawer.push_front(1);
    drawer.push_front(0);

    // 从后面放东西
    drawer.push_back(2);
    drawer.push_back(3);

    std::cout << "抽屉里的东西: ";
    for (int item : drawer) {
        std::cout << item << " ";
    }
    std::cout << std::endl;

    // 可以随机访问（像vector）
    std::cout << "第二个位置的东西: " << drawer[1] << std::endl;

    // deque的特点：
    // 优点：两端插入删除快，支持随机访问
    // 缺点：中间插入删除比list慢，比vector占用更多内存
}
```

#### 关联容器

**1. set - 集合（像自动排序的书柜）**
```cpp
#include <set>

void setExample() {
    // 创建一个自动排序的书柜，不允许重复的书
    std::set<int> sortedBookcase;

    // 添加书籍（自动排序，自动去重）
    sortedBookcase.insert(3);
    sortedBookcase.insert(1);
    sortedBookcase.insert(4);
    sortedBookcase.insert(1);  // 重复的，不会被添加
    sortedBookcase.insert(2);

    std::cout << "书柜里的书（自动排序）: ";
    for (int book : sortedBookcase) {
        std::cout << book << " ";  // 输出：1 2 3 4
    }
    std::cout << std::endl;

    // 查找书籍
    if (sortedBookcase.find(3) != sortedBookcase.end()) {
        std::cout << "找到了书籍3" << std::endl;
    }

    // set的特点：
    // 优点：自动排序，自动去重，查找快（O(log n)）
    // 缺点：不能修改元素值，插入比vector慢
}
```

**2. map - 映射（像字典）**
```cpp
#include <map>

void mapExample() {
    // 创建一个字典，存储学生姓名和成绩
    std::map<std::string, int> studentGrades;

    // 添加学生成绩
    studentGrades["张三"] = 85;
    studentGrades["李四"] = 92;
    studentGrades["王五"] = 78;
    studentGrades["张三"] = 88;  // 更新张三的成绩

    std::cout << "学生成绩单:" << std::endl;
    for (const auto& student : studentGrades) {
        std::cout << student.first << ": " << student.second << "分" << std::endl;
    }

    // 查找特定学生
    auto it = studentGrades.find("李四");
    if (it != studentGrades.end()) {
        std::cout << "李四的成绩是: " << it->second << "分" << std::endl;
    }

    // map的特点：
    // 优点：键值对存储，按键自动排序，查找快
    // 缺点：比unordered_map慢一些
}
```

**3. unordered_set 和 unordered_map - 哈希容器（像快速索引卡片盒）**
```cpp
#include <unordered_set>
#include <unordered_map>

void hashContainerExample() {
    // 快速查找的卡片盒
    std::unordered_set<std::string> quickFindBox;
    quickFindBox.insert("苹果");
    quickFindBox.insert("香蕉");
    quickFindBox.insert("橙子");

    // 超快速查找（平均O(1)）
    if (quickFindBox.find("苹果") != quickFindBox.end()) {
        std::cout << "找到了苹果！" << std::endl;
    }

    // 快速字典
    std::unordered_map<std::string, std::string> quickDict;
    quickDict["hello"] = "你好";
    quickDict["world"] = "世界";
    quickDict["computer"] = "计算机";

    std::cout << "hello的意思是: " << quickDict["hello"] << std::endl;

    // unordered容器的特点：
    // 优点：查找、插入、删除都很快（平均O(1)）
    // 缺点：不保证顺序，最坏情况下性能退化
}

**容器选择指南：**
- 需要随机访问 → `vector`
- 频繁在中间插入删除 → `list`
- 两端都要插入删除 → `deque`
- 需要自动排序和去重 → `set`
- 需要键值对存储 → `map`
- 需要最快的查找速度 → `unordered_set/unordered_map`

### 迭代器详解

**什么是迭代器？**
迭代器就像一个"指路人"，它知道怎么在容器中"走路"。就像你在图书馆里找书，迭代器告诉你"下一本书在哪里"。

**迭代器的类型：**

**1. 输入迭代器（只能读取，只能前进）**
```cpp
#include <iostream>
#include <vector>

void inputIteratorExample() {
    std::vector<int> numbers = {1, 2, 3, 4, 5};

    // 输入迭代器：只能读取，只能向前
    std::vector<int>::iterator it = numbers.begin();

    std::cout << "使用迭代器遍历: ";
    while (it != numbers.end()) {
        std::cout << *it << " ";  // 读取当前元素
        ++it;  // 移动到下一个元素
    }
    std::cout << std::endl;
}
```

**2. 输出迭代器（只能写入，只能前进）**
```cpp
#include <iterator>
#include <vector>

void outputIteratorExample() {
    std::vector<int> source = {1, 2, 3, 4, 5};
    std::vector<int> destination(5);  // 准备5个位置

    // 使用输出迭代器复制数据
    std::copy(source.begin(), source.end(), destination.begin());

    std::cout << "复制后的数据: ";
    for (int num : destination) {
        std::cout << num << " ";
    }
    std::cout << std::endl;
}
```

**3. 前向迭代器（可读可写，只能前进）**
```cpp
#include <forward_list>

void forwardIteratorExample() {
    std::forward_list<int> singleList = {1, 2, 3, 4, 5};

    // 前向迭代器：可以多次遍历同一个范围
    auto it1 = singleList.begin();
    auto it2 = singleList.begin();

    // 两个迭代器可以独立移动
    ++it1;  // it1指向第二个元素
    ++it1;  // it1指向第三个元素

    std::cout << "it1指向: " << *it1 << std::endl;  // 输出3
    std::cout << "it2指向: " << *it2 << std::endl;  // 输出1
}
```

**4. 双向迭代器（可前进可后退）**
```cpp
#include <list>

void bidirectionalIteratorExample() {
    std::list<std::string> playlist = {"歌曲1", "歌曲2", "歌曲3", "歌曲4"};

    // 双向迭代器：像音乐播放器，可以前进后退
    auto currentSong = playlist.begin();

    std::cout << "当前播放: " << *currentSong << std::endl;

    // 下一首
    ++currentSong;
    std::cout << "下一首: " << *currentSong << std::endl;

    // 上一首
    --currentSong;
    std::cout << "上一首: " << *currentSong << std::endl;

    // 跳到最后一首
    currentSong = playlist.end();
    --currentSong;  // end()指向最后一个元素的下一个位置
    std::cout << "最后一首: " << *currentSong << std::endl;
}
```

**5. 随机访问迭代器（最强大，可以跳跃）**
```cpp
#include <vector>

void randomAccessIteratorExample() {
    std::vector<int> numbers = {10, 20, 30, 40, 50, 60, 70, 80, 90, 100};

    // 随机访问迭代器：像电梯，可以直接跳到任意楼层
    auto it = numbers.begin();

    std::cout << "第1个元素: " << *it << std::endl;

    // 直接跳到第5个元素
    it += 4;
    std::cout << "第5个元素: " << *it << std::endl;

    // 往回跳2个位置
    it -= 2;
    std::cout << "第3个元素: " << *it << std::endl;

    // 计算两个迭代器之间的距离
    auto distance = numbers.end() - numbers.begin();
    std::cout << "容器大小: " << distance << std::endl;

    // 可以像数组一样使用
    std::cout << "第7个元素: " << it[4] << std::endl;  // it[4] 等于 *(it + 4)
}
```

**迭代器失效问题：**
```cpp
#include <vector>

void iteratorInvalidationExample() {
    std::vector<int> numbers = {1, 2, 3, 4, 5};

    // 危险：迭代器失效
    auto it = numbers.begin();
    ++it;  // 指向第二个元素

    std::cout << "插入前，it指向: " << *it << std::endl;  // 输出2

    // 在开头插入元素，可能导致迭代器失效
    numbers.insert(numbers.begin(), 0);

    // 危险！it可能已经失效
    // std::cout << "插入后，it指向: " << *it << std::endl;  // 未定义行为

    // 安全做法：重新获取迭代器
    it = numbers.begin();
    ++it;
    std::cout << "重新获取后，it指向: " << *it << std::endl;  // 输出1
}

// 安全的迭代器使用模式
void safeIteratorUsage() {
    std::vector<int> numbers = {1, 2, 3, 4, 5};

    // 删除所有偶数
    for (auto it = numbers.begin(); it != numbers.end(); ) {
        if (*it % 2 == 0) {
            it = numbers.erase(it);  // erase返回下一个有效迭代器
        } else {
            ++it;  // 只有在不删除时才前进
        }
    }

    std::cout << "删除偶数后: ";
    for (int num : numbers) {
        std::cout << num << " ";
    }
    std::cout << std::endl;
}

### 算法详解

**什么是STL算法？**
STL算法就像一套"万能工具"，可以对任何容器进行各种操作。就像瑞士军刀，一把刀有很多功能：切、锯、开瓶等。STL算法也是这样，一套算法可以排序、查找、变换等。

#### 排序算法

**1. sort - 快速排序（像整理书架）**
```cpp
#include <algorithm>
#include <vector>
#include <iostream>

void sortExample() {
    // 乱七八糟的书架
    std::vector<int> messyBooks = {64, 34, 25, 12, 22, 11, 90};

    std::cout << "整理前的书架: ";
    for (int book : messyBooks) {
        std::cout << book << " ";
    }
    std::cout << std::endl;

    // 整理书架（从小到大）
    std::sort(messyBooks.begin(), messyBooks.end());

    std::cout << "整理后的书架: ";
    for (int book : messyBooks) {
        std::cout << book << " ";
    }
    std::cout << std::endl;

    // 自定义排序规则（从大到小）
    std::sort(messyBooks.begin(), messyBooks.end(), std::greater<int>());

    std::cout << "从大到小排序: ";
    for (int book : messyBooks) {
        std::cout << book << " ";
    }
    std::cout << std::endl;
}
```

**2. stable_sort - 稳定排序（保持相同元素的相对位置）**
```cpp
#include <algorithm>
#include <vector>
#include <string>

struct Student {
    std::string name;
    int score;
    int id;  // 学号，用来观察稳定性
};

void stableSortExample() {
    std::vector<Student> students = {
        {"张三", 85, 1},
        {"李四", 92, 2},
        {"王五", 85, 3},  // 和张三同分
        {"赵六", 78, 4},
        {"钱七", 85, 5}   // 也是85分
    };

    std::cout << "按成绩稳定排序前:" << std::endl;
    for (const auto& s : students) {
        std::cout << s.name << "(学号" << s.id << "): " << s.score << "分" << std::endl;
    }

    // 稳定排序：相同分数的学生保持原来的顺序
    std::stable_sort(students.begin(), students.end(),
                    [](const Student& a, const Student& b) {
                        return a.score > b.score;  // 按分数从高到低
                    });

    std::cout << "\n按成绩稳定排序后:" << std::endl;
    for (const auto& s : students) {
        std::cout << s.name << "(学号" << s.id << "): " << s.score << "分" << std::endl;
    }
    // 注意：85分的学生仍然保持张三、王五、钱七的顺序
}
```

**3. partial_sort - 部分排序（只排序前N个）**
```cpp
void partialSortExample() {
    std::vector<int> scores = {78, 92, 85, 67, 94, 88, 76, 91, 83, 89};

    std::cout << "所有成绩: ";
    for (int score : scores) {
        std::cout << score << " ";
    }
    std::cout << std::endl;

    // 只找出前3名的成绩
    std::partial_sort(scores.begin(), scores.begin() + 3, scores.end(),
                     std::greater<int>());

    std::cout << "前3名成绩: ";
    for (int i = 0; i < 3; i++) {
        std::cout << scores[i] << " ";
    }
    std::cout << std::endl;
    // 注意：后面的元素顺序是未定义的
}
```

#### 查找算法

**1. find - 线性查找（像在人群中找人）**
```cpp
#include <algorithm>
#include <vector>
#include <string>

void findExample() {
    std::vector<std::string> friends = {"小明", "小红", "小刚", "小丽", "小华"};

    // 在朋友列表中找小刚
    auto it = std::find(friends.begin(), friends.end(), "小刚");

    if (it != friends.end()) {
        int position = std::distance(friends.begin(), it);
        std::cout << "找到了小刚，他在第" << (position + 1) << "个位置" << std::endl;
    } else {
        std::cout << "没找到小刚" << std::endl;
    }

    // 使用find_if查找满足条件的元素
    auto longNameIt = std::find_if(friends.begin(), friends.end(),
                                  [](const std::string& name) {
                                      return name.length() > 2;  // 名字长度大于2
                                  });

    if (longNameIt != friends.end()) {
        std::cout << "第一个长名字的朋友是: " << *longNameIt << std::endl;
    }
}
```

**2. binary_search - 二分查找（像查字典）**
```cpp
void binarySearchExample() {
    // 必须是已排序的容器
    std::vector<int> sortedNumbers = {1, 3, 5, 7, 9, 11, 13, 15, 17, 19};

    std::cout << "在已排序数组中查找:" << std::endl;

    // 查找数字7
    bool found = std::binary_search(sortedNumbers.begin(), sortedNumbers.end(), 7);
    std::cout << "数字7" << (found ? "存在" : "不存在") << std::endl;

    // 查找数字8
    found = std::binary_search(sortedNumbers.begin(), sortedNumbers.end(), 8);
    std::cout << "数字8" << (found ? "存在" : "不存在") << std::endl;
}
```

**3. lower_bound 和 upper_bound - 边界查找**
```cpp
void boundExample() {
    std::vector<int> numbers = {1, 2, 2, 2, 3, 4, 5};

    // 找到第一个大于等于2的位置
    auto lower = std::lower_bound(numbers.begin(), numbers.end(), 2);
    std::cout << "第一个>=2的位置: " << std::distance(numbers.begin(), lower) << std::endl;

    // 找到第一个大于2的位置
    auto upper = std::upper_bound(numbers.begin(), numbers.end(), 2);
    std::cout << "第一个>2的位置: " << std::distance(numbers.begin(), upper) << std::endl;

    // 计算2的个数
    int count = std::distance(lower, upper);
    std::cout << "数字2出现了" << count << "次" << std::endl;
}

#### 数值算法

**1. accumulate - 累加器（像计算器的求和功能）**
```cpp
#include <numeric>
#include <vector>
#include <string>

void accumulateExample() {
    // 计算数字总和
    std::vector<int> prices = {10, 25, 8, 15, 30};

    int totalPrice = std::accumulate(prices.begin(), prices.end(), 0);
    std::cout << "商品总价: " << totalPrice << "元" << std::endl;

    // 计算乘积
    int product = std::accumulate(prices.begin(), prices.end(), 1,
                                 [](int a, int b) { return a * b; });
    std::cout << "所有价格的乘积: " << product << std::endl;

    // 连接字符串
    std::vector<std::string> words = {"Hello", " ", "World", "!"};
    std::string sentence = std::accumulate(words.begin(), words.end(), std::string(""));
    std::cout << "连接后的句子: " << sentence << std::endl;
}
```

**2. inner_product - 内积（像计算总分）**
```cpp
void innerProductExample() {
    // 各科成绩
    std::vector<int> scores = {85, 92, 78, 88, 95};
    // 各科权重
    std::vector<double> weights = {0.2, 0.3, 0.1, 0.2, 0.2};

    // 计算加权平均分
    double weightedSum = std::inner_product(scores.begin(), scores.end(),
                                           weights.begin(), 0.0);

    std::cout << "加权平均分: " << weightedSum << std::endl;

    // 计算两个向量的点积
    std::vector<int> vector1 = {1, 2, 3};
    std::vector<int> vector2 = {4, 5, 6};

    int dotProduct = std::inner_product(vector1.begin(), vector1.end(),
                                       vector2.begin(), 0);
    std::cout << "向量点积: " << dotProduct << std::endl;  // 1*4 + 2*5 + 3*6 = 32
}
```

**3. 自定义谓词函数（像设定筛选条件）**
```cpp
#include <algorithm>

// 判断是否为偶数
bool isEven(int n) {
    return n % 2 == 0;
}

// 判断字符串长度是否大于指定值
class LengthGreaterThan {
private:
    size_t minLength;
public:
    LengthGreaterThan(size_t len) : minLength(len) {}
    bool operator()(const std::string& str) const {
        return str.length() > minLength;
    }
};

void predicateExample() {
    std::vector<int> numbers = {1, 2, 3, 4, 5, 6, 7, 8, 9, 10};

    // 使用函数作为谓词
    int evenCount = std::count_if(numbers.begin(), numbers.end(), isEven);
    std::cout << "偶数个数: " << evenCount << std::endl;

    // 使用Lambda表达式作为谓词
    int bigNumbers = std::count_if(numbers.begin(), numbers.end(),
                                  [](int n) { return n > 5; });
    std::cout << "大于5的数字个数: " << bigNumbers << std::endl;

    // 使用函数对象作为谓词
    std::vector<std::string> words = {"cat", "dog", "elephant", "ant", "butterfly"};
    LengthGreaterThan longWord(3);

    int longWordCount = std::count_if(words.begin(), words.end(), longWord);
    std::cout << "长度大于3的单词个数: " << longWordCount << std::endl;
}
```

### 适配器与仿函数详解

**什么是适配器？**
适配器就像"转换器"，把一种接口转换成另一种接口。就像电源适配器把220V转换成5V一样。

#### 容器适配器

**1. stack - 栈（像叠盘子）**
```cpp
#include <stack>
#include <iostream>

void stackExample() {
    std::stack<std::string> plateStack;  // 盘子堆

    // 叠盘子（压栈）
    plateStack.push("第1个盘子");
    plateStack.push("第2个盘子");
    plateStack.push("第3个盘子");

    std::cout << "盘子堆的大小: " << plateStack.size() << std::endl;

    // 取盘子（出栈）- 后进先出(LIFO)
    while (!plateStack.empty()) {
        std::cout << "取出: " << plateStack.top() << std::endl;
        plateStack.pop();
    }

    // 栈的特点：只能从顶部操作，后进先出
}
```

**2. queue - 队列（像排队买票）**
```cpp
#include <queue>

void queueExample() {
    std::queue<std::string> ticketQueue;  // 买票队列

    // 排队（入队）
    ticketQueue.push("张三");
    ticketQueue.push("李四");
    ticketQueue.push("王五");

    std::cout << "队列长度: " << ticketQueue.size() << std::endl;
    std::cout << "队首是: " << ticketQueue.front() << std::endl;
    std::cout << "队尾是: " << ticketQueue.back() << std::endl;

    // 买票（出队）- 先进先出(FIFO)
    while (!ticketQueue.empty()) {
        std::cout << ticketQueue.front() << " 买到票了" << std::endl;
        ticketQueue.pop();
    }

    // 队列的特点：从后面进，从前面出，先进先出
}
```

**3. priority_queue - 优先队列（像VIP通道）**
```cpp
#include <queue>
#include <vector>

struct Task {
    std::string name;
    int priority;  // 优先级，数字越大优先级越高

    // 重载比较运算符（注意：priority_queue是大顶堆）
    bool operator<(const Task& other) const {
        return priority < other.priority;  // 优先级高的在前
    }
};

void priorityQueueExample() {
    std::priority_queue<Task> taskQueue;

    // 添加任务
    taskQueue.push({"写作业", 3});
    taskQueue.push({"吃饭", 5});      // 最高优先级
    taskQueue.push({"看电视", 1});
    taskQueue.push({"睡觉", 4});

    std::cout << "按优先级执行任务:" << std::endl;
    while (!taskQueue.empty()) {
        Task currentTask = taskQueue.top();
        std::cout << currentTask.name << " (优先级: " << currentTask.priority << ")" << std::endl;
        taskQueue.pop();
    }

    // 优先队列的特点：自动按优先级排序，优先级高的先出来
}
```
```
```
```

## 多线程与并发

**什么是多线程？**
想象你是一个餐厅老板，如果只有一个服务员，客人就要排队等待。但如果有多个服务员同时工作，就能同时服务多个客人。多线程就是这样：让程序同时做多件事情，提高效率！

### 线程管理详解

#### std::thread创建与管理

**1. 基本线程创建（像雇佣新员工）**
```cpp
#include <thread>
#include <iostream>
#include <chrono>

// 简单的工作函数
void simpleWork(const std::string& workerName) {
    for (int i = 1; i <= 5; i++) {
        std::cout << workerName << " 正在工作第 " << i << " 项任务" << std::endl;
        std::this_thread::sleep_for(std::chrono::milliseconds(500));  // 模拟工作时间
    }
    std::cout << workerName << " 完成了所有工作！" << std::endl;
}

void basicThreadExample() {
    std::cout << "餐厅开始营业！" << std::endl;

    // 创建两个工作线程（雇佣两个服务员）
    std::thread worker1(simpleWork, "服务员A");
    std::thread worker2(simpleWork, "服务员B");

    std::cout << "老板在做其他事情..." << std::endl;

    // 等待所有员工完成工作
    worker1.join();  // 等待服务员A完成
    worker2.join();  // 等待服务员B完成

    std::cout << "餐厅关门了！" << std::endl;
}
```

**2. 使用Lambda表达式创建线程**
```cpp
void lambdaThreadExample() {
    int taskCount = 3;

    // 使用Lambda表达式创建线程
    std::thread quickWorker([taskCount]() {
        for (int i = 1; i <= taskCount; i++) {
            std::cout << "快速工作者完成任务 " << i << std::endl;
            std::this_thread::sleep_for(std::chrono::milliseconds(200));
        }
    });

    // 使用Lambda捕获变量
    std::string department = "厨房";
    std::thread kitchenWorker([&department]() {
        std::cout << department << " 工作者开始工作" << std::endl;
        std::this_thread::sleep_for(std::chrono::seconds(1));
        std::cout << department << " 工作完成！" << std::endl;
    });

    quickWorker.join();
    kitchenWorker.join();
}
```

**3. 线程参数传递技巧**
```cpp
#include <thread>
#include <string>

class Worker {
public:
    void doWork(int workId, const std::string& task) {
        std::cout << "工人正在执行任务 " << workId << ": " << task << std::endl;
        std::this_thread::sleep_for(std::chrono::seconds(1));
        std::cout << "任务 " << workId << " 完成！" << std::endl;
    }
};

void parameterPassingExample() {
    Worker worker;

    // 传递对象的成员函数
    std::thread t1(&Worker::doWork, &worker, 1, "清洁桌子");

    // 传递引用参数（注意使用std::ref）
    std::string sharedTask = "准备食材";
    std::thread t2([&sharedTask]() {
        std::cout << "共享任务: " << sharedTask << std::endl;
        sharedTask = "任务已完成";  // 修改共享变量
    });

    t1.join();
    t2.join();

    std::cout << "最终任务状态: " << sharedTask << std::endl;
}
```

#### joinable与detach

**什么是joinable和detach？**
- **joinable**：像等孩子回家吃饭，父母会等孩子回来
- **detach**：像放风筝，线断了风筝自己飞，不用管它了

```cpp
void joinableDetachExample() {
    std::cout << "=== joinable示例 ===" << std::endl;

    // joinable：主线程等待子线程完成
    std::thread joinableWorker([]() {
        std::cout << "可等待的工作者开始工作..." << std::endl;
        std::this_thread::sleep_for(std::chrono::seconds(2));
        std::cout << "可等待的工作者完成工作！" << std::endl;
    });

    if (joinableWorker.joinable()) {
        std::cout << "主线程等待工作者完成..." << std::endl;
        joinableWorker.join();  // 等待完成
        std::cout << "工作者已完成，主线程继续" << std::endl;
    }

    std::cout << "\n=== detach示例 ===" << std::endl;

    // detach：让线程独立运行
    std::thread detachedWorker([]() {
        std::cout << "独立工作者开始工作..." << std::endl;
        std::this_thread::sleep_for(std::chrono::seconds(1));
        std::cout << "独立工作者完成工作！" << std::endl;
    });

    detachedWorker.detach();  // 分离线程
    std::cout << "主线程不等待，继续执行其他任务" << std::endl;

    // 给detached线程一些时间完成
    std::this_thread::sleep_for(std::chrono::milliseconds(1500));
}
```

**线程管理的最佳实践：**
```cpp
#include <vector>
#include <thread>

class ThreadManager {
private:
    std::vector<std::thread> workers;

public:
    // 添加工作线程
    template<typename Function, typename... Args>
    void addWorker(Function&& func, Args&&... args) {
        workers.emplace_back(std::forward<Function>(func),
                           std::forward<Args>(args)...);
    }

    // 等待所有线程完成
    void waitAll() {
        for (auto& worker : workers) {
            if (worker.joinable()) {
                worker.join();
            }
        }
        workers.clear();
    }

    // 获取当前线程数量
    size_t getWorkerCount() const {
        return workers.size();
    }

    ~ThreadManager() {
        waitAll();  // 析构时确保所有线程完成
    }
};

void threadManagerExample() {
    ThreadManager manager;

    // 添加多个工作线程
    for (int i = 1; i <= 3; i++) {
        manager.addWorker([i]() {
            std::cout << "线程 " << i << " 开始工作" << std::endl;
            std::this_thread::sleep_for(std::chrono::milliseconds(500 * i));
            std::cout << "线程 " << i << " 完成工作" << std::endl;
        });
    }

    std::cout << "创建了 " << manager.getWorkerCount() << " 个工作线程" << std::endl;
    std::cout << "等待所有线程完成..." << std::endl;

    manager.waitAll();
    std::cout << "所有线程已完成！" << std::endl;
}

### 互斥与同步详解

**什么是互斥？**
想象一个公共厕所，只有一个坑位。如果有人在用，其他人就要等待。互斥锁(mutex)就像厕所门上的锁，确保同一时间只有一个线程能访问共享资源。

#### mutex家族

**1. std::mutex - 基本互斥锁（像厕所门锁）**
```cpp
#include <mutex>
#include <thread>
#include <iostream>

std::mutex toiletMutex;  // 厕所锁
int sharedCounter = 0;   // 共享计数器

void useToilet(const std::string& person) {
    std::cout << person << " 想要使用厕所..." << std::endl;

    toiletMutex.lock();  // 锁门
    std::cout << person << " 进入厕所，开始使用" << std::endl;

    // 模拟使用厕所的时间
    std::this_thread::sleep_for(std::chrono::seconds(1));
    sharedCounter++;  // 安全地修改共享变量

    std::cout << person << " 使用完毕，离开厕所。总使用次数: " << sharedCounter << std::endl;
    toiletMutex.unlock();  // 开锁
}

void basicMutexExample() {
    std::vector<std::thread> people;

    // 5个人要使用厕所
    for (int i = 1; i <= 5; i++) {
        people.emplace_back(useToilet, "人员" + std::to_string(i));
    }

    // 等待所有人使用完毕
    for (auto& person : people) {
        person.join();
    }
}
```

**2. std::lock_guard - 自动锁管理（像自动门锁）**
```cpp
#include <mutex>

std::mutex bankMutex;
int bankAccount = 1000;  // 银行账户余额

void withdrawMoney(const std::string& person, int amount) {
    std::cout << person << " 想要取款 " << amount << " 元" << std::endl;

    // 使用lock_guard自动管理锁
    std::lock_guard<std::mutex> guard(bankMutex);  // 自动加锁

    if (bankAccount >= amount) {
        std::cout << person << " 取款前余额: " << bankAccount << " 元" << std::endl;

        // 模拟取款处理时间
        std::this_thread::sleep_for(std::chrono::milliseconds(100));

        bankAccount -= amount;
        std::cout << person << " 成功取款 " << amount << " 元，余额: " << bankAccount << " 元" << std::endl;
    } else {
        std::cout << person << " 余额不足，无法取款 " << amount << " 元" << std::endl;
    }

    // guard析构时自动解锁，即使发生异常也能正确解锁
}

void lockGuardExample() {
    std::vector<std::thread> customers;

    // 多个客户同时取款
    customers.emplace_back(withdrawMoney, "张三", 300);
    customers.emplace_back(withdrawMoney, "李四", 500);
    customers.emplace_back(withdrawMoney, "王五", 400);
    customers.emplace_back(withdrawMoney, "赵六", 600);

    for (auto& customer : customers) {
        customer.join();
    }
}
```

**3. std::recursive_mutex - 递归锁（像可以重复进入的房间）**
```cpp
#include <mutex>

std::recursive_mutex recursiveMutex;
int recursiveCounter = 0;

void recursiveFunction(int depth, const std::string& caller) {
    std::lock_guard<std::recursive_mutex> guard(recursiveMutex);

    recursiveCounter++;
    std::cout << caller << " 递归深度 " << depth << ", 计数器: " << recursiveCounter << std::endl;

    if (depth > 0) {
        // 递归调用，同一线程可以多次获得锁
        recursiveFunction(depth - 1, caller);
    }
}

void recursiveMutexExample() {
    std::thread t1(recursiveFunction, 3, "线程1");
    std::thread t2(recursiveFunction, 2, "线程2");

    t1.join();
    t2.join();

    std::cout << "最终计数器值: " << recursiveCounter << std::endl;
}
```

**4. std::timed_mutex - 定时锁（像有时间限制的等待）**
```cpp
#include <mutex>
#include <chrono>

std::timed_mutex timedMutex;

void tryTimedLock(const std::string& person, int waitSeconds) {
    std::cout << person << " 尝试获取锁，最多等待 " << waitSeconds << " 秒" << std::endl;

    // 尝试在指定时间内获取锁
    if (timedMutex.try_lock_for(std::chrono::seconds(waitSeconds))) {
        std::cout << person << " 成功获取锁！" << std::endl;

        // 模拟工作时间
        std::this_thread::sleep_for(std::chrono::seconds(2));

        std::cout << person << " 释放锁" << std::endl;
        timedMutex.unlock();
    } else {
        std::cout << person << " 等待超时，放弃获取锁" << std::endl;
    }
}

void timedMutexExample() {
    std::thread t1(tryTimedLock, "耐心的人", 5);  // 愿意等5秒
    std::thread t2(tryTimedLock, "急性子", 1);    // 只愿意等1秒

    t1.join();
    t2.join();
}
```

#### 原子操作与memory order

**什么是原子操作？**
原子操作就像"不可分割的动作"。比如眨眼睛，要么完全眨完，要么完全没眨，不会有"眨一半"的状态。

```cpp
#include <atomic>
#include <thread>
#include <vector>

std::atomic<int> atomicCounter(0);  // 原子计数器
int normalCounter = 0;              // 普通计数器
std::mutex normalMutex;             // 保护普通计数器的锁

void atomicIncrement(int times) {
    for (int i = 0; i < times; i++) {
        atomicCounter++;  // 原子操作，不需要锁
    }
}

void normalIncrement(int times) {
    for (int i = 0; i < times; i++) {
        std::lock_guard<std::mutex> guard(normalMutex);
        normalCounter++;  // 需要锁保护
    }
}

void atomicExample() {
    const int incrementTimes = 10000;
    const int threadCount = 4;

    // 测试原子操作
    std::vector<std::thread> atomicThreads;
    auto startTime = std::chrono::high_resolution_clock::now();

    for (int i = 0; i < threadCount; i++) {
        atomicThreads.emplace_back(atomicIncrement, incrementTimes);
    }

    for (auto& t : atomicThreads) {
        t.join();
    }

    auto atomicTime = std::chrono::high_resolution_clock::now() - startTime;

    // 测试普通操作+锁
    std::vector<std::thread> normalThreads;
    startTime = std::chrono::high_resolution_clock::now();

    for (int i = 0; i < threadCount; i++) {
        normalThreads.emplace_back(normalIncrement, incrementTimes);
    }

    for (auto& t : normalThreads) {
        t.join();
    }

    auto normalTime = std::chrono::high_resolution_clock::now() - startTime;

    std::cout << "原子计数器结果: " << atomicCounter.load() << std::endl;
    std::cout << "普通计数器结果: " << normalCounter << std::endl;
    std::cout << "原子操作耗时: " << std::chrono::duration_cast<std::chrono::microseconds>(atomicTime).count() << " 微秒" << std::endl;
    std::cout << "锁操作耗时: " << std::chrono::duration_cast<std::chrono::microseconds>(normalTime).count() << " 微秒" << std::endl;
}

#### 条件变量实现线程协作

**什么是条件变量？**
条件变量就像"等待信号的机制"。比如在餐厅，服务员等待厨师做好菜的信号，厨师做好菜后通知服务员来取。

```cpp
#include <condition_variable>
#include <mutex>
#include <queue>

class Restaurant {
private:
    std::queue<std::string> dishes;      // 菜品队列
    std::mutex kitchenMutex;             // 厨房锁
    std::condition_variable dishReady;   // 菜品准备好的信号
    bool restaurantOpen = true;          // 餐厅是否营业

public:
    // 厨师做菜
    void cook(const std::string& chefName) {
        for (int i = 1; i <= 5; i++) {
            std::this_thread::sleep_for(std::chrono::seconds(1));  // 做菜时间

            {
                std::lock_guard<std::mutex> lock(kitchenMutex);
                std::string dish = chefName + "的第" + std::to_string(i) + "道菜";
                dishes.push(dish);
                std::cout << "厨师 " << chefName << " 做好了: " << dish << std::endl;
            }

            dishReady.notify_one();  // 通知服务员有菜准备好了
        }
    }

    // 服务员上菜
    void serve(const std::string& waiterName) {
        while (restaurantOpen) {
            std::unique_lock<std::mutex> lock(kitchenMutex);

            // 等待菜品准备好
            dishReady.wait(lock, [this] { return !dishes.empty() || !restaurantOpen; });

            if (!restaurantOpen && dishes.empty()) {
                break;  // 餐厅关门且没有菜了
            }

            if (!dishes.empty()) {
                std::string dish = dishes.front();
                dishes.pop();
                std::cout << "服务员 " << waiterName << " 上菜: " << dish << std::endl;
            }
        }
        std::cout << "服务员 " << waiterName << " 下班了" << std::endl;
    }

    // 关闭餐厅
    void closeRestaurant() {
        std::this_thread::sleep_for(std::chrono::seconds(6));  // 营业6秒

        {
            std::lock_guard<std::mutex> lock(kitchenMutex);
            restaurantOpen = false;
            std::cout << "餐厅准备关门..." << std::endl;
        }

        dishReady.notify_all();  // 通知所有服务员
    }
};

void conditionVariableExample() {
    Restaurant restaurant;

    // 启动厨师线程
    std::thread chef1(&Restaurant::cook, &restaurant, "张师傅");
    std::thread chef2(&Restaurant::cook, &restaurant, "李师傅");

    // 启动服务员线程
    std::thread waiter1(&Restaurant::serve, &restaurant, "小王");
    std::thread waiter2(&Restaurant::serve, &restaurant, "小李");

    // 启动关门线程
    std::thread manager(&Restaurant::closeRestaurant, &restaurant);

    // 等待所有线程完成
    chef1.join();
    chef2.join();
    waiter1.join();
    waiter2.join();
    manager.join();

    std::cout << "餐厅已关门！" << std::endl;
}
```

### 高级并发模式详解

#### 生产者-消费者模式

**什么是生产者-消费者模式？**
就像工厂流水线：生产者制造产品放到仓库，消费者从仓库取产品使用。仓库满了生产者要等待，仓库空了消费者要等待。

```cpp
#include <condition_variable>
#include <mutex>
#include <queue>
#include <thread>

template<typename T>
class SafeQueue {
private:
    std::queue<T> queue_;
    std::mutex mutex_;
    std::condition_variable condition_;

public:
    // 生产者放入产品
    void push(const T& item) {
        std::lock_guard<std::mutex> lock(mutex_);
        queue_.push(item);
        condition_.notify_one();  // 通知消费者
    }

    // 消费者取出产品
    T pop() {
        std::unique_lock<std::mutex> lock(mutex_);
        condition_.wait(lock, [this] { return !queue_.empty(); });

        T item = queue_.front();
        queue_.pop();
        return item;
    }

    // 检查是否为空
    bool empty() const {
        std::lock_guard<std::mutex> lock(mutex_);
        return queue_.empty();
    }

    // 获取大小
    size_t size() const {
        std::lock_guard<std::mutex> lock(mutex_);
        return queue_.size();
    }
};

void producerConsumerExample() {
    SafeQueue<int> warehouse;  // 仓库
    std::atomic<bool> factoryRunning(true);

    // 生产者函数
    auto producer = [&warehouse, &factoryRunning](const std::string& name) {
        for (int i = 1; i <= 10; i++) {
            int product = i * 10;  // 生产产品
            warehouse.push(product);
            std::cout << "生产者 " << name << " 生产了产品: " << product << std::endl;
            std::this_thread::sleep_for(std::chrono::milliseconds(100));
        }
        std::cout << "生产者 " << name << " 完成生产" << std::endl;
    };

    // 消费者函数
    auto consumer = [&warehouse, &factoryRunning](const std::string& name) {
        while (factoryRunning || !warehouse.empty()) {
            try {
                int product = warehouse.pop();
                std::cout << "消费者 " << name << " 消费了产品: " << product << std::endl;
                std::this_thread::sleep_for(std::chrono::milliseconds(150));
            } catch (...) {
                break;
            }
        }
        std::cout << "消费者 " << name << " 完成消费" << std::endl;
    };

    // 启动生产者和消费者
    std::thread producer1(producer, "工厂A");
    std::thread producer2(producer, "工厂B");
    std::thread consumer1(consumer, "商店1");
    std::thread consumer2(consumer, "商店2");

    // 等待生产者完成
    producer1.join();
    producer2.join();

    // 等待一段时间让消费者处理完剩余产品
    std::this_thread::sleep_for(std::chrono::seconds(2));
    factoryRunning = false;

    // 等待消费者完成
    consumer1.join();
    consumer2.join();

    std::cout << "工厂关闭，仓库剩余产品: " << warehouse.size() << std::endl;
}

### 并发陷阱详解

#### 死锁检测与预防

**什么是死锁？**
死锁就像两个人在窄路上相遇，都不愿意让路，结果谁都过不去。在程序中，两个线程互相等待对方释放资源，结果都卡住了。

```cpp
#include <mutex>
#include <thread>

std::mutex mutex1;
std::mutex mutex2;

// 危险：可能导致死锁的代码
void dangerousFunction1() {
    std::cout << "线程1尝试获取mutex1..." << std::endl;
    std::lock_guard<std::mutex> lock1(mutex1);
    std::cout << "线程1获得了mutex1" << std::endl;

    std::this_thread::sleep_for(std::chrono::milliseconds(100));

    std::cout << "线程1尝试获取mutex2..." << std::endl;
    std::lock_guard<std::mutex> lock2(mutex2);  // 可能死锁
    std::cout << "线程1获得了mutex2，完成工作" << std::endl;
}

void dangerousFunction2() {
    std::cout << "线程2尝试获取mutex2..." << std::endl;
    std::lock_guard<std::mutex> lock2(mutex2);
    std::cout << "线程2获得了mutex2" << std::endl;

    std::this_thread::sleep_for(std::chrono::milliseconds(100));

    std::cout << "线程2尝试获取mutex1..." << std::endl;
    std::lock_guard<std::mutex> lock1(mutex1);  // 可能死锁
    std::cout << "线程2获得了mutex1，完成工作" << std::endl;
}

// 安全：使用std::lock避免死锁
void safeFunction1() {
    std::cout << "安全线程1开始工作..." << std::endl;

    // 同时锁定两个mutex，避免死锁
    std::lock(mutex1, mutex2);
    std::lock_guard<std::mutex> lock1(mutex1, std::adopt_lock);
    std::lock_guard<std::mutex> lock2(mutex2, std::adopt_lock);

    std::cout << "安全线程1获得了所有锁，完成工作" << std::endl;
    std::this_thread::sleep_for(std::chrono::milliseconds(100));
}

void safeFunction2() {
    std::cout << "安全线程2开始工作..." << std::endl;

    // 同样的顺序锁定
    std::lock(mutex1, mutex2);
    std::lock_guard<std::mutex> lock1(mutex1, std::adopt_lock);
    std::lock_guard<std::mutex> lock2(mutex2, std::adopt_lock);

    std::cout << "安全线程2获得了所有锁，完成工作" << std::endl;
    std::this_thread::sleep_for(std::chrono::milliseconds(100));
}

void deadlockExample() {
    std::cout << "=== 危险的死锁示例（可能卡住）===" << std::endl;

    // 注意：这个例子可能会导致死锁，程序卡住
    // std::thread t1(dangerousFunction1);
    // std::thread t2(dangerousFunction2);
    // t1.join();
    // t2.join();

    std::cout << "=== 安全的避免死锁示例 ===" << std::endl;

    std::thread safe1(safeFunction1);
    std::thread safe2(safeFunction2);

    safe1.join();
    safe2.join();

    std::cout << "所有安全线程完成工作" << std::endl;
}
```

#### 竞态条件识别技巧

**什么是竞态条件？**
竞态条件就像两个人同时去拿桌上最后一个苹果，结果可能谁都没拿到，或者苹果被弄坏了。在程序中，多个线程同时访问共享数据，结果不可预测。

```cpp
#include <thread>
#include <vector>
#include <atomic>

// 危险：存在竞态条件的银行账户
class UnsafeBankAccount {
private:
    int balance;

public:
    UnsafeBankAccount(int initialBalance) : balance(initialBalance) {}

    void deposit(int amount) {
        int temp = balance;  // 读取余额
        std::this_thread::sleep_for(std::chrono::microseconds(1));  // 模拟处理时间
        balance = temp + amount;  // 写入新余额（危险！）
    }

    void withdraw(int amount) {
        int temp = balance;  // 读取余额
        std::this_thread::sleep_for(std::chrono::microseconds(1));  // 模拟处理时间
        if (temp >= amount) {
            balance = temp - amount;  // 写入新余额（危险！）
        }
    }

    int getBalance() const { return balance; }
};

// 安全：使用原子操作的银行账户
class SafeBankAccount {
private:
    std::atomic<int> balance;

public:
    SafeBankAccount(int initialBalance) : balance(initialBalance) {}

    void deposit(int amount) {
        balance += amount;  // 原子操作，安全
    }

    void withdraw(int amount) {
        int expected = balance.load();
        while (expected >= amount &&
               !balance.compare_exchange_weak(expected, expected - amount)) {
            // 如果余额被其他线程修改，重试
        }
    }

    int getBalance() const { return balance.load(); }
};

void raceConditionExample() {
    const int threadCount = 10;
    const int operationsPerThread = 100;

    std::cout << "=== 不安全的银行账户（存在竞态条件）===" << std::endl;

    UnsafeBankAccount unsafeAccount(1000);
    std::vector<std::thread> unsafeThreads;

    // 多个线程同时存取款
    for (int i = 0; i < threadCount; i++) {
        unsafeThreads.emplace_back([&unsafeAccount, operationsPerThread]() {
            for (int j = 0; j < operationsPerThread; j++) {
                unsafeAccount.deposit(1);
                unsafeAccount.withdraw(1);
            }
        });
    }

    for (auto& t : unsafeThreads) {
        t.join();
    }

    std::cout << "不安全账户最终余额: " << unsafeAccount.getBalance()
              << " (应该是1000)" << std::endl;

    std::cout << "\n=== 安全的银行账户（使用原子操作）===" << std::endl;

    SafeBankAccount safeAccount(1000);
    std::vector<std::thread> safeThreads;

    // 多个线程同时存取款
    for (int i = 0; i < threadCount; i++) {
        safeThreads.emplace_back([&safeAccount, operationsPerThread]() {
            for (int j = 0; j < operationsPerThread; j++) {
                safeAccount.deposit(1);
                safeAccount.withdraw(1);
            }
        });
    }

    for (auto& t : safeThreads) {
        t.join();
    }

    std::cout << "安全账户最终余额: " << safeAccount.getBalance()
              << " (应该是1000)" << std::endl;
}
```

#### 性能优化技巧

**锁粒度优化：**
```cpp
#include <mutex>
#include <unordered_map>

// 粗粒度锁：整个数据结构一个锁
class CoarseGrainedCache {
private:
    std::unordered_map<std::string, std::string> cache;
    std::mutex cacheMutex;

public:
    void put(const std::string& key, const std::string& value) {
        std::lock_guard<std::mutex> lock(cacheMutex);  // 锁住整个缓存
        cache[key] = value;
    }

    std::string get(const std::string& key) {
        std::lock_guard<std::mutex> lock(cacheMutex);  // 锁住整个缓存
        auto it = cache.find(key);
        return (it != cache.end()) ? it->second : "";
    }
};

// 细粒度锁：每个桶一个锁
class FineGrainedCache {
private:
    static const size_t BUCKET_COUNT = 16;
    std::unordered_map<std::string, std::string> buckets[BUCKET_COUNT];
    std::mutex bucketMutexes[BUCKET_COUNT];

    size_t getBucketIndex(const std::string& key) {
        return std::hash<std::string>{}(key) % BUCKET_COUNT;
    }

public:
    void put(const std::string& key, const std::string& value) {
        size_t index = getBucketIndex(key);
        std::lock_guard<std::mutex> lock(bucketMutexes[index]);  // 只锁一个桶
        buckets[index][key] = value;
    }

    std::string get(const std::string& key) {
        size_t index = getBucketIndex(key);
        std::lock_guard<std::mutex> lock(bucketMutexes[index]);  // 只锁一个桶
        auto it = buckets[index].find(key);
        return (it != buckets[index].end()) ? it->second : "";
    }
};

void lockGranularityExample() {
    std::cout << "锁粒度优化可以提高并发性能：" << std::endl;
    std::cout << "- 粗粒度锁：简单但并发性差" << std::endl;
    std::cout << "- 细粒度锁：复杂但并发性好" << std::endl;
    std::cout << "- 无锁编程：最快但最难实现" << std::endl;
}

**总结：多线程编程要点**
1. **正确性第一**：先保证程序正确，再考虑性能
2. **最小锁原则**：锁的范围越小越好
3. **避免死锁**：统一锁顺序，使用std::lock
4. **优先使用高级工具**：atomic、condition_variable等
5. **测试并发问题**：使用压力测试发现竞态条件
6. **性能分析**：测量实际性能，不要过早优化

---

## 实践技巧

### 代码优化
- 编译期计算与模板元编程
- 指令级并行与CPU缓存优化
- 常见性能陷阱

### 调试技术
- GDB高级调试技巧
- 静态分析工具使用
- 性能分析工具应用