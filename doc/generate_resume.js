const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Footer, AlignmentType, LevelFormat, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, TabStopType, TabStopPosition,
} = require("docx");

// ==================== Constants ====================
const F = "微软雅黑";
const C = { pri: "1A5276", acc: "2980B9", txt: "333333", sub: "666666" };

// Invisible borders for layout-only tables (contact info row)
const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const nbs = { top: none, bottom: none, left: none, right: none };

// ==================== Helpers ====================

// Generic paragraph
function p(runs, o = {}) {
  const ch = typeof runs === "string"
    ? [new TextRun({ text: runs, font: F, size: o.sz || 21, color: o.c || C.txt, bold: !!o.b })]
    : runs.map(r => new TextRun({ text: r.text, font: F, size: r.sz || o.sz || 21, color: r.c || o.c || C.txt, bold: !!r.b, italics: !!r.i }));
  return new Paragraph({
    alignment: o.ctr ? AlignmentType.CENTER : AlignmentType.LEFT,
    spacing: { before: o.sb || 40, after: o.sa || 40 },
    indent: o.ind ? { left: o.ind } : undefined,
    children: ch,
  });
}

// Section header with bottom accent line
function secTitle(text) {
  return new Paragraph({
    spacing: { before: 320, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.acc, space: 6 } },
    children: [new TextRun({ text, font: F, size: 26, bold: true, color: C.pri })],
  });
}

// Subsection header (company name / project name)
function subHead(runs) {
  return new Paragraph({
    spacing: { before: 200, after: 60 },
    children: runs.map(r => new TextRun({ text: r.text, font: F, size: 22, color: r.c || C.txt, bold: r.b !== false })),
  });
}

// Bullet item
function bl(runs) {
  const ch = typeof runs === "string"
    ? [new TextRun({ text: runs, font: F, size: 21, color: C.txt })]
    : runs.map(r => new TextRun({ text: r.text, font: F, size: 21, color: r.c || C.txt, bold: !!r.b }));
  return new Paragraph({
    numbering: { reference: "bl", level: 0 },
    spacing: { before: 25, after: 25 },
    children: ch,
  });
}

// Numbered item with bold prefix
function nlBold(boldPart, rest, ref) {
  return new Paragraph({
    numbering: { reference: ref, level: 0 },
    spacing: { before: 25, after: 25 },
    children: [
      new TextRun({ text: boldPart, font: F, size: 21, color: C.txt, bold: true }),
      new TextRun({ text: rest, font: F, size: 21, color: C.txt }),
    ],
  });
}

// Invisible layout cell (for contact info row only)
function lc(text, w, o = {}) {
  return new TableCell({
    borders: nbs, width: { size: w, type: WidthType.DXA },
    children: [new Paragraph({
      alignment: o.ctr ? AlignmentType.CENTER : AlignmentType.LEFT,
      spacing: { before: 10, after: 10 },
      children: [new TextRun({ text, font: F, size: 19, color: C.sub })],
    })],
  });
}

// ==================== Content Sections ====================

function buildHeader() {
  const W = 9640;
  const cw = Math.floor(W / 3);
  return [
    // Name
    p([{ text: "段胜炜", sz: 36, b: true, c: C.pri }], { ctr: true, sb: 80, sa: 10 }),
    // Title
    p([{ text: "C++开发工程师（中级）", sz: 22, c: C.sub }], { ctr: true, sb: 0, sa: 60 }),
    // Contact info row 1 (invisible table for alignment)
    new Table({
      columnWidths: [cw, cw, cw],
      rows: [
        new TableRow({ children: [
          lc("电话：18651650978", cw, { ctr: true }),
          lc("邮箱：dswcpp@gmail.com", cw, { ctr: true }),
          lc("居住地：南京市江宁区", cw, { ctr: true }),
        ]}),
        new TableRow({ children: [
          lc("工作经验：5年", cw, { ctr: true }),
          lc("期望薪资：22K-30K", cw, { ctr: true }),
          lc("代码仓库：gitee.com/beipiao_boy", cw, { ctr: true }),
        ]}),
      ],
    }),
  ];
}

