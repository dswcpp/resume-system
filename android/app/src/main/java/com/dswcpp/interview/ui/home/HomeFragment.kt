package com.dswcpp.interview.ui.home

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.GridLayoutManager
import com.dswcpp.interview.R
import com.dswcpp.interview.data.ProgressManager
import com.dswcpp.interview.data.QuestionRepository
import com.dswcpp.interview.databinding.FragmentHomeBinding
import com.dswcpp.interview.ui.quickref.QuickRefSheet
import com.google.android.material.dialog.MaterialAlertDialogBuilder

class HomeFragment : Fragment() {

    private var _binding: FragmentHomeBinding? = null
    private val binding get() = _binding!!

    private lateinit var repo: QuestionRepository
    private lateinit var progressManager: ProgressManager
    private lateinit var adapter: CategoryAdapter

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View {
        _binding = FragmentHomeBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        repo = QuestionRepository(requireContext())
        progressManager = ProgressManager(requireContext())

        adapter = CategoryAdapter(progressManager) { category ->
            val bundle = Bundle().apply {
                putString("categoryKey", category.key)
            }
            findNavController().navigate(R.id.action_home_to_practice, bundle)
        }

        binding.rvCategories.layoutManager = GridLayoutManager(requireContext(), 2)
        binding.rvCategories.adapter = adapter

        binding.btnStats.setOnClickListener {
            findNavController().navigate(R.id.action_home_to_stats)
        }

        binding.btnClear.setOnClickListener {
            MaterialAlertDialogBuilder(requireContext())
                .setTitle(R.string.confirm_clear_title)
                .setMessage(R.string.confirm_clear_msg)
                .setNegativeButton(R.string.cancel, null)
                .setPositiveButton(R.string.confirm) { _, _ ->
                    progressManager.clearAll()
                    loadCategories()
                }
                .show()
        }

        binding.fabQuickref.setOnClickListener {
            QuickRefSheet().show(childFragmentManager, "quickref")
        }
    }

    override fun onResume() {
        super.onResume()
        loadCategories()
    }

    private fun loadCategories() {
        val categories = repo.getCategories()
        adapter.submitList(categories)
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
