package com.lzq1206.cosmoswhisper.android

import android.app.Activity
import android.app.AlertDialog
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Intent
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.location.Location
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowInsets
import android.webkit.WebView
import android.widget.Button
import android.widget.CheckBox
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.Spinner
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast

class MainActivity : Activity() {
    private val prefs by lazy { getSharedPreferences(PREFS_NAME, MODE_PRIVATE) }
    private lateinit var chartView: WebView
    private lateinit var locationLabel: TextView
    private lateinit var visibleButton: Button
    private lateinit var activeButton: Button
    private lateinit var clockPreviewCheckBox: CheckBox
    private lateinit var clockOverlay: View
    private lateinit var cosmosPage: View
    private lateinit var rocketPage: View
    private lateinit var cosmosTab: LinearLayout
    private lateinit var rocketTab: LinearLayout
    private lateinit var rocketPreviewImage: ImageView
    private lateinit var rocketPreviewFrame: FrameLayout
    private lateinit var rocketStatus: TextView
    private lateinit var rocketSizeSpinner: Spinner
    private var currentKind = "active-planisphere"
    private var currentRocketSize = "4x4"
    private var rocketPreviewRequest = 0
    private var pendingNativeLocation = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = Color.rgb(3, 8, 23)
        window.navigationBarColor = Color.rgb(3, 8, 23)
        currentKind = if (prefs.getBoolean(KEY_DEFAULT_KIND_USER_SELECTED, false)) {
            prefs.getString(KEY_DEFAULT_KIND, "active-planisphere") ?: "active-planisphere"
        } else {
            "active-planisphere"
        }
        prefs.edit().putString(KEY_DEFAULT_KIND, currentKind).apply()
        buildScreen()
        if (intent.getBooleanExtra(EXTRA_OPEN_ROCKET, false)) showFeaturePage(true)
        PlanisphereWidgetProvider.scheduleRefresh(this)
        RocketWidgetProvider.scheduleRefresh(this)
        loadChart(currentKind)
        if (CityLocator.hasPermission(this)) {
            updateFromPhoneLocation()
        } else {
            pendingNativeLocation = true
            CityLocator.askPermission(this, LOCATION_PERMISSION_REQUEST)
        }
    }

    private fun buildScreen() {
        val cosmosContent = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(14), dp(10), dp(14), dp(10))
            setBackgroundColor(Color.rgb(3, 8, 23))
        }
        cosmosContent.addView(text("CosmosWhisper 星盘", 22, Color.rgb(240, 238, 229), true).withBottom(dp(2)))
        locationLabel = text(locationDescription(), 11, Color.rgb(145, 161, 188), false)
        cosmosContent.addView(locationLabel.withBottom(dp(8)))

        val chartSelector = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        visibleButton = button("可见天区")
        activeButton = button("活动星盘")
        chartSelector.addView(visibleButton, LinearLayout.LayoutParams(0, dp(42), 1f).apply { marginEnd = dp(5) })
        chartSelector.addView(activeButton, LinearLayout.LayoutParams(0, dp(42), 1f).apply { marginStart = dp(5) })
        cosmosContent.addView(chartSelector)
        visibleButton.setOnClickListener { loadChart("visible-sky", userSelection = true) }
        activeButton.setOnClickListener { loadChart("active-planisphere", userSelection = true) }

        clockPreviewCheckBox = CheckBox(this).apply {
            text = "显示时针、分针和秒针"
            setTextColor(Color.rgb(225, 232, 242))
            isChecked = prefs.getBoolean(KEY_DEFAULT_CLOCK_HANDS, false)
            buttonTintList = android.content.res.ColorStateList.valueOf(Color.rgb(205, 217, 233))
        }
        cosmosContent.addView(clockPreviewCheckBox.withBottom(dp(2)))

        chartView = WebView(this)
        chartView.setBackgroundColor(Color.rgb(3, 8, 23))
        chartView.settings.javaScriptEnabled = true
        chartView.settings.domStorageEnabled = true
        chartView.settings.allowFileAccess = false
        chartView.settings.allowContentAccess = false
        chartView.webViewClient = OfflineWebViewSupport.createClient(this)
        val chartContainer = FrameLayout(this).apply { setBackgroundColor(Color.rgb(3, 8, 23)) }
        chartContainer.addView(chartView, FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ))
        clockOverlay = layoutInflater.inflate(R.layout.clock_overlay, chartContainer, false).apply {
            visibility = if (clockPreviewCheckBox.isChecked) View.VISIBLE else View.GONE
            scaleX = 0.82f
            scaleY = 0.82f
        }
        chartContainer.addView(clockOverlay)
        clockPreviewCheckBox.setOnCheckedChangeListener { _, checked ->
            prefs.edit().putBoolean(KEY_DEFAULT_CLOCK_HANDS, checked).apply()
            clockOverlay.visibility = if (checked) View.VISIBLE else View.GONE
        }
        cosmosContent.addView(chartContainer, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f).apply {
            topMargin = dp(8)
            bottomMargin = dp(8)
        })

        val batteryHint = text(
            "建议在系统设置中将本应用的电池用量设为“不受限制”，避免桌面小组件刷新延迟。点此打开应用设置。",
            10,
            Color.rgb(145, 161, 188),
            false
        ).apply {
            setOnClickListener { openBatterySettings() }
        }
        cosmosContent.addView(batteryHint.withBottom(dp(5)))

        val actions = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        val locate = button("手机定位")
        val addWidget = button("添加到桌面")
        val refresh = button("刷新小组件")
        actions.addView(locate, LinearLayout.LayoutParams(0, dp(42), 1f).apply { marginEnd = dp(4) })
        actions.addView(addWidget, LinearLayout.LayoutParams(0, dp(42), 1f).apply {
            marginStart = dp(2)
            marginEnd = dp(2)
        })
        actions.addView(refresh, LinearLayout.LayoutParams(0, dp(42), 1f).apply { marginStart = dp(4) })
        cosmosContent.addView(actions)
        locate.setOnClickListener { updateFromPhoneLocation() }
        addWidget.setOnClickListener { showAddWidgetDialog() }
        refresh.setOnClickListener {
            PlanisphereWidgetProvider.refreshWidgets(this)
            toast("已用本机数据重绘桌面星盘。")
        }
        cosmosPage = cosmosContent
        rocketPage = buildRocketPage()
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(12), dp(8), dp(12), dp(8))
            setBackgroundColor(Color.rgb(3, 8, 23))
        }
        val tabs = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.BOTTOM
            setBackgroundColor(Color.TRANSPARENT)
        }
        cosmosTab = featureTab("CosmosWhisper", "🌌", Color.rgb(74, 166, 255))
        rocketTab = featureTab("RocketWhisper", "🚀", Color.rgb(40, 196, 232))
        tabs.addView(cosmosTab, LinearLayout.LayoutParams(0, dp(48), 1f).apply { marginEnd = dp(4) })
        tabs.addView(rocketTab, LinearLayout.LayoutParams(0, dp(48), 1f).apply { marginStart = dp(4) })
        root.addView(tabs, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(54)))
        val pageFrame = FrameLayout(this)
        pageFrame.addView(cosmosPage, FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ))
        pageFrame.addView(rocketPage, FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ))
        root.addView(pageFrame, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f).apply {
            topMargin = dp(8)
        })
        cosmosTab.setOnClickListener { showFeaturePage(false) }
        rocketTab.setOnClickListener { showFeaturePage(true) }
        root.setOnApplyWindowInsetsListener { view, insets ->
            val statusInset = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                insets.getInsets(WindowInsets.Type.statusBars()).top
            } else {
                insets.systemWindowInsetTop
            }
            val navigationInset = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                insets.getInsets(WindowInsets.Type.navigationBars()).bottom
            } else {
                insets.systemWindowInsetBottom
            }
            view.setPadding(dp(12), statusInset + dp(8), dp(12), navigationInset + dp(8))
            insets
        }
        setContentView(root)
        root.requestApplyInsets()
        showFeaturePage(false)
        updateSelectorStyle()
        updateFeatureTabStyles(false)
    }

    private fun buildRocketPage(): View {
        val page = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.rgb(3, 8, 23))
            setPadding(0, 0, 0, dp(8))
        }
        val scroll = ScrollView(this).apply {
            isFillViewport = true
            clipToPadding = false
            setBackgroundColor(Color.rgb(3, 8, 23))
        }
        scroll.addView(page, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        page.addView(text("RocketWhisper 火箭地图", 21, Color.rgb(240, 238, 229), true).withBottom(dp(2)))
        page.addView(text("中国区域 · 服务器图片每两小时更新", 11, Color.rgb(145, 161, 188), false).withBottom(dp(8)))

        page.addView(text("桌面尺寸", 11, Color.rgb(201, 215, 235), true).withTop(dp(5)))
        rocketSizeSpinner = spinner(listOf("大方形 4×4", "小方形 2×2", "横向 4×2"))
        page.addView(rocketSizeSpinner, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(42)))
        rocketSizeSpinner.setSelection(when (prefs.getString(KEY_ROCKET_SIZE, "4x4")) {
            "2x2" -> 1
            "4x2" -> 2
            else -> 0
        })
        currentRocketSize = sizeCode(rocketSizeSpinner.selectedItemPosition)

        page.addView(text(
            "小组件从 GitHub Pages 获取定时生成的中国区域图片，每两小时请求更新一次；系统可能延迟刷新。建议将 WidgetWhisper 的电池用量设为“不受限制”。点此打开应用设置。",
            10,
            Color.rgb(145, 161, 188),
            false
        ).apply { setOnClickListener { openBatterySettings() } }.withTop(dp(5)))

        val actions = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        val addRocketWidget = button("添加到桌面")
        val refreshRocket = button("刷新")
        actions.addView(addRocketWidget, LinearLayout.LayoutParams(0, dp(42), 1f).apply { marginEnd = dp(3) })
        actions.addView(refreshRocket, LinearLayout.LayoutParams(0, dp(42), 0.7f).apply { marginStart = dp(3) })
        page.addView(actions)
        rocketStatus = text("正在从服务器加载中国区域地图…", 10, Color.rgb(145, 161, 188), false)
        page.addView(rocketStatus.withTop(dp(3)).withBottom(dp(2)))

        rocketPreviewFrame = FrameLayout(this).apply {
            setBackgroundColor(Color.rgb(3, 8, 23))
        }
        rocketPreviewImage = ImageView(this).apply {
            setBackgroundColor(Color.rgb(3, 8, 23))
            scaleType = ImageView.ScaleType.FIT_CENTER
        }
        rocketPreviewFrame.addView(rocketPreviewImage, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        page.addView(rocketPreviewFrame, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(300)).apply {
            topMargin = dp(8)
        })
        rocketPreviewFrame.post { updateRocketPreviewAspect() }

        rocketSizeSpinner.onItemSelectedListener = spinnerListener {
            currentRocketSize = sizeCode(rocketSizeSpinner.selectedItemPosition)
            prefs.edit().putString(KEY_ROCKET_SIZE, currentRocketSize).apply()
            updateRocketPreviewAspect()
            if (rocketPage.visibility == View.VISIBLE) loadRocketPreview()
        }
        addRocketWidget.setOnClickListener { addRocketWidgetToHomeScreen() }
        refreshRocket.setOnClickListener {
            RocketWidgetProvider.refreshWidgets(this)
            loadRocketPreview()
            toast("已请求刷新中国区域地图。")
        }
        return scroll
    }

    private fun showFeaturePage(showRocket: Boolean) {
        cosmosPage.visibility = if (showRocket) View.GONE else View.VISIBLE
        rocketPage.visibility = if (showRocket) View.VISIBLE else View.GONE
        updateFeatureTabStyles(showRocket)
        if (showRocket) {
            updateRocketPreviewAspect()
            loadRocketPreview()
        }
    }

    private fun loadRocketPreview() {
        if (!::rocketPreviewImage.isInitialized) return
        val request = ++rocketPreviewRequest
        val requestedSize = currentRocketSize
        rocketStatus.text = "正在从 GitHub Pages 加载中国区域地图…"
        RocketWidgetRenderer.loadPreview(this, requestedSize) { bitmap, downloaded ->
            if (request != rocketPreviewRequest) {
                bitmap?.recycle()
                return@loadPreview
            }
            if (bitmap != null) {
                rocketPreviewImage.setImageBitmap(bitmap)
                rocketStatus.text = if (downloaded) {
                    "中国区域地图已加载 · 桌面组件每两小时更新"
                } else {
                    "当前显示上次缓存图片 · 联网后会自动更新"
                }
            } else {
                rocketStatus.text = "地图暂不可用 · 请检查网络后点刷新"
            }
        }
    }

    private fun updateRocketPreviewAspect() {
        if (!::rocketPreviewFrame.isInitialized) return
        rocketPreviewFrame.post {
            val width = rocketPreviewFrame.width.takeIf { it > 0 } ?: (resources.displayMetrics.widthPixels - dp(24))
            val height = if (currentRocketSize == "4x2") width / 2 else width
            rocketPreviewFrame.layoutParams = rocketPreviewFrame.layoutParams.apply { this.height = height }
            rocketPreviewFrame.requestLayout()
        }
    }

    private fun loadChart(kind: String, userSelection: Boolean = false) {
        currentKind = if (kind == "active-planisphere") "active-planisphere" else "visible-sky"
        val editor = prefs.edit().putString(KEY_DEFAULT_KIND, currentKind)
        if (userSelection) editor.putBoolean(KEY_DEFAULT_KIND_USER_SELECTED, true)
        editor.apply()
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

    private fun featureTab(title: String, icon: String, accentColor: Int) = LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER
        setPadding(dp(8), 0, dp(8), 0)
        isClickable = true
        isFocusable = true
        val dot = View(this@MainActivity).apply {
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(accentColor)
            }
        }
        addView(dot, LinearLayout.LayoutParams(dp(7), dp(7)).apply { marginEnd = dp(7) })
        addView(TextView(this@MainActivity).apply {
            text = icon
            textSize = 13f
            gravity = Gravity.CENTER
        }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { marginEnd = dp(5) })
        addView(TextView(this@MainActivity).apply {
            text = title
            textSize = 12f
            maxLines = 1
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            setTextColor(Color.rgb(238, 243, 251))
        })
        tag = accentColor
    }

    private fun updateFeatureTabStyles(showRocket: Boolean) {
        if (!::cosmosTab.isInitialized || !::rocketTab.isInitialized) return
        fun style(tab: LinearLayout, selected: Boolean) {
            val accent = tab.tag as? Int ?: Color.rgb(74, 166, 255)
            tab.background = GradientDrawable().apply {
                cornerRadii = floatArrayOf(
                    dp(12).toFloat(), dp(12).toFloat(), dp(12).toFloat(), dp(12).toFloat(),
                    dp(3).toFloat(), dp(3).toFloat(), dp(3).toFloat(), dp(3).toFloat()
                )
                setColor(if (selected) Color.rgb(14, 34, 61) else Color.rgb(9, 17, 32))
                setStroke(dp(1), if (selected) accent else Color.rgb(32, 45, 66))
            }
            tab.elevation = if (selected) dp(5).toFloat() else dp(1).toFloat()
            tab.translationY = if (selected) -dp(3).toFloat() else dp(2).toFloat()
            tab.alpha = if (selected) 1f else 0.82f
            (tab.getChildAt(2) as? TextView)?.setTextColor(
                if (selected) Color.rgb(241, 246, 255) else Color.rgb(143, 158, 180)
            )
            val params = tab.layoutParams as? LinearLayout.LayoutParams ?: return
            params.height = dp(if (selected) 48 else 40)
            tab.layoutParams = params
        }
        style(cosmosTab, !showRocket)
        style(rocketTab, showRocket)
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

    private fun showAddWidgetDialog() {
        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(22), dp(4), dp(22), 0)
        }
        content.addView(text("组件尺寸", 13, Color.rgb(201, 215, 235), true))
        val sizeSpinner = Spinner(this).apply {
            adapter = android.widget.ArrayAdapter(
                this@MainActivity,
                android.R.layout.simple_spinner_item,
                listOf("大组件", "小组件")
            ).also { it.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item) }
            setSelection(0)
        }
        content.addView(sizeSpinner)
        val widgetClockCheckBox = CheckBox(this).apply {
            text = "显示时针、分针和秒针"
            setTextColor(Color.rgb(225, 232, 242))
            buttonTintList = android.content.res.ColorStateList.valueOf(Color.rgb(205, 217, 233))
            isChecked = clockPreviewCheckBox.isChecked
        }
        content.addView(widgetClockCheckBox)
        content.addView(text(
            "若当前页已满，请回到桌面长按空白处打开小组件列表，先滑到后续空白页再添加；也可添加后长按组件并拖到下一页。",
            11,
            Color.rgb(145, 161, 188),
            false
        ))
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            content.addView(text("当前 Android 版本可显示时针和分针；秒针需要 Android 12 或更新版本。", 11, Color.rgb(145, 161, 188), false))
        }

        AlertDialog.Builder(this)
            .setTitle("添加当前星盘")
            .setView(content)
            .setNegativeButton("取消", null)
            .setPositiveButton("继续") { _, _ ->
                val isLarge = sizeSpinner.selectedItemPosition == 0
                addSelectedWidgetToHomeScreen(isLarge, widgetClockCheckBox.isChecked)
            }
            .show()
    }

    private fun addSelectedWidgetToHomeScreen(isLarge: Boolean, showClockHands: Boolean) {
        val manager = AppWidgetManager.getInstance(this)
        val providerClass = PlanisphereWidgetProvider.providerFor(isLarge, currentKind, showClockHands)
        val provider = ComponentName(this, providerClass)
        if (!manager.isRequestPinAppWidgetSupported) {
            toast("当前桌面不支持应用内直接添加。请长按空白处打开“小组件”，滑到有空间的页面后选择对应的 CosmosWhisper 版本。")
            return
        }

        val callbackIntent = Intent(this, PinWidgetReceiver::class.java)
            .putExtra(PinWidgetReceiver.EXTRA_KIND, currentKind)
            .putExtra(PinWidgetReceiver.EXTRA_CLOCK_HANDS, showClockHands)
        val mutabilityFlag = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0
        val requestCode = System.nanoTime().toInt()
        val callback = PendingIntent.getBroadcast(
            this,
            requestCode,
            callbackIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or mutabilityFlag
        )
        val accepted = try {
            manager.requestPinAppWidget(provider, null, callback)
        } catch (_: Exception) {
            false
        }
        if (accepted) {
            val title = if (currentKind == "active-planisphere") "活动星盘" else "可见天区"
            val size = if (isLarge) "大组件" else "小组件"
            toast("已选择$title · $size；请在桌面弹出的系统确认中点“添加”。")
        } else {
            toast("桌面没有接受添加请求。请长按空白处打开“小组件”，切换到后续空白页后选择对应的 CosmosWhisper 版本。")
        }
    }

    private fun addRocketWidgetToHomeScreen() {
        val manager = AppWidgetManager.getInstance(this)
        val provider = ComponentName(this, RocketWidgetProvider.providerForSize(currentRocketSize))
        if (!manager.isRequestPinAppWidgetSupported) {
            toast("当前桌面不支持应用内直接添加。请长按桌面空白处，在 RocketWhisper 组件列表中选择中国区域和对应尺寸。")
            return
        }
        val callbackIntent = Intent(this, RocketPinWidgetReceiver::class.java)
            .putExtra(RocketPinWidgetReceiver.EXTRA_SIZE, currentRocketSize)
        val mutabilityFlag = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0
        val callback = PendingIntent.getBroadcast(
            this,
            System.nanoTime().toInt(),
            callbackIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or mutabilityFlag
        )
        val accepted = try {
            manager.requestPinAppWidget(provider, null, callback)
        } catch (_: Exception) {
            false
        }
        if (accepted) {
            val sizeName = when (currentRocketSize) {
                "2x2" -> "2×2"
                "4x2" -> "4×2"
                else -> "4×4"
            }
            toast("已选择 RocketWhisper · 中国区域 · $sizeName；请在桌面弹出的系统确认中点“添加”。")
        } else {
            toast("桌面没有接受添加请求。请长按空白处，在 RocketWhisper 组件列表中选择中国区域版本。")
        }
    }

    private fun openBatterySettings() {
        try {
            startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$packageName")))
        } catch (_: Exception) {
            toast("请在系统设置 > 应用 > WidgetWhisper > 电池中选择“不受限制”。")
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

    private fun spinner(items: List<String>) = Spinner(this).apply {
        adapter = android.widget.ArrayAdapter(
            this@MainActivity,
            android.R.layout.simple_spinner_item,
            items
        ).also { it.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item) }
    }

    private fun spinnerListener(onSelected: () -> Unit) = object : android.widget.AdapterView.OnItemSelectedListener {
        override fun onItemSelected(parent: android.widget.AdapterView<*>?, view: View?, position: Int, id: Long) = onSelected()
        override fun onNothingSelected(parent: android.widget.AdapterView<*>?) = Unit
    }

    private fun sizeCode(position: Int) = when (position) {
        1 -> "2x2"
        2 -> "4x2"
        else -> "4x4"
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

    private fun android.view.View.withTop(top: Int): android.view.View {
        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
            topMargin = top
        }
        return this
    }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
    private fun toast(message: String) = Toast.makeText(this, message, Toast.LENGTH_LONG).show()

    companion object {
        const val PREFS_NAME = "widget-settings"
        const val KEY_DEFAULT_KIND = "defaultKind"
        const val KEY_DEFAULT_KIND_USER_SELECTED = "defaultKindUserSelected"
        const val KEY_DEFAULT_CLOCK_HANDS = "defaultClockHands"
        const val KEY_LOCATION_LATITUDE = "phoneLatitude"
        const val KEY_LOCATION_LONGITUDE = "phoneLongitude"
        const val KEY_LOCATION_NAME = "phoneLocationName"
        const val KEY_ROCKET_SIZE = "rocketSize"
        const val EXTRA_OPEN_ROCKET = "com.lzq1206.widgetwhisper.openRocket"
        private const val LOCATION_PERMISSION_REQUEST = 6305
    }
}
