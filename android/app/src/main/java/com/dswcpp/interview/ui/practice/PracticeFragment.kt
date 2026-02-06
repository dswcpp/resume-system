package com.dswcpp.interview.ui.practice

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.navigation.fragment.findNavController
import com.dswcpp.interview.R
import com.dswcpp.interview.data.ProgressManager
import com.dswcpp.interview.data.QuestionRepository
import com.dswcpp.interview.data.model.Category
import com.dswcpp.interview.data.model.Question
import com.dswcpp.interview.data.model.QuestionProgress.Status
import com.dswcpp.interview.databinding.FragmentPracticeBinding
import com.google.android.material.chip.Chip
import io.noties.markwon.Markwon

class PracticeFragment : Fragment() {

    private var _binding: FragmentPracticeBinding? = null
    private val binding get() = _binding!!

    private lateinit var repo: QuestionRepository
    private lateinit var progressManager: ProgressManager
    private lateinit var markwon: Markwon

    private var category: Category? = null
    private var questions: List<Question> = emptyList()
    private var currentIndex = 0
    private var answerRevealed = false

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View {
        _binding = FragmentPracticeBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        repo = QuestionRepository(requireContext())
        progressManager = ProgressManager(requireContext())
        markwon = Markwon.create(requireContext())

        val categoryKey = arguments?.getString("categoryKey")
        if (categoryKey == null) {
            findNavController().navigateUp()
            return
        }

        category = repo.getCategory(categoryKey)
        questions = category?.questions ?: emptyList()

        if (questions.isEmpty()) {
            findNavController().navigateUp()
            return
        }

        // 支持从速查面板跳转到指定题目
        val jumpToIndex = arguments?.getInt("questionIndex", 0) ?: 0
        currentIndex = jumpToIndex.coerceIn(0, questions.size - 1)

        binding.toolbar.title = category?.name ?: ""
        binding.toolbar.setNavigationOnClickListener {
            findNavController().navigateUp()
        }

        binding.btnReveal.setOnClickListener { revealAnswer() }
        binding.btnHint.setOnClickListener { toggleHint() }
        binding.btnDetail.setOnClickListener { openDetail() }

        binding.btnMastered.setOnClickListener { rate(Status.MASTERED) }
        binding.btnFuzzy.setOnClickListener { rate(Status.FUZZY) }
        binding.btnFailed.setOnClickListener { rate(Status.FAILED) }

        binding.btnPrev.setOnClickListener { navigate(-1) }
        binding.btnNext.setOnClickListener { navigate(1) }

        renderQuestion()
    }

    private fun renderQuestion() {
        if (questions.isEmpty()) return
        val q = questions[currentIndex]

        answerRevealed = false
        binding.tvProgress.text = getString(
            R.string.progress_format, currentIndex + 1, questions.size
        )
        binding.tvQuestion.text = q.question
        binding.answerSection.visibility = View.GONE
        binding.btnReveal.visibility = View.VISIBLE

        // 标签
        binding.tagContainer.removeAllViews()
        val diffText = when (q.difficulty) {
            1 -> getString(R.string.difficulty_1)
            2 -> getString(R.string.difficulty_2)
            3 -> getString(R.string.difficulty_3)
            else -> "?"
        }
        addChip(diffText, getDifficultyColor(q.difficulty))
        q.tags.forEach { tag -> addChip(tag, R.color.text_secondary) }

        // 提示
        if (q.hint.isNotBlank()) {
            binding.btnHint.visibility = View.VISIBLE
            binding.tvHint.text = q.hint
            binding.tvHint.visibility = View.GONE
        } else {
            binding.btnHint.visibility = View.GONE
            binding.tvHint.visibility = View.GONE
        }

        // 导航按钮状态
        binding.btnPrev.isEnabled = currentIndex > 0
        binding.btnNext.isEnabled = currentIndex < questions.size - 1

        // 高亮已评分状态
        highlightRating(q.id)
    }

    private fun revealAnswer() {
        if (questions.isEmpty()) return
        val q = questions[currentIndex]

        answerRevealed = true
        binding.btnReveal.visibility = View.GONE
        binding.answerSection.visibility = View.VISIBLE
        markwon.setMarkdown(binding.tvAnswer, q.answer)
    }

    private fun toggleHint() {
        binding.tvHint.visibility =
            if (binding.tvHint.visibility == View.VISIBLE) View.GONE else View.VISIBLE
    }

    private fun openDetail() {
        if (questions.isEmpty()) return
        val q = questions[currentIndex]
        val bundle = Bundle().apply {
            putString("categoryKey", q.categoryKey)
            putString("questionId", q.id)
        }
        findNavController().navigate(R.id.action_practice_to_detail, bundle)
    }

    private fun rate(status: Status) {
        if (questions.isEmpty()) return
        val q = questions[currentIndex]
        progressManager.saveProgress(q.id, status)
        highlightRating(q.id)

        // 自动跳转下一题
        if (currentIndex < questions.size - 1) {
            currentIndex++
            renderQuestion()
        }
    }

    private fun highlightRating(questionId: String) {
        val progress = progressManager.getProgress(questionId)
        binding.btnMastered.alpha = if (progress.status == Status.MASTERED) 1f else 0.5f
        binding.btnFuzzy.alpha = if (progress.status == Status.FUZZY) 1f else 0.5f
        binding.btnFailed.alpha = if (progress.status == Status.FAILED) 1f else 0.5f
    }

    private fun navigate(delta: Int) {
        val newIndex = currentIndex + delta
        if (newIndex in questions.indices) {
            currentIndex = newIndex
            renderQuestion()
        }
    }

    private fun addChip(text: String, colorRes: Int) {
        val chip = Chip(requireContext()).apply {
            this.text = text
            textSize = 11f
            isClickable = false
            setChipBackgroundColorResource(R.color.border_light)
            setTextColor(ContextCompat.getColor(context, colorRes))
        }
        binding.tagContainer.addView(chip)
    }

    private fun getDifficultyColor(difficulty: Int): Int {
        return when (difficulty) {
            1 -> R.color.mastered
            2 -> R.color.fuzzy
            3 -> R.color.failed
            else -> R.color.text_secondary
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
