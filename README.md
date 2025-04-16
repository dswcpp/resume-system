# 个人简历系统

## 系统主旨

个人简历系统旨在帮助求职者创建、管理和优化专业简历。该系统采用模块化设计，通过结构化的流程和专业的优化建议，使用户能够制作出真实、具体、专业且有竞争力的个人简历。

本系统不依赖前端界面和数据库，而是通过一系列markdown文档和规范化流程，帮助用户完成从信息收集到简历优化的全过程。

## 快速访问

### 本地访问方式（推荐）

1. 下载或克隆本仓库到本地
2. 直接在浏览器中打开 `resume.html` 文件即可查看精美简历
3. 支持直接打印或导出为PDF格式

### 在线访问方式 - 使用CDN加速（推荐）

我们提供了通过jsDelivr CDN加速访问简历的方式，速度快且稳定：

- **[📄 通过jsDelivr在线查看HTML简历](https://cdn.jsdelivr.net/gh/beipiao_boy/resume-system@main/resume.html)**

只需将上面链接中的 `beipiao_boy` 替换为您的GitHub用户名即可。

### 通过GitHub Pages访问

- **[📄 在线查看HTML简历](https://beipiao_boy.github.io/resume-system/resume.html)** - 需要先在GitHub仓库中开启Pages服务

## 系统规划

### 文件结构

- `README.md` - 系统说明文档
- `system_manual.md` - 系统详细使用手册
- `resume_template.md` - 简历信息收集模板
- `resume_draft.md` - 简历初稿（生成文件）
- `resume_final.md` - 最终简历文档（生成文件）
- `resume.html` - 精美的HTML格式简历（可直接在浏览器打开）
- `.rules/.cursorrules` - 简历优化专家提示规则

### 工作流程

1. **信息收集阶段**
   - 完整填写 `resume_template.md` 文件
   - 确保所有关键信息真实、具体、完整

2. **内容优化阶段**
   - 基于模板信息生成初稿 `resume_draft.md`
   - 按照专业简历标准优化内容
   - 确保每个描述具体、量化、突出成果

3. **格式调整阶段**
   - 创建最终版本 `resume_final.md`
   - 调整排版、格式、重点突出
   - 确保整体简洁专业

4. **导出与应用阶段**
   - 根据需要导出为PDF或生成HTML网页版本
   - 针对不同岗位可创建不同版本

## 核心原则

- **真实性** - 所有内容必须真实，不编造、不夸大
- **具体性** - 用数据和事实说话，避免模糊表述
- **相关性** - 内容与目标职位高度匹配
- **专业性** - 使用行业术语和规范表达
- **简洁性** - 表达精炼，突出重点

## 使用方法

1. 阅读 `system_manual.md` 了解系统详细使用说明
2. 按照模板填写 `resume_template.md` 文件
3. 根据优化建议完善简历内容
4. 导出最终简历文档或使用HTML版本在线展示

## 在线访问配置指南

由于我们已将仓库从Gitee迁移至GitHub，以下是设置在线访问的方法：

### 配置GitHub Pages（免费托管）

1. 前往GitHub仓库 → Settings → Pages
2. Source选择"Deploy from a branch"
3. Branch选择"main"和"/(root)"，然后点击Save
4. 稍等片刻，您的简历将通过 `https://[用户名].github.io/resume-system/resume.html` 访问

### 使用jsDelivr CDN加速（推荐）

无需额外配置，只需访问：
```
https://cdn.jsdelivr.net/gh/[用户名]/resume-system@main/resume.html
```
jsDelivr提供全球CDN加速，访问速度快、稳定，特别适合中国大陆地区访问。

### 其他免费托管选项

- **[Vercel](https://vercel.com)** - 支持直接从GitHub导入，提供全球CDN加速
- **[Netlify](https://netlify.com)** - 简单易用的静态网站托管服务
- **[Cloudflare Pages](https://pages.cloudflare.com)** - 提供强大的CDN和边缘计算能力

## 更新与维护

本系统将持续优化更新，包括但不限于：
- 简历模板的更新与扩充
- 优化规则的迭代与完善
- 导出格式的多样化支持
