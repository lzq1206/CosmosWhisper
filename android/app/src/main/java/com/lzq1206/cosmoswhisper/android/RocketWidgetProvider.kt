package com.lzq1206.cosmoswhisper.android

import android.app.PendingIntent
import android.app.job.JobParameters
import android.app.job.JobService
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Handler
import android.os.Looper
import android.view.View
import android.widget.RemoteViews
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

open class RocketWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, appWidgetIds: IntArray) {
        scheduleRefresh(context)
        refreshWidgets(context)
    }

    override fun onEnabled(context: Context) = scheduleRefresh(context)

    override fun onDisabled(context: Context) {
        val manager = AppWidgetManager.getInstance(context)
        if (VARIANTS.any { manager.getAppWidgetIds(ComponentName(context, it.providerClass)).isNotEmpty() }) return
        try {
            context.getSystemService(android.app.job.JobScheduler::class.java)
                .cancel(RocketWidgetRefreshJobService.JOB_ID)
        } catch (_: Exception) { }
    }

    companion object {
        val VARIANTS = listOf(
            RocketWidgetVariant(RocketChinaSquareLargeWidgetProvider::class.java, "4x4"),
            RocketWidgetVariant(RocketChinaSquareSmallWidgetProvider::class.java, "2x2"),
            RocketWidgetVariant(RocketChinaWideWidgetProvider::class.java, "4x2")
        )

        fun providerForSize(size: String): Class<out RocketWidgetProvider> =
            VARIANTS.firstOrNull { it.size == size }?.providerClass ?: RocketChinaSquareLargeWidgetProvider::class.java

        fun scheduleRefresh(context: Context) {
            val job = android.app.job.JobInfo.Builder(
                RocketWidgetRefreshJobService.JOB_ID,
                ComponentName(context, RocketWidgetRefreshJobService::class.java)
            ).setPersisted(true)
                .setRequiredNetworkType(android.app.job.JobInfo.NETWORK_TYPE_ANY)
                .setPeriodic(2 * 60 * 60 * 1000L, 30 * 60 * 1000L)
                .build()
            try {
                context.getSystemService(android.app.job.JobScheduler::class.java).schedule(job)
            } catch (_: Exception) { }
        }

        fun refreshWidgets(context: Context, onComplete: (() -> Unit)? = null) {
            RocketWidgetRenderer.renderAll(context.applicationContext, onComplete)
        }

        fun showImage(context: Context, id: Int, bitmap: Bitmap, size: String) {
            val views = baseViews(context, id)
            views.setImageViewBitmap(R.id.rocket_widget_image, bitmap)
            views.setViewVisibility(R.id.rocket_widget_status, View.GONE)
            views.setContentDescription(R.id.rocket_widget_image, "RocketWhisper · 中国区域 · ${sizeLabel(size)} · 服务端生成地图")
            AppWidgetManager.getInstance(context).updateAppWidget(id, views)
        }

        fun showStatus(context: Context, id: Int, message: String) {
            val views = baseViews(context, id)
            views.setTextViewText(R.id.rocket_widget_status, message)
            views.setViewVisibility(R.id.rocket_widget_status, View.VISIBLE)
            AppWidgetManager.getInstance(context).updateAppWidget(id, views)
        }

        private fun baseViews(context: Context, id: Int): RemoteViews {
            val views = RemoteViews(context.packageName, R.layout.widget_rocket)
            val launchIntent = Intent(context, MainActivity::class.java)
                .putExtra(MainActivity.EXTRA_OPEN_ROCKET, true)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            val pending = PendingIntent.getActivity(
                context,
                100000 + id,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.rocket_widget_image, pending)
            views.setOnClickPendingIntent(R.id.rocket_widget_status, pending)
            return views
        }

        private fun sizeLabel(size: String) = when (size) {
            "2x2" -> "2×2"
            "4x2" -> "4×2"
            else -> "4×4"
        }
    }
}

