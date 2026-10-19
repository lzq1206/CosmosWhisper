package com.lzq1206.cosmoswhisper.android

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.Intent
import android.graphics.Color
import android.location.Location
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Spinner
import android.widget.TextView
import android.widget.Toast
import java.util.Locale

class WidgetConfigActivity : Activity() {
    private lateinit var typeSpinner: Spinner
    private lateinit var locationLabel: TextView
    private var appWidgetId = AppWidgetManager.INVALID_APPWIDGET_ID
    private var pendingAdd = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setResult(RESULT_CANCELED)
        appWidgetId = intent?.extras?.getInt(
            AppWidgetManager.EXTRA_APPWIDGET_ID,
            AppWidgetManager.INVALID_APPWIDGET_ID
        ) ?: AppWidgetManager.INVALID_APPWIDGET_ID
        if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish()
            return
        }
        buildScreen()
        if (CityLocator.hasPermission(this)) requestPhoneLocation()
    }

    private fun buildScreen() {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(22), dp(24), dp(22), dp(20))
            setBackgroundColor(Color.rgb(3, 8, 23))
        }
        val scroll = ScrollView(this).apply { addView(root) }
        root.addView(label("设置星盘小组件", 24, Color.rgb(240, 238, 229), true))
        root.addView(label("星盘会在手机本地绘制；不从网站下载图像或天文数据。", 13, Color.rgb(157, 172, 197), false).withTop(dp(8)))

        root.addView(label("星盘版本", 13, Color.rgb(201, 215, 235), true).withTop(dp(22)))
        typeSpinner = spinner(listOf("可见天区", "活动星盘"))
        root.addView(typeSpinner)
        typeSpinner.setSelection(
            if (getSharedPreferences(MainActivity.PREFS_NAME, MODE_PRIVATE)
                    .getString(MainActivity.KEY_DEFAULT_KIND, "visible-sky") == "active-planisphere") 1 else 0
        )

        locationLabel = label(locationDescription(), 12, Color.rgb(157, 172, 197), false).withTop(dp(20)) as TextView
        root.addView(locationLabel)
        val locateButton = button("更新手机位置")
        root.addView(locateButton.withTop(dp(10)))
        locateButton.setOnClickListener { requestPhoneLocation() }

        val addButton = button("添加小组件")
        root.addView(addButton.withTop(dp(14)))
        addButton.setOnClickListener {
            if (locationRequestInFlight) {
                pendingAdd = true
                toast("正在更新手机位置…")
                return@setOnClickListener
            }
            if (storedLocation() == null) {
                pendingAdd = true
                requestPhoneLocation()
            } else {
                saveWidget()
            }
        }
        setContentView(scroll)
    }

    private fun requestPhoneLocation() {
        if (!CityLocator.hasPermission(this)) {
            CityLocator.askPermission(this, LOCATION_PERMISSION_REQUEST)
            return
        }
        if (locationRequestInFlight) return
        locationRequestInFlight = true
        toast("正在获取手机位置…")
        CityLocator.requestLocation(this) { location -> applyPhoneLocation(location) }
    }

    private fun applyPhoneLocation(location: Location?) {
        if (location == null) {
            runOnUiThread {
                locationRequestInFlight = false
                if (pendingAdd && storedLocation() != null) saveWidget()
                else {
                    pendingAdd = false
                    toast("没有取得手机位置，请打开系统定位后重试。")
                }
            }
            return
        }
        getSharedPreferences(MainActivity.PREFS_NAME, MODE_PRIVATE).edit()
            .putString(MainActivity.KEY_LOCATION_LATITUDE, location.latitude.toString())
            .putString(MainActivity.KEY_LOCATION_LONGITUDE, location.longitude.toString())
            .putString(MainActivity.KEY_LOCATION_NAME, "当前位置")
            .apply()
        runOnUiThread {
            locationRequestInFlight = false
            locationLabel.text = locationDescription()
            if (pendingAdd) saveWidget()
        }
    }

    private fun saveWidget() {
        val kind = if (typeSpinner.selectedItemPosition == 1) "active-planisphere" else "visible-sky"
        getSharedPreferences(MainActivity.PREFS_NAME, MODE_PRIVATE).edit()
            .putString(MainActivity.KEY_DEFAULT_KIND, kind)
            .putString("widget-" + appWidgetId + "-kind", kind)
            .apply()

        val result = Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
        setResult(RESULT_OK, result)
        PlanisphereWidgetProvider.scheduleRefresh(this)
        PlanisphereWidgetProvider.refreshWidgets(this)
        finish()
    }

    private fun storedLocation(): Pair<Double, Double>? {
        val prefs = getSharedPreferences(MainActivity.PREFS_NAME, MODE_PRIVATE)
        val latitude = prefs.getString(MainActivity.KEY_LOCATION_LATITUDE, null)?.toDoubleOrNull() ?: return null
        val longitude = prefs.getString(MainActivity.KEY_LOCATION_LONGITUDE, null)?.toDoubleOrNull() ?: return null
        return if (latitude in -90.0..90.0 && longitude in -180.0..180.0) latitude to longitude else null
    }

    private fun locationDescription(): String {
        val location = storedLocation() ?: return "尚未保存手机位置。添加组件时会请求定位权限。"
        return String.format(Locale.getDefault(), "当前手机位置：%.3f, %.3f", location.first, location.second)
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != LOCATION_PERMISSION_REQUEST) return
        if (CityLocator.hasPermission(this)) requestPhoneLocation()
        else {
            pendingAdd = false
            toast("未允许定位，无法按手机位置生成星盘。")
        }
    }

    private fun spinner(items: List<String>) = Spinner(this).apply {
        adapter = ArrayAdapter(this@WidgetConfigActivity, android.R.layout.simple_spinner_item, items).also {
            it.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        }
        setPadding(dp(10), dp(3), dp(10), dp(3))
    }

    private fun label(value: String, size: Int, color: Int, bold: Boolean) =
        TextView(this).apply {
            text = value
            textSize = size.toFloat()
            setTextColor(color)
            gravity = Gravity.CENTER_VERTICAL
            if (bold) setTypeface(typeface, android.graphics.Typeface.BOLD)
            setLineSpacing(dp(3).toFloat(), 1f)
        }

    private fun button(value: String) = Button(this).apply {
        text = value
        isAllCaps = false
        setTextColor(Color.rgb(242, 215, 156))
        setBackgroundColor(Color.rgb(17, 34, 64))
        minHeight = dp(48)
    }

    private fun android.view.View.withTop(top: Int): android.view.View {
        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
            topMargin = top
        }
        return this
    }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
    private fun toast(message: String) = Toast.makeText(this, message, Toast.LENGTH_LONG).show()

    companion object {
        private const val LOCATION_PERMISSION_REQUEST = 6405
    }

    private var locationRequestInFlight = false
}
