# Personal Resume System

## System Purpose

The Personal Resume System aims to help job seekers create, manage, and optimize professional resumes. The system adopts a modular design, utilizing structured processes and professional optimization suggestions to enable users to create authentic, specific, professional, and competitive personal resumes.

This system does not rely on a frontend interface or database, but instead uses a series of markdown documents and standardized processes to help users complete the entire process from information collection to resume optimization.

## System Planning

### File Structure

- `README.md` - System description document (Chinese)
- `README.en.md` - System description document (English)
- `system_manual.md` - Detailed system user manual
- `resume_template.md` - Resume information collection template
- `resume_draft.md` - Resume draft (generated file)
- `resume_final.md` - Final resume document (generated file)
- `.rules/.cursorrules` - Resume optimization expert prompting rules

### Workflow

1. **Information Collection Stage**
   - Complete the `resume_template.md` file
   - Ensure all key information is authentic, specific, and complete

2. **Content Optimization Stage**
   - Generate a draft based on template information in `resume_draft.md`
   - Optimize content according to professional resume standards
   - Ensure each description is specific, quantified, and highlights achievements

3. **Format Adjustment Stage**
   - Create the final version in `resume_final.md`
   - Adjust layout, format, and highlight key points
   - Ensure the overall resume is concise and professional

4. **Export and Application Stage**
   - Export to PDF or other formats as needed
   - Create different versions for different positions

## Core Principles

- **Authenticity** - All content must be truthful, without fabrication or exaggeration
- **Specificity** - Use data and facts, avoid vague statements
- **Relevance** - Content highly matches the target position
- **Professionalism** - Use industry terminology and standardized expressions
- **Conciseness** - Express content concisely, highlight key points

## Usage Instructions

1. Read `system_manual.md` for detailed system instructions
2. Fill out the `resume_template.md` file according to the template
3. Improve resume content based on optimization suggestions
4. Export the final resume document

## Updates and Maintenance

This system will be continuously optimized and updated, including but not limited to:
- Updates and expansion of resume templates
- Iteration and improvement of optimization rules
- Support for diverse export formats