function buildEducation() {
  return [
    secTitle("教育背景"),
    subHead([
      { text: "江西农业大学" },
      { text: "  |  软件工程（本科）  |  2017.09 - 2021.07", c: C.sub },
    ]),
    bl([{ text: "专业排名：", b: true }, { text: "5/37" }]),
    bl([{ text: "主修课程：", b: true }, { text: "C/C++程序设计、数据结构、操作系统原理、计算机网络、数据库系统原理、软件工程、编译原理" }]),
    bl([{ text: "获奖情况：", b: true }, { text: "多次一等/二等奖学金，全国C语言技能竞赛三等奖" }]),
  ];
}

function buildSkills() {
  return [
    secTitle("专业技能"),

    p("编程语言与框架", { b: true, sb: 100, sa: 30 }),
    bl([{ text: "C/C++：", b: true }, { text: "熟悉C++11/14/17标准，STL容器与算法，智能指针（shared_ptr/unique_ptr/weak_ptr），RAII资源管理，移动语义与完美转发" }]),
    bl([{ text: "Qt/C++：", b: true }, { text: "信号槽机制与底层原理，QThread多线程编程，Model/View架构，自定义控件开发，跨平台GUI开发" }]),
    bl([{ text: "嵌入式C/C++：", b: true }, { text: "具备嵌入式上位机开发经验，熟悉资源受限环境下的代码优化" }]),

    p("通信协议与网络编程", { b: true, sb: 100, sa: 30 }),
    bl([{ text: "网络编程：", b: true }, { text: "TCP/UDP Socket编程，HTTP协议，select/epoll多路复用" }]),
    bl([{ text: "设备通信：", b: true }, { text: "USB/串口通信，RS485总线，Modbus RTU/TCP协议" }]),
    bl([{ text: "物联网协议：", b: true }, { text: "MQTT协议，发布/订阅模式，QoS等级" }]),

    p("软件设计与工程实践", { b: true, sb: 100, sa: 30 }),
    bl([{ text: "设计模式：", b: true }, { text: "状态机模式、生产者-消费者模式、工厂模式、观察者模式、适配器模式" }]),
    bl([{ text: "并发编程：", b: true }, { text: "多线程同步（互斥锁、条件变量、读写锁），无锁队列（SPSC），线程池" }]),
    bl([{ text: "性能优化：", b: true }, { text: "性能瓶颈定位，内存优化，CPU占用分析，UI刷新频率控制" }]),

    p("专业软件与工具", { b: true, sb: 100, sa: 30 }),
    bl([{ text: "机器视觉：", b: true }, { text: "Halcon图像处理与模式识别，OpenCV计算机视觉算法" }]),
    bl([{ text: "信号处理：", b: true }, { text: "FFT频谱分析，PRPS模式识别，实时数据采集与处理" }]),
    bl([{ text: "开发工具：", b: true }, { text: "Git版本控制，VS/Qt Creator，交叉编译环境搭建" }]),
    bl([{ text: "AI辅助开发：", b: true }, { text: "熟练使用GitHub Copilot、Cursor等AI编程工具提升开发效率与代码质量" }]),
    bl([{ text: "语言能力：", b: true }, { text: "英语良好，能够阅读英文技术文档与SDK文档" }]),
  ];
}

