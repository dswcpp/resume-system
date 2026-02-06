package com.dswcpp.interview.data

import android.content.Context
import android.content.SharedPreferences
import com.dswcpp.interview.data.model.QuestionProgress
import com.dswcpp.interview.data.model.QuestionProgress.Status

/**
 * 使用 SharedPreferences 管理练习进度
 * key 格式: progress_{questionId}_status / progress_{questionId}_time
 */
class ProgressManager(context: Context) {

    private val prefs: SharedPreferences =
        context.getSharedPreferences("interview_progress", Context.MODE_PRIVATE)

    /** 获取单个题目的进度 */
    fun getProgress(questionId: String): QuestionProgress {
        val statusStr = prefs.getString("progress_${questionId}_status", null)
        val time = prefs.getLong("progress_${questionId}_time", 0L)
        val status = statusStr?.let {
            try { Status.valueOf(it) } catch (_: Exception) { Status.UNKNOWN }
        } ?: Status.UNKNOWN
        return QuestionProgress(status, time)
    }

    /** 保存单个题目的进度 */
    fun saveProgress(questionId: String, status: Status) {
        prefs.edit()
            .putString("progress_${questionId}_status", status.name)
            .putLong("progress_${questionId}_time", System.currentTimeMillis())
            .apply()
    }

    /** 获取指定 ID 列表中已练习的数量 */
    fun getPracticedCount(questionIds: List<String>): Int {
        return questionIds.count { id ->
            val statusStr = prefs.getString("progress_${id}_status", null)
            statusStr != null && statusStr != Status.UNKNOWN.name
        }
    }

    /** 获取指定 ID 列表中各状态的数量 */
    fun getStatusCounts(questionIds: List<String>): Map<Status, Int> {
        val counts = mutableMapOf<Status, Int>()
        Status.entries.forEach { counts[it] = 0 }
        questionIds.forEach { id ->
            val status = getProgress(id).status
            counts[status] = (counts[status] ?: 0) + 1
        }
        return counts
    }

    /** 清除所有进度 */
    fun clearAll() {
        prefs.edit().clear().apply()
    }
}
