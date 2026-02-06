package com.dswcpp.interview.ui.stats

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.LinearLayoutManager
import com.dswcpp.interview.data.ProgressManager
import com.dswcpp.interview.data.QuestionRepository
import com.dswcpp.interview.data.model.QuestionProgress.Status
import com.dswcpp.interview.databinding.FragmentStatsBinding

class StatsFragment : Fragment() {

    private var _binding: FragmentStatsBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View {
        _binding = FragmentStatsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        binding.toolbar.setNavigationOnClickListener {
            findNavController().navigateUp()
        }

        val repo = QuestionRepository(requireContext())
        val progressManager = ProgressManager(requireContext())
        val categories = repo.getCategories()

        // 全局统计
        val allIds = categories.flatMap { c -> c.questions.map { it.id } }
        val allCounts = progressManager.getStatusCounts(allIds)

        binding.tvTotal.text = allIds.size.toString()
        binding.tvMastered.text = (allCounts[Status.MASTERED] ?: 0).toString()
        binding.tvFuzzy.text = (allCounts[Status.FUZZY] ?: 0).toString()
        binding.tvFailed.text = (allCounts[Status.FAILED] ?: 0).toString()

        // 分类统计
        val adapter = StatsCategoryAdapter(categories, progressManager)
        binding.rvStats.layoutManager = LinearLayoutManager(requireContext())
        binding.rvStats.adapter = adapter
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
