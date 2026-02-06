package com.dswcpp.interview

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.navigation.fragment.NavHostFragment
import com.dswcpp.interview.databinding.ActivityMainBinding

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
    }

    fun getNavController() =
        (supportFragmentManager.findFragmentById(R.id.nav_host) as? NavHostFragment)
            ?.navController
            ?: throw IllegalStateException("NavHostFragment not found")
}
