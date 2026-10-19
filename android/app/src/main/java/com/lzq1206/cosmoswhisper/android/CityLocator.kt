package com.lzq1206.cosmoswhisper.android

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.CancellationSignal
import android.os.Handler
import android.os.Looper
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import java.util.function.Consumer

object CityLocator {
    fun hasPermission(activity: Activity): Boolean {
        val fine = activity.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val coarse = activity.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
        return fine || coarse
    }

    fun askPermission(activity: Activity, requestCode: Int) {
        activity.requestPermissions(
            arrayOf(Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION),
            requestCode
        )
    }

    @SuppressLint("MissingPermission")
    fun requestLocation(context: Context, onResult: (Location?) -> Unit) {
        val manager = context.getSystemService(LocationManager::class.java)
        val providers = try {
            manager.getProviders(true).sortedBy { if (it == LocationManager.NETWORK_PROVIDER) 0 else 1 }
        } catch (_: Exception) {
            emptyList()
        }
        if (providers.isEmpty()) {
            onResult(latestKnownLocation(manager, emptyList()))
            return
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            requestModernLocation(context, manager, providers, onResult)
        } else {
            requestLegacyLocation(manager, providers, onResult)
        }
    }

    @SuppressLint("MissingPermission")
    private fun requestModernLocation(
        context: Context,
        manager: LocationManager,
        providers: List<String>,
        onResult: (Location?) -> Unit
    ) {
        val handler = Handler(Looper.getMainLooper())
        val signal = CancellationSignal()
        val finished = AtomicBoolean(false)
        val pending = AtomicInteger(providers.size)
        fun finish(location: Location?) {
            if (finished.compareAndSet(false, true)) {
                handler.removeCallbacksAndMessages(null)
                signal.cancel()
                onResult(location ?: latestKnownLocation(manager, providers))
            }
        }
        val timeout = Runnable { finish(null) }
        handler.postDelayed(timeout, LOCATION_TIMEOUT_MS)

        providers.forEach { provider ->
            try {
                manager.getCurrentLocation(provider, signal, context.mainExecutor, Consumer { location ->
                    if (location != null) finish(location)
                    else if (pending.decrementAndGet() == 0) finish(null)
                })
            } catch (_: Exception) {
                if (pending.decrementAndGet() == 0) finish(null)
            }
        }
    }

    @SuppressLint("MissingPermission")
    private fun requestLegacyLocation(
        manager: LocationManager,
        providers: List<String>,
        onResult: (Location?) -> Unit
    ) {
        val handler = Handler(Looper.getMainLooper())
        val finished = AtomicBoolean(false)
        lateinit var listener: LocationListener
        fun finish(location: Location?) {
            if (finished.compareAndSet(false, true)) {
                handler.removeCallbacksAndMessages(null)
                try {
                    manager.removeUpdates(listener)
                } catch (_: Exception) {
                    // Location permission may have changed while the request was pending.
                }
                onResult(location ?: latestKnownLocation(manager, providers))
            }
        }
        listener = object : LocationListener {
            override fun onLocationChanged(location: Location) = finish(location)
            @Deprecated("Deprecated by Android")
            override fun onStatusChanged(provider: String?, status: Int, extras: android.os.Bundle?) = Unit
            override fun onProviderEnabled(provider: String) = Unit
            override fun onProviderDisabled(provider: String) = Unit
        }
        handler.postDelayed({ finish(null) }, LOCATION_TIMEOUT_MS)
        var requested = false
        providers.forEach { provider ->
            try {
                manager.requestLocationUpdates(provider, 0L, 0f, listener, Looper.getMainLooper())
                requested = true
            } catch (_: Exception) {
                // Try another enabled provider if this one rejects the request.
            }
        }
        if (!requested) finish(null)
    }

    @SuppressLint("MissingPermission")
    private fun latestKnownLocation(manager: LocationManager, providers: List<String>): Location? =
        providers.mapNotNull { provider ->
            try {
                manager.getLastKnownLocation(provider)
            } catch (_: Exception) {
                null
            }
        }.maxByOrNull { it.time }

    private const val LOCATION_TIMEOUT_MS = 18000L
}
