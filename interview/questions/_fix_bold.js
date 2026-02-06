/**
 * 修复加粗脚本的数字断裂问题
 * 1**5ms** → **15ms**, 3**3ms** → **33ms**, etc.
 */
const fs = require('fs');
const path = require('path');

const BASE = __dirname;
let fixed = 0;

function findQuestionFiles(dir) {
    const results = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory() && !e.name.startsWith('_')) results.push(...findQuestionFiles(full));
        else if (e.name === 'question.json') results.push(full);
    }
    return results;
}

for (const file of findQuestionFiles(BASE)) {
    let raw = fs.readFileSync(file, 'utf-8');
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
    
    try {
        const data = JSON.parse(raw);
        if (!data.answer) continue;

        const original = data.answer;
        let answer = data.answer;

        // Fix split numbers: 1**5ms** → **15ms**
        answer = answer.replace(
            /(\d)\*\*(\d+(?:\.\d+)?(?:ms|MHz|MB\/s|fps|KB|MB|GB|mm|%))\*\*/g,
            '**$1$2**'
        );
        // Fix cases like 1**2MB** 
        answer = answer.replace(
            /(\d)\*\*(\d+(?:\.\d+)?(?:ms|MHz|MB\/s|fps|KB|MB|GB|mm|%))\*\*/g,
            '**$1$2**'
        );
        // Fix nested/redundant bold: ****text**** → **text**
        answer = answer.replace(/\*{3,}([^*]+)\*{3,}/g, '**$1**');

        if (answer !== original) {
            data.answer = answer;
            fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
            fixed++;
            console.log('  ✓', path.relative(BASE, file));
        }
    } catch (e) {
        console.warn('  ✗', path.relative(BASE, file), e.message);
    }
}
console.log(`\n修复完成：${fixed} 个文件`);
