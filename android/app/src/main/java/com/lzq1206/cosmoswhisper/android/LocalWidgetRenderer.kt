package com.lzq1206.cosmoswhisper.android

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.view.ContextThemeWrapper
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import org.json.JSONTokener
import java.util.Base64
import kotlin.math.roundToInt

object LocalWidgetRenderer {
    private const val MAX_RENDER_WAIT_MS = 15000L
    private const val CHECK_READY_JS =
        "window.CosmosWhisperRenderReady === true && !!document.querySelector('canvas') && document.querySelector('canvas').width > 0"
    private const val CAPTURE_JS =
        "(function(){var c=document.querySelector('canvas');if(!c)return '';var w=c.toDataURL('image/webp',0.98);return w.indexOf('data:image/webp;')===0?w:c.toDataURL('image/png')})()"

    private val mainHandler = Handler(Looper.getMainLooper())

    fun renderAll(context: Context, onComplete: (() -> Unit)? = null) {
        mainHandler.post {
            val manager = android.appwidget.AppWidgetManager.getInstance(context)
            val prefs = context.getSharedPreferences(MainActivity.PREFS_NAME, Context.MODE_PRIVATE)
            val idsByVariant = LinkedHashMap<Int, PlanisphereWidgetVariant>()
            PlanisphereWidgetProvider.VARIANTS.forEach { variant ->
                manager.getAppWidgetIds(android.content.ComponentName(context, variant.providerClass)).forEach { id ->
                    val kindKey = "widget-$id-kind"
                    val handsKey = "widget-$id-clockHands"
                    val editor = prefs.edit()
                    if (!prefs.contains(kindKey)) editor.putString(kindKey, variant.kind)
                    if (!prefs.contains(handsKey)) editor.putBoolean(handsKey, variant.clockHands)
                    editor.apply()
                    idsByVariant[id] = variant
                }
            }
            val ids = idsByVariant.keys.toIntArray()
            if (ids.isEmpty()) {
                onComplete?.invoke()
                return@post
            }

            val latitude = prefs.getString(MainActivity.KEY_LOCATION_LATITUDE, null)?.toDoubleOrNull()
            val longitude = prefs.getString(MainActivity.KEY_LOCATION_LONGITUDE, null)?.toDoubleOrNull()
            if (latitude == null || longitude == null || latitude !in -90.0..90.0 || longitude !in -180.0..180.0) {
                ids.forEach { PlanisphereWidgetProvider.showWidgetStatus(context, it, "打开应用并允许手机定位后即可显示星图") }
                onComplete?.invoke()
                return@post
            }

            val name = prefs.getString(MainActivity.KEY_LOCATION_NAME, "当前位置") ?: "当前位置"
            val timestamp = System.currentTimeMillis()
            val rendered = HashMap<String, Bitmap?>()
            var index = 0

            fun nextWidget() {
                if (index >= ids.size) {
                    onComplete?.invoke()
                    return
                }
                val id = ids[index++]
                val kind = prefs.getString("widget-$id-kind", idsByVariant[id]?.kind ?: "visible-sky") ?: "visible-sky"
                val variant = idsByVariant[id]
                val pixels = targetSidePixels(context, manager, id, variant?.isLarge ?: true)
                val renderScale = (pixels / 360f).coerceIn(1f, 4f)
                val cacheKey = kind + ":" + latitude + ":" + longitude + ":" + timestamp / 60000L + ":" + pixels
                if (rendered.containsKey(cacheKey)) {
                    val bitmap = rendered[cacheKey]
                    if (bitmap != null) PlanisphereWidgetProvider.updateWidgetImage(context, id, bitmap, kind)
                    else PlanisphereWidgetProvider.showWidgetStatus(context, id, "本地绘制失败 · 打开应用重试")
                    nextWidget()
                    return
                }
                renderOne(context, kind, latitude, longitude, name, timestamp, pixels, renderScale) { bitmap ->
                    rendered[cacheKey] = bitmap
                    if (bitmap != null) PlanisphereWidgetProvider.updateWidgetImage(context, id, bitmap, kind)
                    else PlanisphereWidgetProvider.showWidgetStatus(context, id, "本地绘制失败 · 打开应用重试")
                    nextWidget()
                }
            }

            nextWidget()
        }
    }