function buildWork() {
  return [
    secTitle("工作经历"),

    // === Company 1 ===
    subHead([
      { text: "南京华乘电气技术有限公司" },
      { text: "  |  嵌入式应用开发工程师（中级）  |  2023.04 - 至今", c: C.sub },
    ]),
    p([{ text: "部门：", b: true }, { text: "开发部    " }, { text: "角色：", b: true }, { text: "核心模块负责人" }], { sb: 20, sa: 40 }),
    p("工作职责：", { b: true, sb: 60, sa: 20 }),
    bl("主导T95带电检测终端的软件架构设计，统筹红外、UHF、TEV、AE四大检测模块的集成与交付"),
    bl("负责实时数据管线架构设计与性能优化，保障采集、处理、展示全链路的稳定性与效率"),
    bl("制定检测模块接口规范与通信协议标准，协调硬件团队完成软硬件联调"),
    bl("指导2名初级工程师，建立代码审核流程，推动团队编码规范化"),
    p("核心成果：", { b: true, sb: 60, sa: 20 }),
    bl([{ text: "数据管线重构：", b: true }, { text: "重新设计采集→处理→展示三级管线，引入SPSC无锁队列与控频刷新机制，UI延迟从200ms降至50ms，CPU峰值占用降低40%" }]),
    bl([{ text: "模块化集成框架：", b: true }, { text: "主导设计统一检测模块接口规范，先后完成5种检测技术接入，集成周期从3个月压缩至50天" }]),
    bl([{ text: "通信协议重构：", b: true }, { text: "统一串口/USB帧格式，引入状态机解析与CRC校验、超时重传机制，解决多设备并发通信的丢帧与乱序问题" }]),
    bl([{ text: "红外模块快速交付：", b: true }, { text: "独立完成红外SDK调研、适配与联调，2周内交付伪彩图显示、温度标定与最高温追踪功能" }]),

    // === Company 2 ===
    subHead([
      { text: "江苏思行达信息技术有限公司" },
      { text: "  |  C++开发工程师  |  2022.04 - 2023.04", c: C.sub },
    ]),
    p([{ text: "部门：", b: true }, { text: "开发部    " }, { text: "角色：", b: true }, { text: "开发工程师" }], { sb: 20, sa: 40 }),
    p("工作职责：", { b: true, sb: 60, sa: 20 }),
    bl("开发柜外交互终端Windows中转服务，实现终端设备与后台系统间的协议转换与数据转发"),
    bl("负责营业厅智能运营平台的HTTP服务与物联控制模块开发，搭建ARM交叉编译环境"),
    bl("参与上位机软件架构设计与多款智能设备的驱动适配开发"),
    bl("编写需求分析说明书与详细设计文档，参与技术方案评审"),
    p("核心成果：", { b: true, sb: 60, sa: 20 }),
    bl([{ text: "中转服务重构：", b: true }, { text: "抽取公共通信层与协议解析模块，代码复用率提升20%，线上故障率降低约15%" }]),
    bl([{ text: "通信链路优化：", b: true }, { text: "优化驱动层与应用层通信机制，引入异步I/O与缓冲策略，响应时间从100ms降至60ms" }]),
    bl([{ text: "统一设备接入框架：", b: true }, { text: "参与设计适配器模式的设备管理框架，支持15+种硬件设备即插即用，新设备接入周期缩短50%" }]),

    // === Company 3 ===
    subHead([
      { text: "江西威力固智能设备有限公司" },
      { text: "  |  C++开发工程师（初级）  |  2020.10 - 2022.03", c: C.sub },
    ]),
    p([{ text: "部门：", b: true }, { text: "开发部    " }, { text: "角色：", b: true }, { text: "初级开发工程师" }], { sb: 20, sa: 40 }),
    p("工作职责：", { b: true, sb: 60, sa: 20 }),
    bl("负责PCB文字喷墨机W3000上位机的功能模块开发与维护，独立完成打印控制、字符编辑等模块"),
    bl("基于Halcon和OpenCV开发机器视觉算法，实现Mark点定位与字符识别功能"),
    bl("参与上位机与下位控制器的通信协议优化与软硬件联调"),
    p("核心成果：", { b: true, sb: 60, sa: 20 }),
    bl([{ text: "Mark点定位算法：", b: true }, { text: "基于Halcon开发Mark点识别与定位算法，实现预处理、特征提取、坐标变换全流程，精度达\u00B10.05mm" }]),
    bl([{ text: "视觉功能开发：", b: true }, { text: "使用OpenCV实现字符识别、畸变校正、图像增强等功能，支持多种PCB板型的自动适配" }]),
  ];
}

