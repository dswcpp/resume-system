package com.dswcpp.interview.data.model

import com.google.gson.annotations.SerializedName

/**
 * 对应 _meta.json 结构
 */
data class CategoryMeta(
    @SerializedName("category") val name: String,
    @SerializedName("icon") val icon: String,
    @SerializedName("questions") val questionIds: List<String>
)

/**
 * 运行时使用的分类数据，包含 key (目录名) 和加载后的题目列表
 */
data class Category(
    val key: String,         // 目录名: cpp, qt, network, ...
    val name: String,        // 显示名: C++核心, Qt框架, ...
    val icon: String,        // fa-code 等 (映射为 Material Icon)
    val questions: List<Question>
)
