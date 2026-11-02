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
