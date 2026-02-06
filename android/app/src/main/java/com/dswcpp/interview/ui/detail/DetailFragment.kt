package com.dswcpp.interview.ui.detail

import android.annotation.SuppressLint
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.webkit.WebViewClient
import androidx.fragment.app.Fragment
import androidx.navigation.fragment.findNavController
import com.dswcpp.interview.data.QuestionRepository
import com.dswcpp.interview.databinding.FragmentDetailBinding

class DetailFragment : Fragment() {

    private var _binding: FragmentDetailBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View {
        _binding = FragmentDetailBinding.inflate(inflater, container, false)
        return binding.root
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val categoryKey = arguments?.getString("categoryKey")
        val questionId = arguments?.getString("questionId")

        binding.toolbar.setNavigationOnClickListener {
            findNavController().navigateUp()
        }

        if (categoryKey == null || questionId == null) {
            binding.progressLoading.visibility = View.GONE
            binding.tvEmpty.visibility = View.VISIBLE
            return
        }

        val repo = QuestionRepository(requireContext())
        val markdown = repo.loadDetail(categoryKey, questionId)

        if (markdown.isNullOrBlank()) {
            binding.progressLoading.visibility = View.GONE
            binding.tvEmpty.visibility = View.VISIBLE
            return
        }

        setupWebView(markdown)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView(markdown: String) {
        binding.webview.settings.apply {
            javaScriptEnabled = true
            allowFileAccess = true
            domStorageEnabled = true
            setSupportZoom(true)
            builtInZoomControls = true
            displayZoomControls = false
        }

        binding.webview.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: android.webkit.WebView?, url: String?) {
                super.onPageFinished(view, url)
                if (_binding == null) return  // Fragment 已销毁时不操作
                val escapedMd = escapeForJs(markdown)
                binding.webview.evaluateJavascript(
                    "renderMarkdown(`$escapedMd`);", null
                )
                binding.progressLoading.visibility = View.GONE
            }
        }

        binding.webview.loadUrl("file:///android_asset/web/detail_viewer.html")
    }

    private fun escapeForJs(text: String): String {
        return text
            .replace("\\", "\\\\")
            .replace("`", "\\`")
            .replace("\$", "\\\$")
            .replace("\n", "\\n")
            .replace("\r", "")
    }

    override fun onDestroyView() {
        // 先从父容器移除 WebView，再销毁，防止内存泄漏
        _binding?.let { b ->
            (b.webview.parent as? ViewGroup)?.removeView(b.webview)
            b.webview.stopLoading()
            b.webview.destroy()
        }
        super.onDestroyView()
        _binding = null
    }
}