class RocketChinaSquareLargeWidgetProvider : RocketWidgetProvider()
class RocketChinaSquareSmallWidgetProvider : RocketWidgetProvider()
class RocketChinaWideWidgetProvider : RocketWidgetProvider()

data class RocketWidgetVariant(
    val providerClass: Class<out RocketWidgetProvider>,
    val size: String
)

class RocketPinWidgetReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val id = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
        if (id == AppWidgetManager.INVALID_APPWIDGET_ID) return
        RocketWidgetProvider.scheduleRefresh(context)
        RocketWidgetProvider.refreshWidgets(context)
    }

    companion object {
        const val EXTRA_SIZE = "com.lzq1206.widgetwhisper.rocketSize"
    }
}

class RocketWidgetRefreshJobService : JobService() {
    override fun onStartJob(params: JobParameters): Boolean {
        RocketWidgetProvider.refreshWidgets(this) { jobFinished(params, false) }
        return true
    }

    override fun onStopJob(params: JobParameters): Boolean = true

    companion object { const val JOB_ID = 90521 }
}

object RocketWidgetRenderer {
    private const val IMAGE_BASE = "https://lzq1206.github.io/notam-whisper/widget/"
    private val worker = Executors.newSingleThreadExecutor()
    private val mainHandler = Handler(Looper.getMainLooper())

    fun renderAll(context: Context, onComplete: (() -> Unit)? = null) {
        worker.execute {
            try {
                val manager = AppWidgetManager.getInstance(context)
                RocketWidgetProvider.VARIANTS.forEach { variant ->
                    val ids = manager.getAppWidgetIds(ComponentName(context, variant.providerClass))
                    if (ids.isEmpty()) return@forEach

                    val (bitmap, _) = downloadOrLoadCache(context, variant.size)
                    ids.forEach { id ->
                        if (bitmap != null) RocketWidgetProvider.showImage(context, id, bitmap, variant.size)
                        else RocketWidgetProvider.showStatus(context, id, "中国区域地图暂不可用 · 检查网络后点开应用重试")
                    }
                }
            } finally {
                onComplete?.let { mainHandler.post(it) }
            }
        }
    }

    fun loadPreview(context: Context, size: String, callback: (Bitmap?, Boolean) -> Unit) {
        worker.execute {
            val (bitmap, downloaded) = downloadOrLoadCache(context.applicationContext, size)
            mainHandler.post { callback(bitmap, downloaded) }
        }
    }

    private fun downloadOrLoadCache(context: Context, size: String): Pair<Bitmap?, Boolean> {
        val name = when (size) {
            "2x2" -> "china-widget-small.jpg"
            "4x2" -> "china-widget-medium.jpg"
            else -> "china-widget-large.jpg"
        }
        val cache = File(File(context.filesDir, "rocket-widgets"), name)
        val downloadedBitmap = try {
            val imageUrl = URL(IMAGE_BASE + name + "?v=" + System.currentTimeMillis())
            val connection = imageUrl.openConnection() as HttpURLConnection
            connection.connectTimeout = 15_000
            connection.readTimeout = 30_000
            connection.useCaches = false
            connection.instanceFollowRedirects = true
            connection.setRequestProperty("Cache-Control", "no-cache, no-store, max-age=0")
            connection.setRequestProperty("Pragma", "no-cache")
            connection.setRequestProperty("Accept", "image/jpeg")
            try {
                if (connection.responseCode != HttpURLConnection.HTTP_OK) null
                else {
                    val bytes = connection.inputStream.use { it.readBytes() }
                    BitmapFactory.decodeByteArray(bytes, 0, bytes.size)?.also {
                        try {
                            cache.parentFile?.mkdirs()
                            cache.writeBytes(bytes)
                        } catch (_: Exception) { }
                    }
                }
            } finally {
                connection.disconnect()
            }
        } catch (_: Exception) {
            null
        }
        if (downloadedBitmap != null) return downloadedBitmap to true
        val cachedBitmap = try { BitmapFactory.decodeFile(cache.absolutePath) } catch (_: Exception) { null }
        return cachedBitmap to false
    }
}
