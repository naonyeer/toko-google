# My Kedai Android App

Android Studio project for wrapping `https://my-kedai.vercel.app/` in a fast in-app WebView.

Features:
- Splash screen with My Kedai branding
- Full-screen WebView
- JavaScript and DOM storage enabled
- Links stay inside the app
- Pull to refresh
- Loading progress bar
- Offline state with retry action
- Back button navigation inside WebView
- Basic caching enabled
- Custom shop icon

How to build:
1. Open `android-app` in Android Studio.
2. Let Android Studio sync Gradle dependencies.
3. Build with `Build > Build Bundle(s) / APK(s) > Build APK(s)`.

Main entry points:
- `android-app/app/src/main/java/com/mykedai/app/MainActivity.kt`
- `android-app/app/src/main/AndroidManifest.xml`
- `android-app/app/src/main/res/layout/activity_main.xml`
