# CosmosWhisper Android app and widget

The Android app bundles the star-chart JavaScript, astronomy calculations, and chart data in the APK. Both **可见天区** and **活动星盘** render on the device from those bundled files. The app has no Internet permission and does not download chart images or data from either website.

The app requests the phone's current location and uses its latitude and longitude directly. It saves the last location locally; opening the app or pressing **手机定位** updates it. Select **可见天区** or **活动星盘** in the app, then press **添加到桌面** to choose a large or small provider. A clock-hand overlay is enabled by default and can be turned off for each widget. Android 12 and newer use the system's native analog clock view for a live hour, minute, and moving second hand. A system scheduled refresh is requested every 15 minutes for the star chart; Android battery policies may delay it. Tap a widget to open the app, or use **刷新小组件** for an immediate redraw. For fewer delays, set the app's battery usage to **不受限制** in Android app settings.

If the launcher does not support in-app pinning, add either size from the launcher's home-screen widget picker. The setup screen lets you choose a chart type and clock-hand visibility.

The Android build has **not been tested on a physical Android device**. It requires JDK 17, Android SDK platform 35, and Gradle 8.9 or compatible:

    gradle assembleDebug
