/**
 * 批量为 question.json 的 answer 字段中的重点内容加粗
 * 覆盖：技术术语、数据指标、关键结论
 */
const fs = require('fs');
const path = require('path');
const BASE = __dirname;
let total = 0, modified = 0;

// ========== 要加粗的技术术语清单 ==========
const TERMS = [
    // C++ 核心
    'vtable', 'vptr', 'RAII', 'RTTI',
    '虚函数表', '虚指针', '虚析构函数',
    'shared_ptr', 'unique_ptr', 'weak_ptr', 'make_shared', 'make_unique',
    '引用计数', '循环引用', '控制块',
    '移动语义', '完美转发', '右值引用', '万能引用',
    'std::move', 'std::forward',
    'memory_order', 'memory_order_relaxed', 'memory_order_acquire', 'memory_order_release',
    'CAS', 'compare_exchange',
    '深拷贝', '浅拷贝', '拷贝构造', '赋值运算符',
    '异常安全', '强异常保证', '基本保证', '无异常保证',
    'noexcept', 'constexpr', 'auto', 'decltype',
    'lambda', 'std::function', 'std::bind',
    'emplace_back', 'reserve', 'shrink_to_fit',
    '红黑树', '哈希表', '哈希冲突',
    '迭代器失效',
    'false sharing', '缓存行', 'cache line',
    'ABA问题',
    // 多线程
    'mutex', 'lock_guard', 'unique_lock', 'shared_lock',
    'condition_variable', '条件变量',
    '读写锁', '自旋锁', '死锁',
    'atomic', '原子操作', '内存序', '内存屏障',
    '无锁队列', 'SPSC', 'MPMC', 'lock-free',
    '线程池', '线程安全',
    // Qt
    '信号槽', 'moc', '元对象系统', 'Meta-Object',
    'QueuedConnection', 'DirectConnection', 'AutoConnection',
    'moveToThread', 'Worker模式',
    'Model/View', 'QAbstractItemModel',
    '对象树', 'deleteLater',
    'QSignalSpy',
    'paintEvent', 'update()',
    // 网络通信
    '三次握手', '四次挥手', 'TIME_WAIT', 'SYN', 'ACK', 'FIN',
    '粘包', '拆包',
    'epoll', 'select', 'poll', 'I/O多路复用',
    'Reactor模式', '事件驱动',
    'RESTful',
    'QoS', 'Topic',
    '发布/订阅', '发布订阅',
    'Modbus RTU', 'Modbus TCP',
    'RS485', 'RS232',
    'CRC校验', 'CRC', '超时重传', '超时重试',
    '帧格式', '状态机解析',
    // 设计模式
    '状态机', '状态模式',
    '生产者-消费者', '生产者消费者',
    '观察者模式', '工厂模式', '单例模式', '适配器模式',
    '策略模式', '模板方法',
    '松耦合', '高内聚',
    '依赖注入', '控制反转',
    '热插拔',
    // 嵌入式/性能
    '环形缓冲区', 'ring buffer',
    '控频刷新', '帧率控制',
    '看门狗', 'watchdog',
    '交叉编译', 'sysroot',
    '零拷贝', 'zero-copy',
    '内存池', '对象池',
    'profiling', '火焰图',
    // 机器视觉
    'FFT', '傅里叶变换', '频谱分析',
    'PRPS', '相位分辨',
    '模板匹配', '亚像素',
    'Mark点', '相机标定', '畸变校正', '透视变换',
    '二值化', '形态学', '连通域',
    '降噪', '高斯滤波', '中值滤波',
    'OTSU', 'CLAHE',
    // 安全
    'AES', 'AES加密', 'TLS',
    '数据脱敏',
    '消息持久化', '断点续传',
    '幂等性',
    // 项目关键词
    '三级流水线', '三级管线',
    'DataAdapter', '转换层',
    '指数退避', '心跳超时',
    '伪彩图', '温度标定',
];

// ========== 工具函数 ==========
function findQuestionFiles(dir) {
    const r = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory() && !e.name.startsWith('_')) r.push(...findQuestionFiles(full));
        else if (e.name === 'question.json') r.push(full);
    }
    return r;
}

