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

open class PlanisphereWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, appWidgetIds: IntArray) {
        scheduleRefresh(context)
        refreshWidgets(context)
    }

    override fun onEnabled(context: Context) {
        scheduleRefresh(context)
    }

    override fun onDisabled(context: Context) {
        val manager = AppWidgetManager.getInstance(context)
        if (VARIANTS.any { variant ->
                manager.getAppWidgetIds(ComponentName(context, variant.providerClass)).isNotEmpty()
            }) return
        try {
            context.getSystemService(android.app.job.JobScheduler::class.java)
                .cancel(WidgetRefreshJobService.JOB_ID)
        } catch (_: Exception) {
            // The operating system may already have removed this job.
        }
    }

    override fun onDeleted(context: Context, appWidgetIds: IntArray) {
        val editor = context.getSharedPreferences(MainActivity.PREFS_NAME, Context.MODE_PRIVATE).edit()
        appWidgetIds.forEach { id ->
            editor.remove("widget-" + id + "-kind")
            editor.remove("widget-" + id + "-clockHands")
        }
        editor.apply()
    }

    override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, appWidgetId: Int, newOptions: android.os.Bundle) {
        super.onAppWidgetOptionsChanged(context, manager, appWidgetId, newOptions)
        refreshWidgets(context)
    }

    companion object {
        val VARIANTS = listOf(
            PlanisphereWidgetVariant(PlanisphereWidgetProvider::class.java, "visible-sky", true, true),
            PlanisphereWidgetVariant(LargeVisibleNoClockWidgetProvider::class.java, "visible-sky", false, true),
            PlanisphereWidgetVariant(LargeActiveClockWidgetProvider::class.java, "active-planisphere", true, true),
            PlanisphereWidgetVariant(LargeActiveNoClockWidgetProvider::class.java, "active-planisphere", false, true),
            PlanisphereWidgetVariant(SmallPlanisphereWidgetProvider::class.java, "visible-sky", true, false),
            PlanisphereWidgetVariant(SmallVisibleNoClockWidgetProvider::class.java, "visible-sky", false, false),
            PlanisphereWidgetVariant(SmallActiveClockWidgetProvider::class.java, "active-planisphere", true, false),
            PlanisphereWidgetVariant(SmallActiveNoClockWidgetProvider::class.java, "active-planisphere", false, false)
        )

        fun providerFor(isLarge: Boolean, kind: String, clockHands: Boolean): Class<out PlanisphereWidgetProvider> =
            VARIANTS.first {
                it.isLarge == isLarge && it.kind == kind && it.clockHands == clockHands
            }.providerClass

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
            val showClockHands = context.getSharedPreferences(MainActivity.PREFS_NAME, Context.MODE_PRIVATE)
                .getBoolean("widget-$id-clockHands", true)
            views.setViewVisibility(R.id.widget_clock, if (showClockHands) View.VISIBLE else View.GONE)
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

class SmallPlanisphereWidgetProvider : PlanisphereWidgetProvider()
class LargeVisibleNoClockWidgetProvider : PlanisphereWidgetProvider()
class LargeActiveClockWidgetProvider : PlanisphereWidgetProvider()
class LargeActiveNoClockWidgetProvider : PlanisphereWidgetProvider()
class SmallVisibleNoClockWidgetProvider : PlanisphereWidgetProvider()
class SmallActiveClockWidgetProvider : PlanisphereWidgetProvider()
class SmallActiveNoClockWidgetProvider : PlanisphereWidgetProvider()

data class PlanisphereWidgetVariant(
    val providerClass: Class<out PlanisphereWidgetProvider>,
    val kind: String,
    val clockHands: Boolean,
    val isLarge: Boolean
)
