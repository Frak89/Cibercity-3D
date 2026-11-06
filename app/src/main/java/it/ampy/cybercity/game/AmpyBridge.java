package it.ampy.cybercity.game;

import android.app.Activity;
import android.app.ActivityManager;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraManager;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Environment;
import android.os.PowerManager;
import android.os.StatFs;
import android.os.SystemClock;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.Base64;
import android.util.DisplayMetrics;
import android.webkit.JavascriptInterface;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.List;
import java.util.Locale;

import it.ampy.cybercity.NotifListener;

/** The phone side of the in-game AmpybiOS tablet (web/ampyos.js): real device status, the AmpyXXX apps installed on the
 *  phone (listed through package-visibility queries, launched on tap), the real notifications (if the user gave
 *  Cybercity notification access), saving photos to Pictures/Cybercity, the real torch and vibration.
 *  Exposed to the local game page as window.AmpyBridge. No network, no data leaves the phone. */
public class AmpyBridge {
    private final Activity act;
    private String appsCache, appsCacheAll;

    public AmpyBridge(Activity a) { act = a; }

    @JavascriptInterface public String version() { return "1"; }

    /** launcher apps whose name or package contains "ampy" (or every launcher app with all = true), with a PNG icon */
    @JavascriptInterface public String apps(boolean all) {
        if (all && appsCacheAll != null) return appsCacheAll;
        if (!all && appsCache != null) return appsCache;
        JSONArray out = new JSONArray();
        try {
            PackageManager pm = act.getPackageManager();
            Intent i = new Intent(Intent.ACTION_MAIN); i.addCategory(Intent.CATEGORY_LAUNCHER);
            List<ResolveInfo> l = pm.queryIntentActivities(i, 0);
            for (ResolveInfo r : l) {
                String pkg = r.activityInfo.packageName, label = String.valueOf(r.loadLabel(pm));
                if (pkg.equals(act.getPackageName())) continue;
                boolean ampy = pkg.toLowerCase(Locale.ROOT).contains("ampy") || label.toLowerCase(Locale.ROOT).contains("ampy");
                if (!all && !ampy) continue;
                JSONObject o = new JSONObject();
                o.put("pkg", pkg); o.put("label", label); o.put("ampy", ampy);
                o.put("icon", iconPng(r.loadIcon(pm)));
                out.put(o);
            }
        } catch (Exception ignored) { }
        String s = out.toString();
        if (all) appsCacheAll = s; else appsCache = s;
        return s;
    }
    private static String iconPng(Drawable d) {
        try {
            int n = 96; Bitmap b = Bitmap.createBitmap(n, n, Bitmap.Config.ARGB_8888); Canvas c = new Canvas(b);
            d.setBounds(0, 0, n, n); d.draw(c);
            ByteArrayOutputStream bo = new ByteArrayOutputStream(); b.compress(Bitmap.CompressFormat.PNG, 100, bo);
            return "data:image/png;base64," + Base64.encodeToString(bo.toByteArray(), Base64.NO_WRAP);
        } catch (Exception e) { return ""; }
    }
    @JavascriptInterface public boolean launch(final String pkg) {
        try {
            final Intent i = act.getPackageManager().getLaunchIntentForPackage(pkg); if (i == null) return false;
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            act.runOnUiThread(() -> { try { act.startActivity(i); } catch (Exception ignored) { } });
            return true;
        } catch (Exception e) { return false; }
    }