function buildProjects() {
  return [
    secTitle("项目经验"),

    // ========== Project 1: T95 ==========
    subHead([{ text: "项目一：带电检测手持移动终端（T95）" }]),
    p([
      { text: "2023.04 - 至今", b: true }, { text: "  |  南京华乘电气技术有限公司  |  开发团队12人，用户500+  |  ", c: C.sub },
      { text: "核心模块负责人", b: true },
    ], { sb: 20, sa: 40 }),
    p([{ text: "项目背景：", b: true }, { text: "该项目是一款多功能电力设备带电检测终端，集成了红外测温、超高频（UHF）局部放电检测、暂态地电压（TEV）检测、声发射（AE）检测等多种检测技术。系统用于电力设备状态监测和故障诊断，帮助电力工作人员及时发现设备潜在故障，预防电气事故发生。" }]),
    p([{ text: "技术栈：", b: true }, { text: "Qt/C++、信号槽机制、QThread多线程、状态机模式、生产者-消费者模式、SPSC无锁队列、USB/串口通信、PRPS模式识别、FFT频谱分析" }], { sb: 40, sa: 40 }),
    p("负责内容：", { b: true, sb: 40, sa: 20 }),
    nlBold("多检测技术集成框架：", "设计基于抽象接口的检测模块规范，定义采集→预处理→特征提取→展示的标准流水线，通过工厂模式实现模块运行时注册与热插拔", "p1"),
    nlBold("TEV暂态地电压检测模块：", "实现1MHz采样率的高速脉冲采集，设计环形缓冲区管理波形数据，开发PRPS二维图谱生成算法，支持放电类型模式识别与严重程度评估", "p1"),
    nlBold("红外成像模块集成：", "基于四状态状态机（断开→连接中→已连接→异常）管理设备生命周期，封装厂商SDK实现伪彩映射、温度标定与最高温追踪，从调研到交付仅用2周", "p1"),
    nlBold("UHF超高频数据处理：", "重构FFT频谱分析流程，优化内存分配与计算路径，减少数据拷贝次数，提升特征提取的实时性", "p1"),
    nlBold("实时数据管线重构：", "将采集、处理、UI解耦为三级流水线，采集→处理间使用SPSC无锁队列避免锁开销，处理→UI间采用控频策略（30fps上限），消除UI阻塞采集的问题", "p1"),
    p("项目难点与解决方案：", { b: true, sb: 40, sa: 20 }),
    bl([{ text: "异构数据同步：", b: true }, { text: "各检测模块数据格式与采样率差异大，设计DataAdapter转换层统一格式，引入时间戳对齐算法，通过异步队列缓冲不同速率的数据流" }]),
    bl([{ text: "实时处理瓶颈：", b: true }, { text: "三级生产者-消费者架构 + SPSC无锁队列避免mutex开销 + UI控频30fps刷新，整体延迟从200ms降至50ms" }]),
    bl([{ text: "设备连接不稳定：", b: true }, { text: "四状态状态机管理连接生命周期，实现指数退避重连、心跳超时检测与异常自动恢复" }]),
    bl([{ text: "跨平台部署：", b: true }, { text: "基于Qt抽象层隔离平台差异，抽取串口/USB/文件系统等可移植组件库，实现Linux与Windows双平台部署" }]),
    p("项目成果：", { b: true, sb: 40, sa: 20 }),
    bl("先后完成5种检测技术接入，集成周期从3个月压缩至50天，加速产品功能迭代"),
    bl("检测准确率超过92%，已获得多家电力企业客户采购并稳定运行"),
    bl("现场故障率从月均3次降至0.5次，产品稳定性达到商用交付标准"),
    bl("通过AI辅助工具与标准化开发流程，团队整体开发效率提升约20%"),

    // ========== Project 2: 营业厅 ==========
    subHead([{ text: "项目二：营业厅智能运营管理平台" }]),
    p([
      { text: "2023.01 - 2023.04", b: true }, { text: "  |  江苏思行达信息技术有限公司  |  团队5人，用户300+  |  ", c: C.sub },
      { text: "负责HTTP服务器与物联控制模块", b: true },
    ], { sb: 20, sa: 40 }),
    p([{ text: "项目背景：", b: true }, { text: "对营业厅综合管理平台进行升级改造，主要对系统UI、看板模块、物联控制模块和宣传展示模块进行改造，实现营业厅设备的集中监控与管理。" }]),
    p([{ text: "技术栈：", b: true }, { text: "TCP/IP协议、Socket网络编程、多线程、HTTP服务器、MQTT通信、RS485/Modbus通信" }], { sb: 40, sa: 40 }),
    p("负责内容：", { b: true, sb: 40, sa: 20 }),
    nlBold("交叉编译环境搭建：", "在Ubuntu 20.04下完成RK3399（ARM64）交叉编译工具链搭建，移植Qt运行时库与第三方依赖，解决动态库版本冲突问题", "p2"),
    nlBold("HTTP服务器开发：", "基于Socket与事件驱动实现轻量级HTTP服务器，提供设备查询、指令下发、状态上报等RESTful API，支持100+并发连接", "p2"),
    nlBold("MQTT设备监控：", "设计分层Topic命名规范，实现设备上下线检测、状态变更推送与异常告警", "p2"),
    nlBold("RS485设备通信：", "实现Modbus RTU协议栈解析，设计适配器模式封装不同厂商设备的寄存器映射差异，实现统一设备管理", "p2"),
    p("项目难点与解决方案：", { b: true, sb: 40, sa: 20 }),
    bl([{ text: "异构设备协议适配：", b: true }, { text: "设计Adapter模式抽象统一设备接口（连接/读取/写入/断开），各厂商设备实现独立适配层，新设备接入只需编写适配器" }]),
    bl([{ text: "ARM平台资源受限：", b: true }, { text: "采用事件驱动替代多线程模型，复用Socket连接池，降低内存与CPU开销" }]),
    bl([{ text: "长期运行稳定性：", b: true }, { text: "实现软件看门狗与异常捕获机制，配合分级日志系统支持远程问题定位" }]),
    p("项目成果：", { b: true, sb: 40, sa: 20 }),
    bl("系统支持100+终端设备同时接入，响应时间控制在150ms内"),
    bl("营业厅设备管理效率提升20%，获得客户认可"),

    // ========== Project 3: 柜外交互 ==========
    subHead([{ text: "项目三：柜外交互终端" }]),
    p([
      { text: "2022.03 - 2022.12", b: true }, { text: "  |  江苏思行达信息技术有限公司  |  团队5人，用户10000+  |  ", c: C.sub },
      { text: "负责Windows中转服务开发", b: true },
    ], { sb: 20, sa: 40 }),
    p([{ text: "项目背景：", b: true }, { text: "面向银行与电网营业厅的柜外交互终端，集成密码键盘、IC卡读写、二代证识别、电磁签名等外设模块。交易过程中将电子工牌、业务类型、账号、金额等关键信息同步显示于终端屏幕，辅助柜面业务办理。" }]),
    p([{ text: "技术栈：", b: true }, { text: "TCP/IP协议、Socket网络编程、多线程、USB通信、MQTT通信、硬件驱动、银联交易接口" }], { sb: 40, sa: 40 }),
    p("负责内容：", { b: true, sb: 40, sa: 20 }),
    nlBold("Windows中转服务：", "设计进程级中转服务架构，实现终端设备与后台交易系统间的双向数据转发与协议适配", "p3"),
    nlBold("多线程通信框架：", "基于消息队列开发异步通信框架，支持同步请求与异步通知两种模式，解耦业务逻辑与设备I/O", "p3"),
    nlBold("外设驱动集成：", "封装密码键盘、IC卡读卡器、二代证读取器等多种外设驱动，提供统一设备抽象层", "p3"),
    nlBold("日志与监控：", "开发分级日志系统（DEBUG/INFO/WARN/ERROR），支持按日滚动与远程上报，配合监控模块实现异常实时告警", "p3"),
    p("项目难点与解决方案：", { b: true, sb: 40, sa: 20 }),
    bl([{ text: "金融级安全要求：", b: true }, { text: "交易报文AES加密传输，敏感字段（卡号、密码）脱敏处理，保障数据全链路安全" }]),
    bl([{ text: "弱网环境可靠性：", b: true }, { text: "设计消息持久化队列，实现断点续传与自动重发机制，确保交易报文不丢失" }]),
    bl([{ text: "多设备并发竞争：", b: true }, { text: "基于优先级消息队列调度设备访问，通过互斥锁保护共享资源，避免外设访问冲突" }]),
    p("项目成果：", { b: true, sb: 40, sa: 20 }),
    bl("系统部署于多个国家电网与银行营业厅网点，支撑日均万级交易量的稳定运行"),
    bl("交互终端简化柜面业务流程，缩短单笔业务办理时间，获得终端用户认可"),

    // ========== Project 4: PCB二维码 ==========
    subHead([{ text: "项目四：PCB板二维码激光打印机" }]),
    p([
      { text: "2022.07 - 2022.12", b: true }, { text: "  |  江苏思行达信息技术有限公司  |  团队6人，用户50+  |  ", c: C.sub },
      { text: "负责图像处理模块", b: true },
    ], { sb: 20, sa: 40 }),
    p([{ text: "项目背景：", b: true }, { text: "在PCB板白油块上打印二维码的激光打印设备，需要精确的Mark点定位与二维码生成功能。" }]),
    p([{ text: "技术栈：", b: true }, { text: "HTTP通信、Socket网络编程、Halcon图像处理、二维码生成算法" }], { sb: 40, sa: 40 }),
    p("负责内容：", { b: true, sb: 40, sa: 20 }),
    nlBold("Mark点识别算法：", "基于Halcon开发Mark点识别算法，实现降噪→增强→二值化→特征提取全流程，定位精度达\u00B10.05mm", "p4"),
    nlBold("图像校正：", "开发畸变校正与透视变换算法，完成相机标定与图像坐标系到物理坐标系的转换", "p4"),
    nlBold("二维码生成模块：", "开发二维码内容生成与格式控制模块，集成质量检测与纠错等级配置", "p4"),
    nlBold("通信接口：", "开发上位机与激光控制系统的通信接口，实现打印任务调度与实时状态反馈", "p4"),
    p("项目成果：", { b: true, sb: 40, sa: 20 }),
    bl("系统打印精度达\u00B10.05mm，二维码读取成功率超过95%"),
    bl("打印效率提升30%，优化客户生产流程"),

    // ========== Project 5: PCB喷墨机 ==========
    subHead([{ text: "项目五：PCB板文字喷墨机W3000" }]),
    p([
      { text: "2020.11 - 2022.03", b: true }, { text: "  |  江西威力固智能设备有限公司  |  团队8人，用户100+家PCB制造企业  |  ", c: C.sub },
      { text: "初级开发工程师", b: true },
    ], { sb: 20, sa: 40 }),
    p([{ text: "项目背景：", b: true }, { text: "PCB字符喷印机适用于PCB/FPC字符、IC载板标识和LED背光喷印加工，替代传统丝网印刷工艺。" }]),
    p([{ text: "技术栈：", b: true }, { text: "TCP/IP协议、Socket网络编程、多线程、USB通信、Halcon、OpenCV" }], { sb: 40, sa: 40 }),
    p("负责内容：", { b: true, sb: 40, sa: 20 }),
    bl("参与打印控制模块日常维护与Bug修复，提升系统运行稳定性"),
    bl("基于OpenCV开发字符识别与图像预处理功能，支持多种PCB板型适配"),
    bl("协助实现多喷头并行控制逻辑与喷印调度算法"),
    bl("参与字符编辑界面开发，优化操作流程与用户交互体验"),
    p("项目成果：", { b: true, sb: 40, sa: 20 }),
    bl("系统稳定服务于100+家PCB制造企业，打印精度与速度满足行业标准"),
    bl("独立完成多个功能模块，积累了上位机开发与机器视觉的工程实践经验"),
  ];
}

