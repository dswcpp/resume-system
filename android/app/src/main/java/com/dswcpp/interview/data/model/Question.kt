package com.dswcpp.interview.data.model

import com.google.gson.annotations.SerializedName

/**
 * 对应每个 question.json 的结构
 */
data class Question(
    @SerializedName("id") val id: String = "",
    @SerializedName("question") val question: String = "",
    @SerializedName("tags") val tags: List<String> = emptyList(),
    @SerializedName("difficulty") val difficulty: Int = 1,
    @SerializedName("hint") val hint: String = "",
    @SerializedName("answer") val answer: String = "",
    @SerializedName("source") val source: String = "",
    /** 所属分类 key，运行时由 Repository 设置 */
    @Transient val categoryKey: String = ""
)