    /** the real phone: model, Android, battery, storage, memory, network, screen, thermal state, uptime */
    @JavascriptInterface public String device() {
        JSONObject o = new JSONObject();
        try {
            o.put("maker", Build.MANUFACTURER); o.put("model", Build.MODEL); o.put("device", Build.DEVICE); o.put("android", Build.VERSION.RELEASE); o.put("sdk", Build.VERSION.SDK_INT);
            o.put("security", Build.VERSION.SDK_INT >= 23 ? Build.VERSION.SECURITY_PATCH : "");
            Intent bat = act.registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
            if (bat != null) {
                int lv = bat.getIntExtra(BatteryManager.EXTRA_LEVEL, -1), sc = bat.getIntExtra(BatteryManager.EXTRA_SCALE, 100), stt = bat.getIntExtra(BatteryManager.EXTRA_STATUS, -1);
                o.put("battery", lv >= 0 ? Math.round(lv * 100f / sc) : -1);
                o.put("charging", stt == BatteryManager.BATTERY_STATUS_CHARGING || stt == BatteryManager.BATTERY_STATUS_FULL);
                o.put("batTemp", bat.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, 0) / 10.0); o.put("batVolt", bat.getIntExtra(BatteryManager.EXTRA_VOLTAGE, 0) / 1000.0);
            }
            StatFs fs = new StatFs(Environment.getDataDirectory().getPath());
            o.put("storageFree", fs.getAvailableBytes()); o.put("storageTotal", fs.getTotalBytes());
            ActivityManager am = (ActivityManager) act.getSystemService(Context.ACTIVITY_SERVICE); ActivityManager.MemoryInfo mi = new ActivityManager.MemoryInfo(); am.getMemoryInfo(mi);
            o.put("ramFree", mi.availMem); o.put("ramTotal", mi.totalMem);
            ConnectivityManager cm = (ConnectivityManager) act.getSystemService(Context.CONNECTIVITY_SERVICE);
            String net = "offline";
            if (cm != null && Build.VERSION.SDK_INT >= 23) { NetworkCapabilities nc = cm.getNetworkCapabilities(cm.getActiveNetwork());
                if (nc != null) net = nc.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ? "Wi-Fi" : nc.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) ? "rete mobile" : nc.hasTransport(NetworkCapabilities.TRANSPORT_VPN) ? "VPN" : "online"; }
            o.put("net", net);
            DisplayMetrics dm = act.getResources().getDisplayMetrics(); o.put("screen", dm.widthPixels + "×" + dm.heightPixels + " · " + dm.densityDpi + " dpi");
            if (Build.VERSION.SDK_INT >= 29) { PowerManager pw = (PowerManager) act.getSystemService(Context.POWER_SERVICE); o.put("thermal", pw.getCurrentThermalStatus()); o.put("powerSave", pw.isPowerSaveMode()); }
            o.put("uptime", SystemClock.elapsedRealtime() / 1000);
            o.put("notifAccess", NotifListener.granted(act));
        } catch (Exception ignored) { }
        return o.toString();
    }

    /** the real notifications on the phone (needs notification access for Cybercity 3D) */
    @JavascriptInterface public String notifications() { return NotifListener.snapshot(act); }
    @JavascriptInterface public void openNotificationAccess() {
        act.runOnUiThread(() -> { try { act.startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); } catch (Exception ignored) { } });
    }

    /** a photo (data: URL, jpeg or png) into Pictures/Cybercity — returns the file name or "" */
    @JavascriptInterface public String saveImage(String dataUrl, String name) {
        try {
            int k = dataUrl.indexOf(','); byte[] bytes = Base64.decode(dataUrl.substring(k + 1), Base64.DEFAULT);
            boolean png = dataUrl.startsWith("data:image/png");
            String fn = (name == null || name.isEmpty() ? "cybercity_" + System.currentTimeMillis() : name.replaceAll("[^A-Za-z0-9_-]", "_")) + (png ? ".png" : ".jpg");
            if (Build.VERSION.SDK_INT >= 29) {
                ContentValues cv = new ContentValues();
                cv.put(MediaStore.Images.Media.DISPLAY_NAME, fn); cv.put(MediaStore.Images.Media.MIME_TYPE, png ? "image/png" : "image/jpeg");
                cv.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/Cybercity");
                Uri u = act.getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, cv); if (u == null) return "";
                try (OutputStream os = act.getContentResolver().openOutputStream(u)) { if (os == null) return ""; os.write(bytes); }
                return "Pictures/Cybercity/" + fn;
            }
            File dir = act.getExternalFilesDir(Environment.DIRECTORY_PICTURES); if (dir == null) return "";
            File f = new File(dir, fn); try (FileOutputStream os = new FileOutputStream(f)) { os.write(bytes); }
            return f.getAbsolutePath();
        } catch (Exception e) { return ""; }
    }

    /** big files from the page (AmpyOBJ exports) in base64 chunks → Download/Cybercity. fileBegin → handle, fileChunk, fileEnd → path */
    private final java.util.HashMap<String, Object[]> outs = new java.util.HashMap<>();
    @JavascriptInterface public String fileBegin(String name, String mime) {
        try {
            String fn = name.replaceAll("[^A-Za-z0-9_.-]", "_"), h = String.valueOf(System.nanoTime());
            if (Build.VERSION.SDK_INT >= 29) {
                ContentValues cv = new ContentValues(); cv.put(MediaStore.Downloads.DISPLAY_NAME, fn); cv.put(MediaStore.Downloads.MIME_TYPE, mime);
                cv.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Cybercity");
                Uri u = act.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv); if (u == null) return "";
                outs.put(h, new Object[] { act.getContentResolver().openOutputStream(u), "Download/Cybercity/" + fn });
            } else { File dir = act.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS); if (dir == null) return ""; File f = new File(dir, fn); outs.put(h, new Object[] { new FileOutputStream(f), f.getAbsolutePath() }); }
            return h;
        } catch (Exception e) { return ""; }
    }
    @JavascriptInterface public boolean fileChunk(String h, String b64) {
        try { Object[] o = outs.get(h); if (o == null) return false; ((OutputStream) o[0]).write(Base64.decode(b64, Base64.DEFAULT)); return true; } catch (Exception e) { return false; }
    }
    @JavascriptInterface public String fileEnd(String h) {
        try { Object[] o = outs.remove(h); if (o == null) return ""; ((OutputStream) o[0]).close(); return (String) o[1]; } catch (Exception e) { return ""; }
    }

    /* ---- KAGE NET: small UDP broadcasts on the local Wi-Fi (no server). netStart → bool, netSend(json), netPoll → [{ip, m}] ---- */
    private java.net.DatagramSocket sock; private Thread rx; private android.net.wifi.WifiManager.MulticastLock mlock; private int netPort;
    private final java.util.concurrent.ConcurrentLinkedQueue<String[]> inbox = new java.util.concurrent.ConcurrentLinkedQueue<>();
    @JavascriptInterface public synchronized boolean netStart(int port) {
        if (sock != null) return true;
        try {
            netPort = port; sock = new java.net.DatagramSocket(null); sock.setReuseAddress(true); sock.setBroadcast(true); sock.bind(new java.net.InetSocketAddress(port));
            android.net.wifi.WifiManager wm = (android.net.wifi.WifiManager) act.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wm != null) { mlock = wm.createMulticastLock("kage-net"); mlock.setReferenceCounted(false); mlock.acquire(); }
            final java.net.DatagramSocket s = sock;
            rx = new Thread(() -> { byte[] buf = new byte[8192]; while (!s.isClosed()) { try { java.net.DatagramPacket p = new java.net.DatagramPacket(buf, buf.length); s.receive(p);
                if (inbox.size() < 400) inbox.add(new String[] { p.getAddress().getHostAddress(), new String(p.getData(), 0, p.getLength(), java.nio.charset.StandardCharsets.UTF_8) }); } catch (Exception e) { if (s.isClosed()) break; } } }, "kage-net");
            rx.setDaemon(true); rx.start(); return true;
        } catch (Exception e) { netStop(); return false; }
    }
    @JavascriptInterface public void netSend(String json) {
        java.net.DatagramSocket s = sock; if (s == null) return;
        try {
            byte[] b = json.getBytes(java.nio.charset.StandardCharsets.UTF_8);
            java.util.Enumeration<java.net.NetworkInterface> it = java.net.NetworkInterface.getNetworkInterfaces(); boolean sent = false;
            while (it != null && it.hasMoreElements()) { java.net.NetworkInterface ni = it.nextElement(); if (!ni.isUp() || ni.isLoopback()) continue;
                for (java.net.InterfaceAddress ia : ni.getInterfaceAddresses()) { java.net.InetAddress bc = ia.getBroadcast(); if (bc == null) continue; s.send(new java.net.DatagramPacket(b, b.length, bc, netPort)); sent = true; } }
            if (!sent) s.send(new java.net.DatagramPacket(b, b.length, java.net.InetAddress.getByName("255.255.255.255"), netPort));
        } catch (Exception ignored) { }
    }
    @JavascriptInterface public String netPoll() {
        JSONArray a = new JSONArray(); String[] q; int n = 0;
        while ((q = inbox.poll()) != null && n++ < 200) { try { JSONObject o = new JSONObject(); o.put("ip", q[0]); o.put("m", q[1]); a.put(o); } catch (Exception ignored) { } }
        return a.toString();
    }
    @JavascriptInterface public synchronized void netStop() {
        try { if (sock != null) sock.close(); } catch (Exception ignored) { } sock = null; inbox.clear();
        try { if (mlock != null && mlock.isHeld()) mlock.release(); } catch (Exception ignored) { } mlock = null;
    }

    /** the real torch (no camera permission needed) */
    @JavascriptInterface public boolean torch(boolean on) {
        try {
            CameraManager cm = (CameraManager) act.getSystemService(Context.CAMERA_SERVICE);
            for (String id : cm.getCameraIdList()) { Boolean f = cm.getCameraCharacteristics(id).get(CameraCharacteristics.FLASH_INFO_AVAILABLE);
                if (f != null && f) { cm.setTorchMode(id, on); return true; } }
        } catch (Exception ignored) { }
        return false;
    }
    @JavascriptInterface public void vibrate(int ms) {
        try { Vibrator v = (Vibrator) act.getSystemService(Context.VIBRATOR_SERVICE); if (v == null) return;
            if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createOneShot(Math.max(1, Math.min(2000, ms)), VibrationEffect.DEFAULT_AMPLITUDE)); else v.vibrate(ms);
        } catch (Exception ignored) { }
    }
    @JavascriptInterface public boolean cameraGranted() { return act.checkSelfPermission(android.Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED; }
}