function buildSelfEval() {
  return [
    secTitle("自我评价"),
    p("5年C++/Qt工业软件开发经验，专注于实时数据处理与设备通信方向。从初级工程师成长为核心模块负责人，经历过PCB工业设备、营业厅物联平台、电力检测终端等多个产品的完整研发周期，具备独立承担模块级架构设计与交付的能力。", { sb: 80 }),
    p("技术特点：", { b: true, sb: 80, sa: 20 }),
    bl("有实际性能调优经验，通过日志分析与profiling定位瓶颈，在T95项目中将UI延迟从200ms优化至50ms"),
    bl("熟悉多种设备通信协议（串口、USB、RS485、Modbus、MQTT），具备快速对接新硬件的能力"),
    bl("注重工程质量，主动沉淀排查记录与可复用组件，在团队内推动代码审核与编码规范"),
    bl("善于利用AI辅助工具提升效率，将重复性编码与代码审查工作部分自动化"),
    p("工作风格：", { b: true, sb: 60, sa: 20 }),
    bl("习惯先搭建最小可行原型验证技术方案，再逐步迭代完善，红外模块2周交付即为此方法的实践"),
    bl("有带人经验，指导过2名初级工程师完成模块开发，注重代码审核中的知识传递与能力培养"),
  ];
}

