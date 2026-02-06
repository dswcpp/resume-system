package com.dswcpp.interview.ui.stats

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.dswcpp.interview.R
import com.dswcpp.interview.data.ProgressManager
import com.dswcpp.interview.data.model.Category
import com.dswcpp.interview.data.model.QuestionProgress.Status
import com.dswcpp.interview.databinding.ItemStatCategoryBinding

class StatsCategoryAdapter(
    private val categories: List<Category>,
    private val progressManager: ProgressManager
) : RecyclerView.Adapter<StatsCategoryAdapter.ViewHolder>() {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemStatCategoryBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(categories[position])
    }

    override fun getItemCount() = categories.size

    inner class ViewHolder(private val binding: ItemStatCategoryBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(category: Category) {
            val ctx = binding.root.context
            val ids = category.questions.map { it.id }
            val counts = progressManager.getStatusCounts(ids)
            val total = ids.size
            val practiced = total - (counts[Status.UNKNOWN] ?: 0)

            binding.tvName.text = category.name
            binding.tvCount.text = "$practiced / $total"
            binding.progressBar.max = total
            binding.progressBar.progress = practiced
            binding.tvMastered.text = ctx.getString(R.string.stat_mastered_format, counts[Status.MASTERED] ?: 0)
            binding.tvFuzzy.text = ctx.getString(R.string.stat_fuzzy_format, counts[Status.FUZZY] ?: 0)
            binding.tvFailed.text = ctx.getString(R.string.stat_failed_format, counts[Status.FAILED] ?: 0)
        }
    }
}
