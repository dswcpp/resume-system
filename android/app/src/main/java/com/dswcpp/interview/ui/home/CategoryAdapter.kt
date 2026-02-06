package com.dswcpp.interview.ui.home

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.dswcpp.interview.data.ProgressManager
import com.dswcpp.interview.data.model.Category
import com.dswcpp.interview.databinding.ItemCategoryBinding

class CategoryAdapter(
    private val progressManager: ProgressManager,
    private val onClick: (Category) -> Unit
) : RecyclerView.Adapter<CategoryAdapter.ViewHolder>() {

    private var categories: List<Category> = emptyList()

    fun submitList(list: List<Category>) {
        categories = list
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemCategoryBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(categories[position])
    }

    override fun getItemCount() = categories.size

    inner class ViewHolder(private val binding: ItemCategoryBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(category: Category) {
            binding.tvName.text = category.name
            binding.tvIcon.text = mapIcon(category.icon)

            val total = category.questions.size
            val ids = category.questions.map { it.id }
            val practiced = progressManager.getPracticedCount(ids)
            val pct = if (total > 0) (practiced * 100 / total) else 0

            binding.tvProgress.text = binding.root.context.getString(
                com.dswcpp.interview.R.string.practiced_format, total, practiced, pct
            )
            binding.progressBar.max = total
            binding.progressBar.progress = practiced

            binding.card.setOnClickListener { onClick(category) }
        }

        private fun mapIcon(faIcon: String): String {
            return when (faIcon) {
                "fa-code" -> "\uD83D\uDCBB"          // 💻
                "fa-window-restore" -> "\uD83D\uDDA5" // 🖥
                "fa-network-wired" -> "\uD83C\uDF10"   // 🌐
                "fa-cubes" -> "\uD83E\uDDE9"           // 🧩
                "fa-project-diagram" -> "\uD83D\uDCC1" // 📁
                "fa-comments" -> "\uD83D\uDCAC"        // 💬
                else -> "\uD83D\uDCDA"                 // 📚
            }
        }
    }
}