function buildOther() {
  return [
    secTitle("其他信息"),
    bl([{ text: "智能家居实践：", b: true }, { text: "业余使用ESP32 + MQTT + 树莓派搭建智能家居系统，覆盖照明控制与环境监测，与本职工作的物联网技术相互印证" }]),
    bl([{ text: "技术分享：", b: true }, { text: "在公司内部主讲过「C++性能优化实践」「状态机在设备管理中的应用」等技术分享" }]),
    bl([{ text: "持续学习：", b: true }, { text: "保持技术阅读习惯，近期关注C++20协程、嵌入式系统安全等方向" }]),
    bl([{ text: "户外运动：", b: true }, { text: "骑行与登山爱好者，注重体能保持" }]),
  ];
}

// ==================== Main ====================
async function main() {
  const doc = new Document({
    styles: {
      default: { document: { run: { font: F, size: 21, color: C.txt } } },
    },
    numbering: {
      config: [
        { reference: "bl", levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 420, hanging: 210 } } } }] },
        { reference: "p1", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 420, hanging: 210 } } } }] },
        { reference: "p2", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 420, hanging: 210 } } } }] },
        { reference: "p3", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 420, hanging: 210 } } } }] },
        { reference: "p4", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 420, hanging: 210 } } } }] },
      ],
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1000, right: 1134, bottom: 1000, left: 1134 },
          size: { width: 11906, height: 16838 },
        },
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: "- ", font: F, size: 16, color: C.sub }),
              new TextRun({ children: [PageNumber.CURRENT], font: F, size: 16, color: C.sub }),
              new TextRun({ text: " / ", font: F, size: 16, color: C.sub }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], font: F, size: 16, color: C.sub }),
              new TextRun({ text: " -", font: F, size: 16, color: C.sub }),
            ],
          })],
        }),
      },
      children: [
        ...buildHeader(),
        ...buildEducation(),
        ...buildSkills(),
        ...buildWork(),
        ...buildProjects(),
        ...buildSelfEval(),
        ...buildOther(),
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  const outPath = __dirname + "/段胜炜_C++开发工程师_简历.docx";
  fs.writeFileSync(outPath, buffer);
  console.log("简历生成完成：" + outPath);
}

main().catch(err => { console.error("生成失败:", err); process.exit(1); });
