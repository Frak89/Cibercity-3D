package it.ampy.cybercity;

import android.app.Notification;
import android.content.ComponentName;
import android.content.Context;
import android.graphics.drawable.Icon;
import android.provider.Settings;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Keeps the small icons of the apps that currently have notifications (one per app, no counts). */
public class NotifListener extends NotificationListenerService {
    public interface Watcher { void onIcons(List<Icon> icons); }

    private static final Map<String, Icon> ICONS = new LinkedHashMap<>();
    private static Watcher watcher;
    private static NotifListener instance;

    public static boolean granted(Context c) {
        String s = Settings.Secure.getString(c.getContentResolver(), "enabled_notification_listeners");
        return s != null && s.contains(new ComponentName(c, NotifListener.class).flattenToString());
    }

    public static synchronized void setWatcher(Watcher w) {
        watcher = w;
        if (w != null) { if (instance != null) instance.rebuild(); else w.onIcons(new ArrayList<>(ICONS.values())); }
    }

    /** the active notifications as JSON for the in-game AmpybiOS tablet: { granted, items: [{ app, pkg, title, text, time }] } */
    public static String snapshot(Context c) {
        org.json.JSONObject o = new org.json.JSONObject();
        try {
            o.put("granted", granted(c)); org.json.JSONArray a = new org.json.JSONArray();
            NotifListener in = instance;
            if (in != null) { StatusBarNotification[] all = in.getActiveNotifications(); android.content.pm.PackageManager pm = c.getPackageManager();
                if (all != null) for (StatusBarNotification n : all) {
                    Notification no = n.getNotification(); if ((no.flags & Notification.FLAG_GROUP_SUMMARY) != 0) continue;
                    org.json.JSONObject it = new org.json.JSONObject(); String label = n.getPackageName();
                    try { label = String.valueOf(pm.getApplicationLabel(pm.getApplicationInfo(n.getPackageName(), 0))); } catch (Exception ignored) { }
                    CharSequence t = no.extras.getCharSequence(Notification.EXTRA_TITLE), x = no.extras.getCharSequence(Notification.EXTRA_TEXT);
                    it.put("app", label); it.put("pkg", n.getPackageName()); it.put("title", t == null ? "" : t.toString()); it.put("text", x == null ? "" : x.toString()); it.put("time", n.getPostTime());
                    a.put(it); } }
            o.put("connected", in != null); o.put("items", a);
        } catch (Exception ignored) { }
        return o.toString();
    }

    @Override public void onListenerConnected() { instance = this; rebuild(); }
    @Override public void onListenerDisconnected() { instance = null; }
    @Override public void onNotificationPosted(StatusBarNotification sbn) { rebuild(); }
    @Override public void onNotificationRemoved(StatusBarNotification sbn) { rebuild(); }

    private void rebuild() {
        StatusBarNotification[] all;
        try { all = getActiveNotifications(); } catch (Exception e) { return; }
        Map<String, Icon> m = new LinkedHashMap<>();
        if (all != null) for (StatusBarNotification n : all) {
            if (n.getPackageName().equals(getPackageName())) continue;
            Notification no = n.getNotification();
            if (n.isOngoing() || (no.flags & Notification.FLAG_FOREGROUND_SERVICE) != 0) continue; // music, navigation, charging…
            if ((no.flags & Notification.FLAG_GROUP_SUMMARY) != 0 && m.containsKey(n.getPackageName())) continue;
            Icon ic = no.getSmallIcon();
            if (ic != null && !m.containsKey(n.getPackageName())) m.put(n.getPackageName(), ic);
        }
        synchronized (NotifListener.class) {
            ICONS.clear(); ICONS.putAll(m);
            if (watcher != null) watcher.onIcons(new ArrayList<>(ICONS.values()));
        }
    }
}
