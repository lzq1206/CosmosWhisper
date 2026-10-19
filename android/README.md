# WidgetWhisper Android app and widgets

WidgetWhisper contains two independent features: **CosmosWhisper** star-chart widgets and **RocketWhisper** launch-map widgets. The APK bundles the star-chart JavaScript, astronomy calculations, and chart data. Both **可见天区** and **活动星盘** render on the device from those bundled files. RocketWhisper is China-only and downloads the server-generated widget images from `https://lzq1206.github.io/notam-whisper/widget/`; the website refreshes these images every two hours.

The app requests the phone's current location and uses its latitude and longitude directly. It saves the last location locally; opening the app or pressing **手机定位** updates it. In the CosmosWhisper feature, select **可见天区** or **活动星盘**, then press **添加到桌面** to choose a 4×4 or 2×2 provider and whether it shows hands. The Android widget picker lists all eight combinations of size, chart type, and hands, each with its own preview image. Outside the circular chart, widget images preserve transparency; loading and error messages use a rounded rectangle. Android 12 and newer use the system's native analog clock view for a live hour, minute, and moving second hand. A system scheduled refresh is requested every 15 minutes for the star chart; Android battery policies may delay it. RocketWhisper provides China region widgets in 4×4, 2×2, and 4×2 sizes. They request the matching GitHub Pages image every two hours and retain the last downloaded image for offline fallback. Android may delay scheduled refreshes. For fewer delays, set the app's battery usage to **不受限制** in Android app settings.

If the current home-screen page has no room, page placement is controlled by the launcher: switch to an empty later page during placement or drag the widget to another page. If the launcher does not support in-app pinning, add one of the eight variants from the home-screen widget picker.

The Android build has **not been tested on a physical Android device**. It requires JDK 17, Android SDK platform 35, and Gradle 8.9 or compatible:

    gradle assembleDebug
