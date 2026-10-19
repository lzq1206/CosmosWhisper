package com.lzq1206.cosmoswhisper.android

import android.app.job.JobParameters
import android.app.job.JobService

class WidgetRefreshJobService : JobService() {
    override fun onStartJob(params: JobParameters): Boolean {
        PlanisphereWidgetProvider.refreshWidgets(applicationContext) {
            jobFinished(params, false)
        }
        return true
    }

    override fun onStopJob(params: JobParameters): Boolean = true

    companion object {
        const val JOB_ID = 1515
    }
}
