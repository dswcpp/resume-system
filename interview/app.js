/**
 * 面试模拟自测系统 - 核心逻辑
 * 纯前端，localStorage 存储进度
 */

// 不再需要硬编码分类列表，由 index.json 驱动

const STORAGE_KEY = 'interview_progress';

/* ===== 主应用类 ===== */
class InterviewApp {
    constructor() {
        this.categories = [];         // 所有分类数据
        this.progress = {};           // 进度 { qid: { status, lastPracticed, count } }
        this.currentCategory = null;  // 当前分类 key
        this.currentQuestions = [];   // 当前筛选后的题目列表
        this.currentIndex = 0;        // 当前题目索引
        this.answerRevealed = false;
        this.detailCache = {};        // 详解缓存 { "catKey/qid": markdownText }
        this.init();
    }

    /* ---------- 初始化 ---------- */
    async init() {
        this.loadProgress();
        await this.loadAllCategories();
        this.renderHome();

        // Mermaid 初始化
        mermaid.initialize({
            startOnLoad: false,
            theme: 'default',
            flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis' },
            sequence: { useMaxWidth: true },
            themeVariables: {
                primaryColor: '#dbeafe',
                primaryBorderColor: '#2563eb',
                primaryTextColor: '#1e293b',
                lineColor: '#64748b',
                secondaryColor: '#f0fdf4',
                tertiaryColor: '#f8f9fb'
            }
        });
        this._mermaidId = 0;

        // 配置 marked：识别 mermaid 代码块
        const defaultRenderer = new marked.Renderer();
        const self = this;
        // 兼容 marked v12 的多种参数格式
        defaultRenderer.code = function(tokenOrText, maybeLang) {
            let text, lang;
            if (typeof tokenOrText === 'object' && tokenOrText !== null) {
                text = tokenOrText.text || tokenOrText.code || '';
                lang = tokenOrText.lang || tokenOrText.language || '';
            } else {
                text = tokenOrText || '';
                lang = maybeLang || '';
            }

            // 检测 mermaid：通过 lang 标记或内容自动识别
            const mermaidKeywords = /^(classDiagram|sequenceDiagram|flowchart|graph\s|pie|gantt|erDiagram|stateDiagram)/;
            const isMermaid = lang === 'mermaid' || (!lang && mermaidKeywords.test(text.trim()));

            if (isMermaid) {
                const id = 'mermaid-' + (self._mermaidId++);
                return '<div class="mermaid-placeholder" data-id="' + id + '" data-graph="' +
                    text.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;') +
                    '"></div>';
            }
            // 普通代码块
            let highlighted = text;
            if (lang && hljs.getLanguage(lang)) {
                highlighted = hljs.highlight(text, { language: lang }).value;
            } else {
                highlighted = hljs.highlightAuto(text).value;
            }
            return '<pre><code class="hljs language-' + (lang || '') + '">' + highlighted + '</code></pre>';
        };
        marked.setOptions({ breaks: true, gfm: true, renderer: defaultRenderer });
    }

    async loadAllCategories() {
        // 检测是否通过 file:// 协议打开
        if (window.location.protocol === 'file:') {
            this.showFileProtocolWarning();
            return;
        }

        try {
            // 从 index.json 一次性加载所有分类和题目索引
            const resp = await fetch('questions/index.json');
            if (!resp.ok) throw new Error(resp.statusText);
            const index = await resp.json();

            this.categories = index.categories.map(cat => ({
                category: cat.name,
                icon: cat.icon,
                questions: cat.questions, // 仅含 id/question/tags/difficulty，不含 answer
                _key: cat.key
            }));
        } catch (e) {
            console.error('加载题库索引失败:', e);
            this.categories = [];
        }
    }

    /** 按需加载单题的完整数据（answer 字段） */
    async loadQuestionAnswer(qid, catKey) {
        try {
            const resp = await fetch(`questions/${catKey}/${qid}/question.json`);
            if (!resp.ok) throw new Error(resp.statusText);
            const full = await resp.json();
            // 将 answer 合并到已有题目对象中
            const cat = this.categories.find(c => c._key === catKey);
            if (cat) {
                const q = cat.questions.find(q => q.id === qid);
                if (q) {
                    q.answer = full.answer;
                    q.hint = full.hint;
                    q.source = full.source;
                }
            }
            return full.answer;
        } catch (e) {
            console.warn('加载答案失败:', catKey, qid, e);
            return null;
        }
    }