    private fun renderOne(
        context: Context,
        kind: String,
        latitude: Double,
        longitude: Double,
        locationName: String,
        timestamp: Long,
        pixels: Int,
        renderScale: Float,
        onComplete: (Bitmap?) -> Unit
    ) {
        val webView = try {
            WebView(ContextThemeWrapper(context, android.R.style.Theme_Material_NoActionBar))
        } catch (_: Exception) {
            onComplete(null)
            return
        }
        webView.visibility = View.INVISIBLE
        webView.setBackgroundColor(android.graphics.Color.rgb(3, 8, 23))
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.allowFileAccess = false
        webView.settings.allowContentAccess = false
        webView.layoutParams = ViewGroup.LayoutParams(pixels, pixels)
        val exact = View.MeasureSpec.makeMeasureSpec(pixels, View.MeasureSpec.EXACTLY)
        webView.measure(exact, exact)
        webView.layout(0, 0, pixels, pixels)

        var completed = false
        fun finish(bitmap: Bitmap?) {
            if (completed) return
            completed = true
            try {
                webView.stopLoading()
                webView.webChromeClient = null
                webView.destroy()
            } catch (_: Exception) {
                // The WebView is already detached or destroyed.
            }
            onComplete(bitmap)
        }

        fun captureWhenReady(deadline: Long) {
            if (completed) return
            webView.evaluateJavascript(CHECK_READY_JS) { ready ->
                if (ready == "true") {
                    webView.evaluateJavascript(CAPTURE_JS) { encoded ->
                        val dataUrl = try {
                            JSONTokener(encoded ?: "\"\"").nextValue() as? String
                        } catch (_: Exception) {
                            null
                        }
                        val data = dataUrl?.substringAfter("base64,", "") ?: ""
                        val bitmap = try {
                            if (data.isEmpty()) null else {
                                val bytes = Base64.getDecoder().decode(data)
                                BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                            }
                        } catch (_: Exception) {
                            null
                        }
                        finish(bitmap)
                    }
                } else if (android.os.SystemClock.uptimeMillis() >= deadline) {
                    finish(null)
                } else {
                    mainHandler.postDelayed({ captureWhenReady(deadline) }, 250L)
                }
            }
        }

        webView.webViewClient = OfflineWebViewSupport.createClient(context) { _, _ ->
                val deadline = android.os.SystemClock.uptimeMillis() + MAX_RENDER_WAIT_MS
                mainHandler.postDelayed({ captureWhenReady(deadline) }, 150L)
        }

        val path = if (kind == "active-planisphere") "/offline/active.html" else "/offline/visible.html"
        val url = OfflineWebViewSupport.BASE_URL + path +
            "?lat=" + latitude +
            "&lon=" + longitude +
            "&name=" + Uri.encode(locationName) +
            "&at=" + timestamp +
            "&renderScale=" + renderScale
        webView.loadUrl(url)
        mainHandler.postDelayed({
            if (!completed) finish(null)
        }, MAX_RENDER_WAIT_MS + 5000L)
    }

    private fun targetSidePixels(
        context: Context,
        manager: android.appwidget.AppWidgetManager,
        id: Int,
        isLarge: Boolean
    ): Int {
        val options = manager.getAppWidgetOptions(id)
        val minWidth = options.getInt(android.appwidget.AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH)
        val minHeight = options.getInt(android.appwidget.AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT)
        val optionSideDp = if (minWidth > 0 && minHeight > 0) {
            minOf(minWidth, minHeight)
        } else if (isLarge) {
            360
        } else {
            180
        }
        val sizedSideDp = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
            options.getParcelableArrayList<android.util.SizeF>(android.appwidget.AppWidgetManager.OPTION_APPWIDGET_SIZES)
                ?.map { minOf(it.width, it.height).roundToInt() }
                ?.filter { it > 0 }
                ?.maxOrNull()
        } else {
            null
        }
        val sideDp = sizedSideDp ?: optionSideDp
        return (sideDp * context.resources.displayMetrics.density)
            .roundToInt()
            .coerceIn(360, 1440)
    }
}
