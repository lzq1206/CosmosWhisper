package com.lzq1206.cosmoswhisper.android

import android.appwidget.AppWidgetManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class PinWidgetReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val appWidgetId = intent.getIntExtra(
            AppWidgetManager.EXTRA_APPWIDGET_ID,
            AppWidgetManager.INVALID_APPWIDGET_ID
        )
        if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) return

        val kind = if (intent.getStringExtra(EXTRA_KIND) == "active-planisphere") {
            "active-planisphere"
        } else {
            "visible-sky"
        }
        context.getSharedPreferences(MainActivity.PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString("widget-$appWidgetId-kind", kind)
            .apply()
        PlanisphereWidgetProvider.scheduleRefresh(context)
        PlanisphereWidgetProvider.refreshWidgets(context)
    }

    companion object {
        const val EXTRA_KIND = "com.lzq1206.cosmoswhisper.android.widgetKind"
    }
}
