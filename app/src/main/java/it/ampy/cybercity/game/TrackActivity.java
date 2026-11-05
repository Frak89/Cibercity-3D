package it.ampy.cybercity.game;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.SharedPreferences;
import android.content.pm.ActivityInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import it.ampy.cybercity.Prefs;

/** KAGE CIRCUIT (11 km race track): the same WebGL race as docs/track.html, packaged in the APK (assets/web) and
 *  run in a full-screen WebView with the car configuration from the showroom. */
public class TrackActivity extends Activity {
    private WebView web;

    @SuppressLint("SetJavaScriptEnabled")
    @Override protected void onCreate(Bundle b) {
        it.ampy.cybercity.L.init(this);
        super.onCreate(b);
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        web = new WebView(this);
        WebSettings ws = web.getSettings();
        ws.setJavaScriptEnabled(true); ws.setDomStorageEnabled(true); ws.setMediaPlaybackRequiresUserGesture(false);
        ws.setAllowFileAccess(true);
        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient());
        web.setBackgroundColor(0xff000000);
        setContentView(web);
        SharedPreferences sp = Prefs.get(this).raw();
        String rim = String.valueOf((char) ('A' + Math.max(0, Math.min(2, sp.getInt("cRim", 0)))));
        int tx = sp.getInt("cText", -1);
        String car = "{\"kit\":" + sp.getInt("cKit", 0) + ",\"rim\":\"" + rim + "\",\"livery\":" + sp.getInt("cLiv", 0)
            + ",\"text\":\"" + (tx < 0 ? "none" : String.valueOf(tx)) + "\",\"stripe\":\"" + CarHd.COLOR_KEYS[Math.max(0, Math.min(6, sp.getInt("cStripe", 0)))]
            + "\",\"rimcol\":\"" + CarHd.COLOR_KEYS[Math.max(0, Math.min(6, sp.getInt("cRimC", 3)))] + "\",\"brakes\":" + sp.getInt("cBrakes", 0) + "}";
        String url = "file:///android_asset/web/track.html?car=" + Uri.encode(car) + "&paint=" + Uri.encode(sp.getString("gPaint", "rosso"))
            + "&power=" + Uri.encode(sp.getString("gPower", "v8")) + "&exhaust=" + (sp.getBoolean("gRace", false) ? "race" : "serie") + "&roof=" + (sp.getBoolean("gRoof", false) ? "1" : "0") + "&lang=" + (it.ampy.cybercity.L.english() ? "en" : "it");
        web.loadUrl(url);
    }
    @Override protected void onResume() {
        super.onResume(); web.onResume();
        View d = getWindow().getDecorView();
        if (Build.VERSION.SDK_INT >= 30 && getWindow().getInsetsController() != null) {
            getWindow().setDecorFitsSystemWindows(false);
            getWindow().getInsetsController().hide(WindowInsets.Type.systemBars());
            getWindow().getInsetsController().setSystemBarsBehavior(android.view.WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        } else d.setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }
    @Override protected void onPause() { web.onPause(); super.onPause(); }
    @Override protected void onDestroy() { web.destroy(); super.onDestroy(); }
}
