package com.dswcpp.interview.data.model

/**
 * 单个题目的进度
 */
data class QuestionProgress(
    val status: Status = Status.UNKNOWN,
    val lastPracticed: Long = 0L
) {
    enum class Status {
        UNKNOWN,   // 未练习
        MASTERED,  // 熟练
        FUZZY,     // 模糊
        FAILED     // 不会
    }
}
