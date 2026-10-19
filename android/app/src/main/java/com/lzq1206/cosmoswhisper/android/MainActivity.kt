package com.lzq1206.cosmoswhisper.android

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.location.Location
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import org.json.JSONObject

class MainActivity : Activity() {
    private val prefs by lazy { getSharedPreferences(PREFS_NAME, MODE_PRIVATE) }
    private lateinit var chartView: WebView
    private lateinit var locationLabel: TextView
    private lateinit var visibleButton: Button
    private lateinit var activeButton: Button
    private var currentKind = "visible-sky"
    private var pendingNativeLocation = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        currentKind = prefs.getString(KEY_DEFAULT_KIND, "visible-sky") ?: "visible-sky"
        buildScreen()
        PlanisphereWidgetProvider.scheduleRefresh(this)
        loadChart(currentKind)
        if (CityLocator.hasPermission(this)) {
            updateFromPhoneLocation()
        } else {
            pendingNativeLocation = true
            CityLocator.askPermission(this, LOCATION_PERMISSION_REQUEST)
        }
    }

    private fun buildScreen() {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(14), dp(10), dp(14), dp(10))
            setBackgroundColor(Color.rgb(3, 8, 23))
        }
        root.addView(text("CosmosWhisper 星盘", 22, Color.rgb(240, 238, 229), true).withBottom(dp(2)))
        locationLabel = text(locationDescription(), 11, Color.rgb(145, 161, 188), false)
        root.addView(locationLabel.withBottom(dp(8)))

        val chartSelector = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        visibleButton = button("可见天区")
        activeButton = button("活动星盘")
        chartSelector.addView(visibleButton, LinearLayout.LayoutParams(0, dp(42), 1f).apply { marginEnd = dp(5) })
        chartSelector.addView(activeButton, LinearLayout.LayoutParams(0, dp(42), 1f).apply { marginStart = dp(5) })
        root.addView(chartSelector)
        visibleButton.setOnClickListener { loadChart("visible-sky") }
        activeButton.setOnClickListener { loadChart("active-planisphere") }

        chartView = WebView(this)
        chartView.setBackgroundColor(Color.rgb(3, 8, 23))
        chartView.settings.javaScriptEnabled = true
        chartView.settings.domStorageEnabled = true
        chartView.settings.allowFileAccess = false
        chartView.settings.allowContentAccess = false
        chartView.webViewClient = OfflineWebViewSupport.createClient(this)
        root.addView(chartView, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f).apply {
            topMargin = dp(8)
            bottomMargin = dp(8)
        })

        val actions = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        val locate = button("手机定位")
        val import = button("导入配置")
        val refresh = button("刷新小组件")
        actions.addView(locate, LinearLayout.LayoutParams(0, dp(42), 1f).apply { marginEnd = dp(4) })
        actions.addView(import, LinearLayout.LayoutParams(0, dp(42), 1f).apply {
            marginStart = dp(2)
            marginEnd = dp(2)
        })
        actions.addView(refresh, LinearLayout.LayoutParams(0, dp(42), 1f).apply { marginStart = dp(4) })
        root.addView(actions)
        locate.setOnClickListener { updateFromPhoneLocation() }
        import.setOnClickListener { openConfigPicker() }
        refresh.setOnClickListener {
            PlanisphereWidgetProvider.refreshWidgets(this)
            toast("已用本机数据重绘桌面星盘。")
        }
        setContentView(root)
        updateSelectorStyle()
    }

    private fun loadChart(kind: String) {
        currentKind = if (kind == "active-planisphere") "active-planisphere" else "visible-sky"
        prefs.edit().putString(KEY_DEFAULT_KIND, currentKind).apply()
        if (::visibleButton.isInitialized) updateSelectorStyle()
        if (!::chartView.isInitialized) return

        val url = StringBuilder(OfflineWebViewSupport.BASE_URL)
        url.append(if (currentKind == "active-planisphere") "/offline/active.html" else "/offline/visible.html")
        val location = storedLocation()
        if (location != null) {
            url.append("?lat=").append(location.first)
            url.append("&lon=").append(location.second)
            url.append("&name=").append(Uri.encode(location.third))
        }
        chartView.loadUrl(url.toString())
    }

    private fun updateSelectorStyle() {
        visibleButton.alpha = if (currentKind == "visible-sky") 1f else 0.66f
        activeButton.alpha = if (currentKind == "active-planisphere") 1f else 0.66f
    }

    private fun updateFromPhoneLocation() {
        if (!CityLocator.hasPermission(this)) {
            pendingNativeLocation = true
            CityLocator.askPermission(this, LOCATION_PERMISSION_REQUEST)
            return
        }
        CityLocator.requestLocation(this) { location -> applyPhoneLocation(location) }
    }

    private fun applyPhoneLocation(location: Location?) {
        if (location == null) {
            runOnUiThread { toast("没有取得手机位置，请确认系统定位已开启。") }
            return
        }
        storeLocation(location.latitude, location.longitude, "当前位置")
        runOnUiThread {
            locationLabel.text = locationDescription()
            loadChart(currentKind)
            PlanisphereWidgetProvider.refreshWidgets(this)
        }
    }

    private fun storeLocation(latitude: Double, longitude: Double, name: String) {
        if (latitude !in -90.0..90.0 || longitude !in -180.0..180.0) return
        prefs.edit()
            .putString(KEY_LOCATION_LATITUDE, latitude.toString())
            .putString(KEY_LOCATION_LONGITUDE, longitude.toString())
            .putString(KEY_LOCATION_NAME, name)
            .apply()
    }

    private fun storedLocation(): Triple<Double, Double, String>? {
        val latitude = prefs.getString(KEY_LOCATION_LATITUDE, null)?.toDoubleOrNull() ?: return null
        val longitude = prefs.getString(KEY_LOCATION_LONGITUDE, null)?.toDoubleOrNull() ?: return null
        if (latitude !in -90.0..90.0 || longitude !in -180.0..180.0) return null
        return Triple(latitude, longitude, prefs.getString(KEY_LOCATION_NAME, "当前位置") ?: "当前位置")
    }

    private fun locationDescription(): String = storedLocation()?.let {
        "按手机位置绘制 · " + String.format("%.3f, %.3f", it.first, it.second)
    } ?: "首次使用时允许定位，星图将在手机本地按当前位置绘制"

    private fun openConfigPicker() {
        val picker = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "*/*"
        }
        try {
            startActivityForResult(picker, CONFIG_REQUEST)
        } catch (_: Exception) {
            toast("无法打开文件选择器。")
        }
    }

    @Deprecated("Uses the platform document picker for configuration files.")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != CONFIG_REQUEST || resultCode != RESULT_OK) return
        try {
            val contents = contentResolver.openInputStream(data?.data ?: return)?.bufferedReader()?.use { it.readText() }
                ?: throw IllegalArgumentException("empty")
            val config = JSONObject(contents)
            require(config.optInt("formatVersion") == 1)
            require(config.optString("appId") == packageName)
            val widget = config.optJSONObject("defaultWidget") ?: throw IllegalArgumentException("widget")
            val kind = widget.optString("type", "visible-sky")
            require(kind == "visible-sky" || kind == "active-planisphere")
            prefs.edit().putString(KEY_DEFAULT_KIND, kind).apply()
            loadChart(kind)
            toast("已导入配置；添加新小组件时会使用此星盘版本。")
        } catch (_: Exception) {
            toast("配置文件无法读取，请选择 CosmosWhisper 提供的 JSON 文件。")
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != LOCATION_PERMISSION_REQUEST) return
        if (pendingNativeLocation) {
            pendingNativeLocation = false
            if (CityLocator.hasPermission(this)) updateFromPhoneLocation()
            else {
                locationLabel.text = "未允许定位；点“手机定位”后可按当前位置绘制"
                toast("未允许定位；星图会暂用上次保存的位置。")
            }
        }
    }

    private fun text(value: String, size: Int, color: Int, bold: Boolean) =
        TextView(this).apply {
            text = value
            textSize = size.toFloat()
            setTextColor(color)
            gravity = Gravity.CENTER_VERTICAL
            if (bold) setTypeface(typeface, android.graphics.Typeface.BOLD)
        }

    private fun button(value: String) = Button(this).apply {
        text = value
        isAllCaps = false
        textSize = 11f
        setTextColor(Color.rgb(242, 215, 156))
        setBackgroundColor(Color.rgb(17, 34, 64))
        minHeight = dp(42)
        minimumHeight = dp(42)
        setPadding(dp(4), 0, dp(4), 0)
    }

    private fun android.view.View.withBottom(bottom: Int): android.view.View {
        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
            bottomMargin = bottom
        }
        return this
    }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
    private fun toast(message: String) = Toast.makeText(this, message, Toast.LENGTH_LONG).show()

    companion object {
        const val PREFS_NAME = "widget-settings"
        const val KEY_DEFAULT_KIND = "defaultKind"
        const val KEY_LOCATION_LATITUDE = "phoneLatitude"
        const val KEY_LOCATION_LONGITUDE = "phoneLongitude"
        const val KEY_LOCATION_NAME = "phoneLocationName"
        private const val CONFIG_REQUEST = 6304
        private const val LOCATION_PERMISSION_REQUEST = 6305
    }
}
