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

object LocalWidgetRenderer {
    private const val MAX_RENDER_WAIT_MS = 15000L
    private const val CHECK_READY_JS =
        "window.CosmosWhisperRenderReady === true && !!document.querySelector('canvas') && document.querySelector('canvas').width > 0"
    private const val CAPTURE_JS =
        "(function(){var c=document.querySelector('canvas');return c?c.toDataURL('image/jpeg',0.94):''})()"

    private val mainHandler = Handler(Looper.getMainLooper())

    fun renderAll(context: Context, onComplete: (() -> Unit)? = null) {
        mainHandler.post {
            val manager = android.appwidget.AppWidgetManager.getInstance(context)
            val ids = listOf(
                PlanisphereWidgetProvider::class.java,
                SmallPlanisphereWidgetProvider::class.java
            ).flatMap { provider ->
                manager.getAppWidgetIds(android.content.ComponentName(context, provider)).toList()
            }.distinct().toIntArray()
            if (ids.isEmpty()) {
                onComplete?.invoke()
                return@post
            }

            val prefs = context.getSharedPreferences(MainActivity.PREFS_NAME, Context.MODE_PRIVATE)
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
                val kind = prefs.getString("widget-" + id + "-kind", prefs.getString(MainActivity.KEY_DEFAULT_KIND, "visible-sky"))
                    ?: "visible-sky"
                val cacheKey = kind + ":" + latitude + ":" + longitude + ":" + timestamp / 60000L
                if (rendered.containsKey(cacheKey)) {
                    val bitmap = rendered[cacheKey]
                    if (bitmap != null) PlanisphereWidgetProvider.updateWidgetImage(context, id, bitmap, kind)
                    else PlanisphereWidgetProvider.showWidgetStatus(context, id, "本地绘制失败 · 打开应用重试")
                    nextWidget()
                    return
                }
                renderOne(context, kind, latitude, longitude, name, timestamp) { bitmap ->
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
        onComplete: (Bitmap?) -> Unit
    ) {
        val density = context.resources.displayMetrics.density
        val pixels = (360f * density).toInt().coerceIn(360, 1080)
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
            "&at=" + timestamp
        webView.loadUrl(url)
        mainHandler.postDelayed({
            if (!completed) finish(null)
        }, MAX_RENDER_WAIT_MS + 5000L)
    }
}
