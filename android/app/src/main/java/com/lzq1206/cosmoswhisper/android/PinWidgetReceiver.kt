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
        val showClockHands = intent.getBooleanExtra(EXTRA_CLOCK_HANDS, true)
        val prefs = context.getSharedPreferences(MainActivity.PREFS_NAME, Context.MODE_PRIVATE)
        val kindKey = "widget-$appWidgetId-kind"
        val clockHandsKey = "widget-$appWidgetId-clockHands"
        val editor = prefs.edit()
        if (!prefs.contains(kindKey)) editor.putString(kindKey, kind)
        if (!prefs.contains(clockHandsKey)) editor.putBoolean(clockHandsKey, showClockHands)
        editor.apply()
        PlanisphereWidgetProvider.scheduleRefresh(context)
        PlanisphereWidgetProvider.refreshWidgets(context)
    }

    companion object {
        const val EXTRA_KIND = "com.lzq1206.cosmoswhisper.android.widgetKind"
        const val EXTRA_CLOCK_HANDS = "com.lzq1206.cosmoswhisper.android.clockHands"
    }
}
