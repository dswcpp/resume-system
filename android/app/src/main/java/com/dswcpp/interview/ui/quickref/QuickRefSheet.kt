package com.dswcpp.interview.ui.quickref

import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.navigation.Navigation
import androidx.recyclerview.widget.LinearLayoutManager
import com.dswcpp.interview.R
import com.dswcpp.interview.data.ProgressManager
import com.dswcpp.interview.data.QuestionRepository
import com.dswcpp.interview.databinding.BottomSheetQuickrefBinding
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialogFragment

class QuickRefSheet : BottomSheetDialogFragment() {

    private var _binding: BottomSheetQuickrefBinding? = null
    private val binding get() = _binding!!

    private lateinit var adapter: QuickRefAdapter
    private var allItems: List<QuickRefItem> = emptyList()

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View {
        _binding = BottomSheetQuickrefBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val repo = QuestionRepository(requireContext())
        val progressManager = ProgressManager(requireContext())

        adapter = QuickRefAdapter(progressManager) { item ->
            // 点击跳转到练习页对应题目
            val bundle = Bundle().apply {
                putString("categoryKey", item.categoryKey)
                putInt("questionIndex", item.indexInCategory)
            }
            // 通过 Activity 的 NavController 导航
            try {
                val navController = Navigation.findNavController(
                    requireActivity(), R.id.nav_host
                )
                navController.navigate(R.id.action_global_practice, bundle)
            } catch (_: Exception) {
                // 导航失败时忽略
            }
            dismiss()
        }

        binding.rvQuestions.layoutManager = LinearLayoutManager(requireContext())
        binding.rvQuestions.adapter = adapter

        // 构建全部题目列表
        val categories = repo.getCategories()
        allItems = categories.flatMap { category ->
            category.questions.mapIndexed { index, question ->
                QuickRefItem(
                    question = question,
                    categoryName = category.name,
                    categoryKey = category.key,
                    indexInCategory = index,
                    isGroupStart = index == 0
                )
            }
        }
        adapter.submitList(allItems)

        // 搜索过滤
        binding.etSearch.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                filterList(s?.toString() ?: "")
            }
        })
    }

    override fun onStart() {
        super.onStart()
        // 展开到 80% 屏幕高度
        val parentView = requireView().parent
        if (parentView is View) {
            val behavior = BottomSheetBehavior.from(parentView)
            behavior.state = BottomSheetBehavior.STATE_EXPANDED
            behavior.peekHeight = (resources.displayMetrics.heightPixels * 0.8).toInt()
        }
    }

    private fun filterList(query: String) {
        if (query.isBlank()) {
            adapter.submitList(allItems)
            return
        }
        val lower = query.lowercase()
        val filtered = allItems.filter { item ->
            item.question.question.lowercase().contains(lower) ||
                item.question.tags.any { it.lowercase().contains(lower) } ||
                item.categoryName.lowercase().contains(lower)
        }
        // 重新计算分组头部
        var lastCategory = ""
        val result = filtered.map { item ->
            val isStart = item.categoryKey != lastCategory
            lastCategory = item.categoryKey
            item.copy(isGroupStart = isStart)
        }
        adapter.submitList(result)
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
