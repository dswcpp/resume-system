package com.dswcpp.interview

import android.app.Application

class InterviewApp : Application() {
    override fun onCreate() {
        super.onCreate()
        instance = this
    }

    companion object {
        lateinit var instance: InterviewApp
            private set
    }
}
