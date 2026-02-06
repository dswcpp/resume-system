package com.dswcpp.interview.data

import android.content.Context
import com.dswcpp.interview.data.model.Category
import com.dswcpp.interview.data.model.CategoryMeta
import com.dswcpp.interview.data.model.Question
import com.google.gson.Gson

/**
 * 从 assets/questions/ 目录加载全部分类和题目
 */
class QuestionRepository(private val context: Context) {

    private val gson = Gson()

    @Volatile
    private var cachedCategories: List<Category>? = null

    companion object {
        private val CATEGORY_DIRS = listOf(
            "cpp", "qt", "network", "design_pattern", "project", "behavior"
        )
        private const val BASE_PATH = "questions"
    }

    /** 获取全部分类 (线程安全缓存) */
    fun getCategories(): List<Category> {
        cachedCategories?.let { return it }
        synchronized(this) {
            cachedCategories?.let { return it }
            val result = CATEGORY_DIRS.mapNotNull { dir -> loadCategory(dir) }
            cachedCategories = result
            return result
        }
    }

    /** 获取指定分类 */
    fun getCategory(key: String): Category? {
        return getCategories().find { it.key == key }
    }

    /** 获取指定题目 */
    fun getQuestion(questionId: String): Question? {
        return getCategories().flatMap { it.questions }.find { it.id == questionId }
    }

    /** 获取所有题目 (扁平列表) */
    fun getAllQuestions(): List<Question> {
        return getCategories().flatMap { it.questions }
    }

    /** 读取 detail.md 内容 */
    fun loadDetail(categoryKey: String, questionId: String): String? {
        val path = "$BASE_PATH/$categoryKey/$questionId/detail.md"
        return try {
            context.assets.open(path).bufferedReader().use { it.readText() }
        } catch (e: Exception) {
            null
        }
    }

    private fun loadCategory(dirName: String): Category? {
        return try {
            val metaJson = readAsset("$BASE_PATH/$dirName/_meta.json")
            val meta = gson.fromJson(metaJson, CategoryMeta::class.java) ?: return null
            val questions = meta.questionIds.mapNotNull { qid ->
                loadQuestion(dirName, qid)
            }
            Category(
                key = dirName,
                name = meta.name,
                icon = meta.icon,
                questions = questions
            )
        } catch (e: Exception) {
            null
        }
    }

    private fun loadQuestion(categoryDir: String, questionId: String): Question? {
        return try {
            val json = readAsset("$BASE_PATH/$categoryDir/$questionId/question.json")
            val question = gson.fromJson(json, Question::class.java) ?: return null
            question.copy(categoryKey = categoryDir)
        } catch (e: Exception) {
            null
        }
    }

    private fun readAsset(path: String): String {
        return context.assets.open(path).bufferedReader().use { it.readText() }
    }
}
