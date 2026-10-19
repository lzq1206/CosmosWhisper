package com.lzq1206.cosmoswhisper.android

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.view.View
import android.widget.RemoteViews

class PlanisphereWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, appWidgetIds: IntArray) {
        scheduleRefresh(context)
        refreshWidgets(context)
    }

    override fun onEnabled(context: Context) {
        scheduleRefresh(context)
    }

    override fun onDisabled(context: Context) {
        try {
            context.getSystemService(android.app.job.JobScheduler::class.java)
                .cancel(WidgetRefreshJobService.JOB_ID)
        } catch (_: Exception) {
            // The operating system may already have removed this job.
        }
    }

    override fun onDeleted(context: Context, appWidgetIds: IntArray) {
        val editor = context.getSharedPreferences(MainActivity.PREFS_NAME, Context.MODE_PRIVATE).edit()
        appWidgetIds.forEach { id -> editor.remove("widget-" + id + "-kind") }
        editor.apply()
    }

    override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, appWidgetId: Int, newOptions: android.os.Bundle) {
        super.onAppWidgetOptionsChanged(context, manager, appWidgetId, newOptions)
        refreshWidgets(context)
    }

    companion object {
        fun scheduleRefresh(context: Context) {
            val component = ComponentName(context, WidgetRefreshJobService::class.java)
            val job = android.app.job.JobInfo.Builder(WidgetRefreshJobService.JOB_ID, component)
                .setPersisted(true)
                .setPeriodic(15 * 60 * 1000L, 5 * 60 * 1000L)
                .build()
            try {
                context.getSystemService(android.app.job.JobScheduler::class.java).schedule(job)
            } catch (_: Exception) {
                // A manual refresh remains available if the system declines this job.
            }
        }

        fun refreshWidgets(context: Context, onComplete: (() -> Unit)? = null) {
            LocalWidgetRenderer.renderAll(context.applicationContext, onComplete)
        }

        fun updateWidgetImage(context: Context, id: Int, bitmap: Bitmap, kind: String) {
            val manager = AppWidgetManager.getInstance(context)
            val views = baseViews(context, id)
            views.setImageViewBitmap(R.id.widget_chart, bitmap)
            views.setViewVisibility(R.id.widget_status, View.GONE)
            val title = if (kind == "active-planisphere") "活动星盘" else "可见天区"
            views.setContentDescription(R.id.widget_chart, "CosmosWhisper " + title + " · 手机当前位置")
            manager.updateAppWidget(id, views)
        }

        fun showWidgetStatus(context: Context, id: Int, message: String) {
            val manager = AppWidgetManager.getInstance(context)
            val views = baseViews(context, id)
            views.setTextViewText(R.id.widget_status, message)
            views.setViewVisibility(R.id.widget_status, View.VISIBLE)
            manager.updateAppWidget(id, views)
        }

        private fun baseViews(context: Context, id: Int): RemoteViews {
            val views = RemoteViews(context.packageName, R.layout.widget_planisphere)
            val intent = Intent(context, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            val pending = PendingIntent.getActivity(
                context,
                id,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_chart, pending)
            views.setOnClickPendingIntent(R.id.widget_status, pending)
            return views
        }
    }
}
