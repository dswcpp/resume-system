# RK3399交叉编译环境是怎么搭建的？遇到什么问题？

## 知识点速览

交叉编译 = 在一种平台上编译出另一种平台运行的程序。核心组件：**工具链**（aarch64-linux-gnu-g++）、**sysroot**（目标系统的头文件和库副本）、**mkspec/toolchain 文件**（告诉构建系统如何交叉编译）。

**为什么需要交叉编译：**
- 目标设备（ARM 板）编译太慢
- 开发效率：在熟悉的 x86 环境写代码、编译
- CI/CD：服务器统一编译所有平台版本

## 我的实战经历

**公司/项目：** 江苏思行达 · 营业厅平台（RK3399 Ubuntu 20.04）

**问题（Situation + Task）：**
营业厅平台部署在 RK3399 开发板（ARM aarch64 架构），运行 Ubuntu 20.04。项目用 C++/Qt 开发，需要在 x86 Ubuntu 开发机上编译出能在 ARM 板上运行的程序。团队之前没有交叉编译经验，我负责从零搭建整个环境。

**解决（Action）：**

**步骤一：安装交叉编译工具链**

```bash
sudo apt install gcc-aarch64-linux-gnu g++-aarch64-linux-gnu
# 验证
aarch64-linux-gnu-g++ --version
echo 'int main() { return 0; }' > test.cpp
aarch64-linux-gnu-g++ test.cpp -o test
file test  # 输出：ELF 64-bit LSB executable, ARM aarch64
```

**步骤二：准备 sysroot**

从目标设备拷贝头文件和库：
```bash
ssh user@target "tar czf /tmp/sysroot.tar.gz /usr/include /usr/lib /lib"
scp user@target:/tmp/sysroot.tar.gz .
mkdir -p ~/rk3399-sysroot && tar xzf sysroot.tar.gz -C ~/rk3399-sysroot
```

**步骤三：配置 Qt 交叉编译**

创建 Qt 的 mkspec 配置文件，指定交叉编译器路径；然后交叉编译 Qt 源码：
```bash
./configure -prefix /opt/qt5-arm -xplatform linux-aarch64-gnu-g++ \
    -sysroot ~/rk3399-sysroot -opensource -confirm-license \
    -nomake examples -nomake tests -skip qtwebengine
make -j8 && make install
```

**步骤四：配置 Qt Creator**

添加 Qt 版本（/opt/qt5-arm/bin/qmake）→ 添加编译器（aarch64-linux-gnu-g++）→ 创建 Kit 关联两者 + sysroot。

**步骤五：CMake toolchain 文件**

```cmake
set(CMAKE_SYSTEM_NAME Linux)
set(CMAKE_SYSTEM_PROCESSOR aarch64)
set(CMAKE_C_COMPILER aarch64-linux-gnu-gcc)
set(CMAKE_CXX_COMPILER aarch64-linux-gnu-g++)
set(CMAKE_SYSROOT /home/user/rk3399-sysroot)
set(CMAKE_FIND_ROOT_PATH_MODE_LIBRARY ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_INCLUDE ONLY)
```

**踩过的坑及解决方案：**

**坑 1：glibc 版本不匹配**
开发机 gcc 9 编译的程序在目标设备上报 `GLIBC_2.28 not found`——目标设备 glibc 只有 2.17。解决：从厂商 SDK 获取低版本工具链，或用 Docker 容器模拟目标环境的 glibc 版本。

**坑 2：sysroot 符号链接失效**
sysroot 里的 .so 文件是绝对路径符号链接（如 `/usr/lib/libssl.so → /usr/lib/libssl.so.1.1`），拷贝到开发机后路径变了，链接失效。解决：写脚本批量修复为相对路径链接。

**坑 3：第三方库需单独交叉编译**
项目依赖 OpenSSL，系统装的是 x86 版本。需要用交叉编译工具链重新编译 OpenSSL，把头文件和库放到 sysroot 对应目录。

**坑 4：Qt 平台插件忘记部署**
程序编译通过，传到目标设备运行报 "could not find or load the Qt platform plugin"。解决：把 Qt 的 platforms/libqlinuxfb.so 和依赖库一起打包部署，用启动脚本设置 `LD_LIBRARY_PATH`。

**坑 5：浮点 ABI 不匹配**
硬浮点（hard-float）和软浮点（soft-float）混用导致链接错误。确认目标设备用硬浮点后，编译时统一加 `-mfloat-abi=hard`。

**结果（Result）：**
- 从零搭建完整的交叉编译环境，支持 Qt 和 CMake 两种构建方式
- Docker 镜像封装编译环境，CI 服务器自动化交叉编译
- 编写了《RK3399 交叉编译指南》，团队后续搭建环境只需半天
- 部署脚本自动打包程序+依赖库+启动脚本，一键传输到目标设备

## 深入原理

### sysroot 的作用

sysroot 告诉编译器"去这个目录找头文件和库，不要用系统的"。没有 sysroot，编译器会用开发机的 x86 头文件和库，编出来的还是 x86 程序。

### 交叉编译 vs 本地编译的核心区别

| 维度 | 本地编译 | 交叉编译 |
|------|----------|----------|
| 编译器 | gcc | aarch64-linux-gnu-gcc |
| 查找路径 | /usr/include, /usr/lib | sysroot 下 |
| 运行 | 直接运行 | 传到目标设备 |
| 调试 | 直接 gdb | gdbserver 远程调试 |

### 能不能用 Docker 简化？

可以。Docker + 交叉编译工具链是我们最终采用的方案。CI 服务器上有预配置好的 Docker 镜像，包含工具链、sysroot、Qt，开发者 `docker run` 一条命令即可编译。

## 面试表达建议

**开头概括流程：** "搭建交叉编译环境主要五步：装工具链、准备 sysroot、配置 Qt 交叉编译、在 Qt Creator 建 Kit、写 CMake toolchain 文件。"

**重点讲踩坑经验：** "最大的坑是 glibc 版本不匹配，开发机编译的程序在目标设备跑不起来。还有 sysroot 里的符号链接是绝对路径，拷贝后失效需要批量修复。"

**收尾展示工程化：** "最终我用 Docker 镜像封装了整个编译环境，写了部署脚本和文档，CI 上自动化交叉编译，团队搭环境从以前的几天变成了半天。"