    showFileProtocolWarning() {
        const grid = document.getElementById('category-grid');
        grid.innerHTML = `
            <div style="grid-column:1/-1;text-align:center;padding:40px 20px;color:var(--text-secondary)">
                <i class="fas fa-exclamation-circle" style="font-size:2.5rem;color:var(--warning-color);display:block;margin-bottom:16px"></i>
                <h3 style="margin-bottom:12px;color:var(--text-color)">需要通过 HTTP 服务器访问</h3>
                <p>由于浏览器安全策略，直接双击打开 HTML 文件无法加载题库数据。</p>
                <p style="margin-top:12px">请使用以下方式之一打开：</p>
                <div style="text-align:left;max-width:500px;margin:16px auto;background:var(--card-bg);padding:16px 20px;border-radius:12px;box-shadow:inset 2px 2px 4px var(--neu-shadow-dark),inset -2px -2px 4px var(--neu-shadow-light);font-size:0.85rem;line-height:2">
                    <code>python -m http.server 8080</code><br>
                    <code>npx http-server -p 8080</code><br>
                    然后访问 <code>http://localhost:8080</code>
                </div>
                <p style="margin-top:8px;font-size:0.8rem">或使用 VS Code 的 Live Server 扩展</p>
            </div>
        `;
    }

    /* ---------- 进度管理 ---------- */
    loadProgress() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            this.progress = raw ? JSON.parse(raw) : {};
        } catch {
            this.progress = {};
        }
    }

    saveProgress() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.progress));
    }

    getQuestionProgress(qid) {
        return this.progress[qid] || { status: 'unknown', lastPracticed: null, count: 0 };
    }

    setQuestionProgress(qid, status) {
        const prev = this.getQuestionProgress(qid);
        this.progress[qid] = {
            status: status,
            lastPracticed: new Date().toISOString().slice(0, 10),
            count: prev.count + 1
        };
        this.saveProgress();
    }

    /* ---------- 页面切换 ---------- */
    showPage(pageId) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(pageId).classList.add('active');
        // 关闭弹窗和详解面板
        document.getElementById('modal-overlay').classList.remove('show');
        document.getElementById('complete-overlay').classList.remove('show');
        if (pageId !== 'page-practice') this.hideDetail();
        window.scrollTo(0, 0);
    }

    goHome() {
        this.showPage('page-home');
        this.renderHome();
    }

    /* ---------- 首页渲染 ---------- */
    renderHome() {
        const grid = document.getElementById('category-grid');
        grid.innerHTML = '';

        this.categories.forEach(cat => {
            const total = cat.questions.length;
            const stats = this.getCategoryStats(cat);
            const practiced = stats.mastered + stats.fuzzy + stats.failed;
            const pct = total > 0 ? Math.round(practiced / total * 100) : 0;

            const card = document.createElement('div');
            card.className = 'category-card';
            card.onclick = () => this.startCategory(cat._key);
            card.innerHTML = `
                <div class="card-icon"><i class="fas ${cat.icon}"></i></div>
                <div class="card-title">${cat.category}</div>
                <div class="card-count">${total} 题 · 已练 ${practiced} 题 (${pct}%)</div>
                <div class="card-progress">
                    <div class="card-progress-fill progress-gradient" style="width:${pct}%"></div>
                </div>
                <div class="card-stats">
                    <span class="stat-mastered"><i class="fas fa-check-double"></i> ${stats.mastered}</span>
                    <span class="stat-fuzzy"><i class="fas fa-question"></i> ${stats.fuzzy}</span>
                    <span class="stat-failed"><i class="fas fa-times"></i> ${stats.failed}</span>
                </div>
            `;
            grid.appendChild(card);
        });
    }

    getCategoryStats(cat) {
        let mastered = 0, fuzzy = 0, failed = 0;
        cat.questions.forEach(q => {
            const s = this.getQuestionProgress(q.id).status;
            if (s === 'mastered') mastered++;
            else if (s === 'fuzzy') fuzzy++;
            else if (s === 'failed') failed++;
        });
        return { mastered, fuzzy, failed };
    }

    /* ---------- 开始练习 ---------- */
    startCategory(key) {
        this.currentCategory = key;
        const cat = this.categories.find(c => c._key === key);
        if (!cat) return;

        document.getElementById('practice-category-name').textContent = cat.category;
        document.getElementById('difficulty-filter').value = 'all';
        document.getElementById('status-filter').value = 'all';

        this.applyFilters();
        this.showPage('page-practice');
    }

    restartCategory() {
        document.getElementById('complete-overlay').classList.remove('show');
        if (this.currentCategory) {
            this.startCategory(this.currentCategory);
        }
    }

    applyFilters() {
        const cat = this.categories.find(c => c._key === this.currentCategory);
        if (!cat) return;

        const diffVal = document.getElementById('difficulty-filter').value;
        const statVal = document.getElementById('status-filter').value;

        let qs = cat.questions.slice();
        if (diffVal !== 'all') {
            qs = qs.filter(q => q.difficulty === parseInt(diffVal));
        }
        if (statVal !== 'all') {
            qs = qs.filter(q => this.getQuestionProgress(q.id).status === statVal);
        }

        this.currentQuestions = qs;
        this.currentIndex = 0;
        this.renderDots();
        this.renderQuestion();
    }

    filterByDifficulty() { this.applyFilters(); }
    filterByStatus()     { this.applyFilters(); }

    /* ---------- 题目渲染 ---------- */
    renderQuestion() {
        const qs = this.currentQuestions;
        if (qs.length === 0) {
            document.getElementById('question-card').innerHTML =
                '<div style="padding:60px;text-align:center;color:var(--text-secondary)">' +
                '<i class="fas fa-inbox" style="font-size:2rem;margin-bottom:12px;display:block"></i>' +
                '当前筛选条件下没有题目</div>';
            document.getElementById('practice-progress-bar').style.width = '0';
            document.getElementById('practice-progress-text').textContent = '0 / 0';
            return;
        }

        const q = qs[this.currentIndex];
        const prog = this.getQuestionProgress(q.id);

        // 恢复卡片结构（可能被"无题目"替换）
        this.ensureCardStructure();

        // 进度条
        const pct = Math.round((this.currentIndex + 1) / qs.length * 100);
        document.getElementById('practice-progress-bar').style.width = pct + '%';
        document.getElementById('practice-progress-text').textContent =
            `第 ${this.currentIndex + 1} / ${qs.length} 题`;

        // 前面部分
        document.getElementById('question-id').textContent = q.id;
        document.getElementById('question-difficulty').textContent =
            '⭐'.repeat(q.difficulty) + ' ' + ['', '基础', '中等', '深度'][q.difficulty];

        // tags
        const tagsEl = document.getElementById('question-tags');
        tagsEl.innerHTML = q.tags.map(t => `<span class="tag">${t}</span>`).join('');

        // 题目
        document.getElementById('question-text').textContent = q.question;

        // 提示（可能尚未加载）
        const hintBox = document.getElementById('hint-box');
        hintBox.style.display = 'none';
        hintBox.textContent = q.hint || '点击查看答案后加载提示';
        document.getElementById('btn-hint').style.display = '';

        // 隐藏答案
        document.getElementById('card-back').style.display = 'none';
        this.answerRevealed = false;

        // 详解面板已打开时，自动加载当前题的详解
        if (this.isDetailOpen) {
            this._renderDetailContent(q.id);
        }

        // 导航按钮状态
        document.getElementById('btn-prev').disabled = this.currentIndex === 0;
        document.getElementById('btn-next').disabled = this.currentIndex >= qs.length - 1;

        // 更新dots
        this.updateDots();
    }

    ensureCardStructure() {
        const card = document.getElementById('question-card');
        if (!document.getElementById('card-front')) {
            card.innerHTML = `
                <div class="card-front" id="card-front">
                    <div class="question-meta">
                        <span class="question-id" id="question-id"></span>
                        <span class="question-difficulty" id="question-difficulty"></span>
                    </div>
                    <div class="question-tags" id="question-tags"></div>
                    <div class="question-text" id="question-text"></div>
                    <div class="card-actions">
                        <button class="neu-btn btn-hint" id="btn-hint" onclick="app.showHint()">
                            <i class="fas fa-lightbulb"></i> 提示
                        </button>
                        <button class="neu-btn btn-reveal" onclick="app.revealAnswer()">
                            <i class="fas fa-eye"></i> 查看答案
                        </button>
                    </div>
                    <div class="hint-box" id="hint-box"></div>
                </div>
                <div class="card-back" id="card-back">
                    <div class="answer-header">
                        <span class="answer-label"><i class="fas fa-check-circle"></i> 参考答案</span>
                        <div class="answer-header-actions">
                            <button class="neu-btn btn-sm btn-detail" onclick="app.showDetail()">
                                <i class="fas fa-book-open"></i> 详解
                            </button>
                            <button class="neu-btn btn-sm" onclick="app.hideAnswer()">
                                <i class="fas fa-eye-slash"></i> 收起
                            </button>
                        </div>
                    </div>
                    <div class="answer-content" id="answer-content"></div>
                    <div class="self-rate">
                        <span class="rate-label">自我评估：</span>
                        <button class="rate-btn rate-mastered" onclick="app.rate('mastered')">
                            <i class="fas fa-check-double"></i> 熟练
                        </button>
                        <button class="rate-btn rate-fuzzy" onclick="app.rate('fuzzy')">
                            <i class="fas fa-question"></i> 模糊
                        </button>
                        <button class="rate-btn rate-failed" onclick="app.rate('failed')">
                            <i class="fas fa-times"></i> 不会
                        </button>
                    </div>
                </div>
            `;
        }
    }

    /* ---------- 题目导航点 ---------- */
    renderDots() {
        const container = document.getElementById('question-dots');
        container.innerHTML = '';
        // 超过 30 题不显示dots，太多
        if (this.currentQuestions.length > 30) return;

        this.currentQuestions.forEach((q, i) => {
            const dot = document.createElement('span');
            dot.className = 'dot';
            dot.onclick = () => { this.currentIndex = i; this.renderQuestion(); };
            container.appendChild(dot);
        });
        this.updateDots();
    }

    updateDots() {
        const dots = document.querySelectorAll('#question-dots .dot');
        dots.forEach((dot, i) => {
            const q = this.currentQuestions[i];
            if (!q) return;
            const status = this.getQuestionProgress(q.id).status;
            dot.className = 'dot dot-' + status;
            if (i === this.currentIndex) dot.classList.add('dot-active');
        });
    }

    /* ---------- 全局速查面板 ---------- */
    renderRefPanel() {
        const body = document.getElementById('ref-body');
        if (!body) return;
        body.innerHTML = '';

        this.categories.forEach(cat => {
            const group = document.createElement('div');
            group.className = 'ref-group';
            group.dataset.category = cat._key;

            const title = document.createElement('div');
            title.className = 'ref-group-title';
            title.innerHTML = `<i class="fas ${cat.icon}"></i> ${cat.category}（${cat.questions.length}）`;
            group.appendChild(title);

            cat.questions.forEach((q, i) => {
                const item = document.createElement('div');
                item.className = 'ref-item';
                item.dataset.qid = q.id;
                item.dataset.searchText = (q.question + ' ' + q.tags.join(' ') + ' ' + (q.answer || '')).toLowerCase();

                item.innerHTML = `
                    <div class="ref-item-header" onclick="app.jumpFromRef('${q.id}', '${cat._key}')">
                        <span class="ref-item-num">${i + 1}</span>
                        <span class="ref-item-q">${q.question}</span>
                        <span class="ref-item-arrow"><i class="fas fa-chevron-right"></i></span>
                    </div>
                `;
                group.appendChild(item);
            });

            body.appendChild(group);
        });
    }

    jumpFromRef(qid, catKey) {
        // 切到对应分类
        this.currentCategory = catKey;
        const cat = this.categories.find(c => c._key === catKey);
        if (!cat) return;

        document.getElementById('practice-category-name').textContent = cat.category;
        document.getElementById('difficulty-filter').value = 'all';
        document.getElementById('status-filter').value = 'all';

        // 加载全部题目，定位到目标题
        this.currentQuestions = cat.questions.slice();
        const idx = this.currentQuestions.findIndex(q => q.id === qid);
        this.currentIndex = idx >= 0 ? idx : 0;

        this.renderDots();
        this.showPage('page-practice');
        this.renderQuestion();

        // 自动展开答案
        this.revealAnswer();
    }

    findQuestionById(qid) {
        for (const cat of this.categories) {
            const q = cat.questions.find(q => q.id === qid);
            if (q) return q;
        }
        return null;
    }

    filterRef() {
        const keyword = document.getElementById('ref-search').value.trim().toLowerCase();
        const body = document.getElementById('ref-body');
        const groups = body.querySelectorAll('.ref-group');
        let anyVisible = false;

        groups.forEach(group => {
            const items = group.querySelectorAll('.ref-item');
            let groupVisible = false;
            items.forEach(item => {
                const match = !keyword || item.dataset.searchText.includes(keyword);
                item.style.display = match ? '' : 'none';
                if (match) groupVisible = true;
            });
            group.style.display = groupVisible ? '' : 'none';
            if (groupVisible) anyVisible = true;
        });

        // 无结果提示
        let noResult = body.querySelector('.ref-no-result');
        if (!anyVisible) {
            if (!noResult) {
                noResult = document.createElement('div');
                noResult.className = 'ref-no-result';
                noResult.textContent = '没有匹配的题目';
                body.appendChild(noResult);
            }
            noResult.style.display = '';
        } else if (noResult) {
            noResult.style.display = 'none';
        }
    }

    toggleRefPanel() {
        const panel = document.getElementById('ref-panel');
        const fab = document.getElementById('ref-fab');
        const isOpen = panel.classList.contains('open');

        panel.classList.toggle('open', !isOpen);
        fab.classList.toggle('hidden', !isOpen);
        document.body.classList.toggle('ref-open', !isOpen);

        // 首次打开时渲染
        if (!isOpen && !this._refRendered) {
            this.renderRefPanel();
            this._refRendered = true;
        }

        // 打开时聚焦搜索框
        if (!isOpen) {
            setTimeout(() => document.getElementById('ref-search').focus(), 300);
        }
    }

    /* ---------- 交互 ---------- */
    showHint() {
        const hintBox = document.getElementById('hint-box');
        hintBox.style.display = hintBox.style.display === 'none' ? 'block' : 'none';
    }

    async revealAnswer() {
        if (this.currentQuestions.length === 0) return;
        const q = this.currentQuestions[this.currentIndex];
        const answerEl = document.getElementById('answer-content');

        // 按需加载答案（如果还没加载过）
        if (!q.answer) {
            answerEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-secondary)"><i class="fas fa-spinner fa-spin"></i> 加载答案...</div>';
            document.getElementById('card-back').style.display = 'block';
            await this.loadQuestionAnswer(q.id, this.currentCategory);
        }

        if (q.answer) {
            // 用 marked 渲染 markdown（代码高亮已在 renderer 中处理）
            answerEl.innerHTML = marked.parse(q.answer);
            // 渲染 Mermaid 图表
            this.renderMermaidBlocks(answerEl);
        } else {
            answerEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-secondary)">暂无答案内容</div>';
        }

        // 更新提示（可能也是懒加载的）
        if (q.hint) {
            const hintBox = document.getElementById('hint-box');
            hintBox.textContent = q.hint;
            document.getElementById('btn-hint').style.display = '';
        }

        document.getElementById('card-back').style.display = 'block';
        this.answerRevealed = true;
        // 滚动到答案
        document.getElementById('card-back').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    async renderMermaidBlocks(container) {
        // 第一步：处理 marked renderer 创建的 placeholder（如果有）
        const placeholders = container.querySelectorAll('.mermaid-placeholder');
        for (const el of placeholders) {
            await this._renderOneMermaid(el, el.dataset.graph
                .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
        }

        // 第二步：后扫描——捕获 marked renderer 没识别的 mermaid 代码块
        // 当 marked 没有调用自定义 code()，mermaid 内容会变成普通 <pre><code> 块
        const mermaidRe = /^(classDiagram|sequenceDiagram|flowchart|graph\s|pie|gantt|erDiagram|stateDiagram|gitGraph)/;
        const codeEls = container.querySelectorAll('pre code');
        for (const code of codeEls) {
            const text = code.textContent.trim();
            if (mermaidRe.test(text)) {
                const wrapper = code.closest('pre');
                const placeholder = document.createElement('div');
                placeholder.className = 'mermaid-placeholder';
                wrapper.replaceWith(placeholder);
                await this._renderOneMermaid(placeholder, text);
            }
        }
    }

    async _renderOneMermaid(el, graphDef) {
        const id = 'mermaid-' + (this._mermaidId++);
        try {
            const { svg } = await mermaid.render(id, graphDef);
            el.innerHTML = svg;
            el.classList.add('mermaid-rendered');
        } catch (e) {
            el.innerHTML =
                '<div class="mermaid-error-wrap">' +
                '<div class="mermaid-error-hint"><i class="fas fa-exclamation-triangle"></i> 图表渲染失败，显示原始定义</div>' +
                '<pre class="mermaid-error"><code>' +
                graphDef.replace(/</g, '&lt;').replace(/>/g, '&gt;') +
                '</code></pre></div>';
            console.warn('Mermaid渲染失败:', id, e.message || e);
        }
    }

    hideAnswer() {
        document.getElementById('card-back').style.display = 'none';
        this.answerRevealed = false;
    }

    /* ---------- 详解（detail.md）懒加载 ---------- */
    async loadDetail(qid, catKey) {
        const cacheKey = `${catKey}/${qid}`;
        if (this.detailCache[cacheKey]) return this.detailCache[cacheKey];

        try {
            const resp = await fetch(`questions/${catKey}/${qid}/detail.md`);
            if (!resp.ok) throw new Error(resp.statusText);
            const md = await resp.text();
            this.detailCache[cacheKey] = md;
            return md;
        } catch (e) {
            console.warn('加载详解失败:', cacheKey, e);
            return null;
        }
    }

    get isDetailOpen() {
        return document.body.classList.contains('detail-open');
    }

    async showDetail() {
        if (this.currentQuestions.length === 0) return;
        const q = this.currentQuestions[this.currentIndex];
        const detailContent = document.getElementById('detail-content');

        // 已打开则切换关闭
        if (this.isDetailOpen) {
            this.hideDetail();
            return;
        }

        // 打开面板
        document.body.classList.add('detail-open');

        // 加载内容
        await this._renderDetailContent(q.id);
    }

    async _renderDetailContent(qid) {
        const detailContent = document.getElementById('detail-content');
        detailContent.innerHTML = '<div class="detail-loading"><i class="fas fa-spinner fa-spin"></i> 加载详解...</div>';
        // 滚动到顶部
        detailContent.scrollTop = 0;

        const md = await this.loadDetail(qid, this.currentCategory);
        if (md) {
            this._mermaidId = this._mermaidId || 0;
            detailContent.innerHTML = marked.parse(md);
            await this.renderMermaidBlocks(detailContent);
        } else {
            detailContent.innerHTML = '<div class="detail-empty"><i class="fas fa-file-alt"></i> 暂无详解内容</div>';
        }
    }

    hideDetail() {
        document.body.classList.remove('detail-open');
    }

    rate(status) {
        if (this.currentQuestions.length === 0) return;
        const q = this.currentQuestions[this.currentIndex];
        this.setQuestionProgress(q.id, status);

        // 更新dots
        this.updateDots();

        // 自动下一题或显示完成
        if (this.currentIndex < this.currentQuestions.length - 1) {
            this.currentIndex++;
            this.renderQuestion();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            this.showComplete();
        }
    }

    prevQuestion() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.renderQuestion();
        }
    }

    nextQuestion() {
        if (this.currentIndex < this.currentQuestions.length - 1) {
            this.currentIndex++;
            this.renderQuestion();
        }
    }

    /* ---------- 完成弹窗 ---------- */
    showComplete() {
        const cat = this.categories.find(c => c._key === this.currentCategory);
        if (!cat) return;
        const stats = this.getCategoryStats(cat);
        const total = cat.questions.length;

        const summary = document.getElementById('complete-summary');
        summary.innerHTML = `
            <div class="summary-row"><span>总题数</span><strong>${total}</strong></div>
            <div class="summary-row"><span style="color:var(--mastered-color)">✅ 熟练</span><strong>${stats.mastered}</strong></div>
            <div class="summary-row"><span style="color:var(--fuzzy-color)">⚠️ 模糊</span><strong>${stats.fuzzy}</strong></div>
            <div class="summary-row"><span style="color:var(--failed-color)">❌ 不会</span><strong>${stats.failed}</strong></div>
            <div class="summary-row"><span>未练习</span><strong>${total - stats.mastered - stats.fuzzy - stats.failed}</strong></div>
        `;
        document.getElementById('complete-overlay').classList.add('show');
    }

    /* ---------- 统计页 ---------- */
    showStats() {
        this.renderStats();
        this.showPage('page-stats');
    }

    renderStats() {
        let totalAll = 0, masteredAll = 0, fuzzyAll = 0, failedAll = 0;
        this.categories.forEach(cat => {
            const s = this.getCategoryStats(cat);
            totalAll += cat.questions.length;
            masteredAll += s.mastered;
            fuzzyAll += s.fuzzy;
            failedAll += s.failed;
        });

        // 总览
        document.getElementById('stats-overview').innerHTML = `
            <div class="stat-card">
                <span class="stat-number color-total">${totalAll}</span>
                <span class="stat-label">总题数</span>
            </div>
            <div class="stat-card">
                <span class="stat-number color-mastered">${masteredAll}</span>
                <span class="stat-label">熟练</span>
            </div>
            <div class="stat-card">
                <span class="stat-number color-fuzzy">${fuzzyAll}</span>
                <span class="stat-label">模糊</span>
            </div>
            <div class="stat-card">
                <span class="stat-number color-failed">${failedAll}</span>
                <span class="stat-label">不会</span>
            </div>
        `;

        // 分类详情
        const detail = document.getElementById('stats-detail');
        detail.innerHTML = '';
        this.categories.forEach(cat => {
            const total = cat.questions.length;
            const s = this.getCategoryStats(cat);
            const mPct = total ? (s.mastered / total * 100) : 0;
            const fzPct = total ? (s.fuzzy / total * 100) : 0;
            const flPct = total ? (s.failed / total * 100) : 0;

            const card = document.createElement('div');
            card.className = 'stats-category-card';
            card.innerHTML = `
                <h3><i class="fas ${cat.icon}"></i> ${cat.category}</h3>
                <div class="stats-bar-row">
                    <span class="stats-bar-label">进度</span>
                    <div class="stats-bar-track">
                        <div class="stats-bar-seg seg-mastered" style="width:${mPct}%"></div>
                        <div class="stats-bar-seg seg-fuzzy" style="width:${fzPct}%"></div>
                        <div class="stats-bar-seg seg-failed" style="width:${flPct}%"></div>
                    </div>
                    <span class="stats-bar-count">
                        <span style="color:var(--mastered-color)">${s.mastered}</span> /
                        <span style="color:var(--fuzzy-color)">${s.fuzzy}</span> /
                        <span style="color:var(--failed-color)">${s.failed}</span> /
                        ${total}
                    </span>
                </div>
            `;
            detail.appendChild(card);
        });
    }

    /* ---------- 进度管理操作 ---------- */
    confirmClearProgress() {
        document.getElementById('modal-overlay').classList.add('show');
    }

    closeModal() {
        document.getElementById('modal-overlay').classList.remove('show');
    }

    clearProgress() {
        this.progress = {};
        this.saveProgress();
        this.closeModal();
        this.renderHome();
    }

    exportProgress() {
        const data = {
            exportTime: new Date().toISOString(),
            progress: this.progress
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `interview_progress_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    /* ---------- 简历导出（基于页面渲染内容） ---------- */

    exportResumePDF() {
        window.print();
    }

    exportResumeDOCX() {
        const content = document.getElementById('resume-content');
        if (!content || !content.innerHTML.trim()) {
            alert('请先加载简历内容');
            return;
        }
        // 将页面渲染的 HTML 包装为 Word 可识别的格式
        const styles = `
            body { font-family: '微软雅黑', 'Microsoft YaHei', sans-serif; font-size: 10.5pt; color: #333; line-height: 1.8; }
            h1 { font-size: 18pt; font-weight: bold; color: #1a5276; text-align: center; margin-bottom: 4pt; }
            h2 { font-size: 13pt; font-weight: bold; color: #1a5276; border-left: 4px solid #2980b9; padding-left: 8px; margin-top: 16pt; margin-bottom: 8pt; }
            h3 { font-size: 11pt; font-weight: bold; color: #1e293b; margin-top: 12pt; margin-bottom: 4pt; border-bottom: 1px dashed #ccc; padding-bottom: 2pt; }
            p { margin: 4pt 0; }
            li { margin-bottom: 2pt; }
            strong { color: #1e293b; }
            a { color: #2563eb; }
            hr { border: none; border-top: 1px solid #e2e8f0; margin: 12pt 0; }
        `;
        const html = [
            '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">',
            '<head><meta charset="utf-8">',
            '<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->',
            '<style>' + styles + '</style></head>',
            '<body>' + content.innerHTML + '</body></html>'
        ].join('');
        const blob = new Blob(['\ufeff' + html], { type: 'application/msword' });
        this._downloadBlob(blob, '段胜炜_C++开发工程师_简历.doc');
    }

    exportResumeMD() {
        // 从页面内容反向提取不如直接用源文件，源文件就是页面渲染的数据源
        const content = document.getElementById('resume-content');
        if (!content || !content.innerHTML.trim()) {
            alert('请先加载简历内容');
            return;
        }
        // 用已缓存的 md 源文本（showResume 时 fetch 过）
        fetch('resume.md')
            .then(r => r.text())
            .then(text => {
                const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
                this._downloadBlob(blob, '段胜炜_C++开发工程师_简历.md');
            })
            .catch(e => console.error('导出MD失败:', e));
    }

    _downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /* ---------- 简历查看 ---------- */
    async showResume() {
        this.showPage('page-resume');
        const container = document.getElementById('resume-content');

        // 已加载过则不重复请求
        if (container.dataset.loaded === 'true') return;

        container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-secondary)"><i class="fas fa-spinner fa-spin"></i> 加载简历...</div>';

        try {
            const resp = await fetch('resume.md');
            if (!resp.ok) throw new Error(resp.statusText);
            const md = await resp.text();
            container.innerHTML = marked.parse(md);
            container.dataset.loaded = 'true';
        } catch (e) {
            container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--failed)"><i class="fas fa-exclamation-circle"></i> 加载简历失败</div>';
            console.error('加载简历失败:', e);
        }
    }
}

/* ===== 键盘快捷键 ===== */
document.addEventListener('keydown', (e) => {
    if (!app) return;

    // Ctrl+K 或 Cmd+K：打开/关闭速查面板（全局生效）
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        app.toggleRefPanel();
        return;
    }

    // Escape：关闭速查面板优先，否则返回首页
    if (e.key === 'Escape') {
        const panel = document.getElementById('ref-panel');
        if (panel && panel.classList.contains('open')) {
            app.toggleRefPanel();
            return;
        }
    }

    // 以下快捷键仅在搜索框未聚焦时生效
    if (document.activeElement && document.activeElement.id === 'ref-search') return;

    const page = document.querySelector('.page.active');
    if (!page || page.id !== 'page-practice') return;

    switch (e.key) {
        case 'ArrowLeft':
            app.prevQuestion();
            break;
        case 'ArrowRight':
            app.nextQuestion();
            break;
        case ' ':
        case 'Enter':
            e.preventDefault();
            if (!app.answerRevealed) {
                app.revealAnswer();
            }
            break;
        case '1':
            if (app.answerRevealed) app.rate('mastered');
            break;
        case '2':
            if (app.answerRevealed) app.rate('fuzzy');
            break;
        case '3':
            if (app.answerRevealed) app.rate('failed');
            break;
        case 'h':
            app.showHint();
            break;
        case 'd':
            if (app.answerRevealed) app.showDetail();
            break;
        case 'Escape':
            app.goHome();
            break;
    }
});

/* ===== 启动 ===== */
const app = new InterviewApp();