function boldifyAnswer(answer) {
    if (!answer) return answer;

    // 1. 分割代码块（保护不修改）
    const codeBlocks = [];
    let processed = answer.replace(/(```[\s\S]*?```|`[^`\n]+`)/g, (m) => {
        codeBlocks.push(m);
        return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
    });

    // 2. 分割已有的 ** ** 区域（保护不修改）
    const bolds = [];
    processed = processed.replace(/\*\*[^*]+\*\*/g, (m) => {
        bolds.push(m);
        return `__BOLD_${bolds.length - 1}__`;
    });

    // 3. 加粗技术术语（只加粗首次出现）
    const usedTerms = new Set();
    for (const term of TERMS) {
        if (usedTerms.has(term.toLowerCase())) continue;
        // 转义正则特殊字符
        const escaped = term.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
        // 匹配整词（中文不需要词边界，英文用\b）
        const isChinese = /[\u4e00-\u9fff]/.test(term);
        const pattern = isChinese
            ? new RegExp(escaped, 'g')
            : new RegExp(`\\b${escaped}\\b`, 'gi');

        let matched = false;
        processed = processed.replace(pattern, (m, offset) => {
            if (matched) return m; // 只加粗首次
            // 检查前后是否已在占位符内
            const before20 = processed.substring(Math.max(0, offset - 20), offset);
            if (before20.includes('__BOLD_') || before20.includes('__CODE_')) return m;
            matched = true;
            usedTerms.add(term.toLowerCase());
            bolds.push(`**${m}**`);
            return `__BOLD_${bolds.length - 1}__`;
        });
    }

    // 4. 加粗数据指标
    // 改进模式：从X降至Y
    processed = processed.replace(
        /从(\d+(?:\.\d+)?(?:ms|s|MHz|MB\/s|fps|KB|MB|GB|mm|个月|天|次|%))\s*(降至|降到|优化至|优化到|缩短至|缩短到|压缩至|压缩到|减少到|提升至|提升到)\s*(\d+(?:\.\d+)?(?:ms|s|MHz|MB\/s|fps|KB|MB|GB|mm|个月|天|次|%))/g,
        (m) => { bolds.push(`**${m}**`); return `__BOLD_${bolds.length - 1}__`; }
    );

    // 百分比提升
    processed = processed.replace(
        /(提升|降低|缩短|减少|提高|压缩|降低约|减少了|提升了|提高了|降低了|缩短了)\s*(约?\s*\d+(?:\.\d+)?[%倍])/g,
        (m, verb, num) => {
            bolds.push(`**${m}**`);
            return `__BOLD_${bolds.length - 1}__`;
        }
    );

    // 独立数据（带单位的数字）
    processed = processed.replace(
        /(?<!\d)(\d+(?:\.\d+)?(?:ms|MHz|MB\/s|fps))\b/g,
        (m, num, offset) => {
            const before = processed.substring(Math.max(0, offset - 10), offset);
            if (before.includes('__BOLD_') || before.includes('__CODE_')) return m;
            bolds.push(`**${m}**`);
            return `__BOLD_${bolds.length - 1}__`;
        }
    );

    // ±精度值
    processed = processed.replace(
        /(?<!\*\*)(±\d+(?:\.\d+)?mm)/g,
        (m) => { bolds.push(`**${m}**`); return `__BOLD_${bolds.length - 1}__`; }
    );

    // 5. 还原占位符
    processed = processed.replace(/__BOLD_(\d+)__/g, (_, i) => bolds[parseInt(i)]);
    processed = processed.replace(/__CODE_BLOCK_(\d+)__/g, (_, i) => codeBlocks[parseInt(i)]);

    // 6. 清理重复加粗
    processed = processed.replace(/\*{3,}([^*]+)\*{3,}/g, '**$1**');

    return processed;
}

// ========== 主流程 ==========
const files = findQuestionFiles(BASE);
console.log(`找到 ${files.length} 个 question.json`);

for (const file of files) {
    total++;
    try {
        let raw = fs.readFileSync(file, 'utf-8');
        if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
        const data = JSON.parse(raw);
        if (!data.answer) continue;

        const original = data.answer;
        data.answer = boldifyAnswer(data.answer);

        if (data.answer !== original) {
            fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
            modified++;
            console.log(`  ✓ ${path.relative(BASE, file)}`);
        }
    } catch (e) {
        console.warn(`  ✗ ${path.relative(BASE, file)}: ${e.message}`);
    }
}
console.log(`\n完成：${total} 个文件，${modified} 个被修改`);
