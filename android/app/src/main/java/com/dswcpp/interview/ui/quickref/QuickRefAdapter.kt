package com.dswcpp.interview.ui.quickref

import android.graphics.drawable.GradientDrawable
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.dswcpp.interview.R
import com.dswcpp.interview.data.ProgressManager
import com.dswcpp.interview.data.model.Question
import com.dswcpp.interview.data.model.QuestionProgress.Status
import com.dswcpp.interview.databinding.ItemQuickrefBinding

/**
 * QuickRef 列表项：可包含分组头部
 */
data class QuickRefItem(
    val question: Question,
    val categoryName: String,
    val categoryKey: String,
    val indexInCategory: Int,
    val isGroupStart: Boolean
)

class QuickRefAdapter(
    private val progressManager: ProgressManager,
    private val onItemClick: (QuickRefItem) -> Unit
) : RecyclerView.Adapter<QuickRefAdapter.ViewHolder>() {

    private var items: List<QuickRefItem> = emptyList()

    fun submitList(list: List<QuickRefItem>) {
        items = list
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemQuickrefBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(items[position])
    }

    override fun getItemCount() = items.size

    inner class ViewHolder(private val binding: ItemQuickrefBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(item: QuickRefItem) {
            // 分组标题
            if (item.isGroupStart) {
                binding.tvGroupHeader.visibility = View.VISIBLE
                binding.tvGroupHeader.text = item.categoryName
            } else {
                binding.tvGroupHeader.visibility = View.GONE
            }

            binding.tvQuestion.text = item.question.question

            // 状态圆点颜色
            val progress = progressManager.getProgress(item.question.id)
            val colorRes = when (progress.status) {
                Status.MASTERED -> R.color.mastered
                Status.FUZZY -> R.color.fuzzy
                Status.FAILED -> R.color.failed
                Status.UNKNOWN -> R.color.unknown
            }
            val dot = binding.dotStatus.background
            if (dot is GradientDrawable) {
                dot.setColor(binding.root.context.getColor(colorRes))
            } else {
                val shape = GradientDrawable().apply {
                    shape = GradientDrawable.OVAL
                    setColor(binding.root.context.getColor(colorRes))
                }
                binding.dotStatus.background = shape
            }

            binding.itemRoot.setOnClickListener { onItemClick(item) }
        }
    }
}
