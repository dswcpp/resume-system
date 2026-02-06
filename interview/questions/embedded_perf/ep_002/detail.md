# 交叉编译问题与动态库依赖冲突

## 知识点速览
- 交叉编译 = 在一种平台上编译另一种平台的可执行程序
- 关键要素：交叉编译工具链、sysroot、目标平台库
- 常见架构组合：x86_64宿主机 → ARM64/aarch64目标板

## 我的实战经历
在营业厅项目中，需要将Qt应用部署到RK3399（ARM64）开发板上：
- 宿主机是x86_64 Ubuntu，目标板是aarch64 Linux
- 使用Linaro提供的aarch64-linux-gnu工具链
- 遇到最棘手的问题是Qt库的依赖冲突：宿主机编译的.so文件直接拷到目标板无法运行，必须用交叉工具链重新编译Qt源码
- 还遇到过glibc版本不兼容导致的"GLIBC_2.28 not found"问题，最终通过降低工具链版本解决

## 深入原理

### 交叉编译环境三要素
1. **工具链（Toolchain）**：交叉编译器、链接器、汇编器等，前缀标识目标架构（如aarch64-linux-gnu-）
2. **Sysroot**：目标平台的根文件系统镜像，包含头文件和库文件
3. **构建系统配置**：CMake toolchain file 或 qmake mkspec

### CMake交叉编译配置
```cmake
set(CMAKE_SYSTEM_NAME Linux)
set(CMAKE_SYSTEM_PROCESSOR aarch64)
set(CMAKE_SYSROOT /opt/sysroot-aarch64)
set(CMAKE_C_COMPILER aarch64-linux-gnu-gcc)
set(CMAKE_CXX_COMPILER aarch64-linux-gnu-g++)
set(CMAKE_FIND_ROOT_PATH_MODE_PROGRAM NEVER)
set(CMAKE_FIND_ROOT_PATH_MODE_LIBRARY ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_INCLUDE ONLY)
```

### 动态库依赖排查工具
| 工具 | 用途 |
|------|------|
| file | 查看ELF文件的目标架构 |
| ldd / readelf -d | 查看动态库依赖 |
| objdump -p | 查看NEEDED条目 |
| chrpath / patchelf | 修改RPATH |
| LD_DEBUG=libs | 运行时查看库加载过程 |

### 常见问题及解法
1. **架构不匹配**：file命令确认.so文件架构，确保全部是目标架构
2. **版本冲突**：统一所有库的编译工具链版本
3. **路径问题**：设置正确的sysroot，避免链接到宿主机的库
4. **符号缺失**：nm/objdump检查符号表，确认链接顺序

## 面试表达建议
先交代背景（什么项目、什么目标板），然后按遇到的问题逐个说解决方案，最后总结经验（三要素一致性）。避免只说理论，要带上具体的错误信息和解决过程。
