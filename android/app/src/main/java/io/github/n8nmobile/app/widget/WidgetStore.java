package io.github.n8nmobile.app.widget;

import android.content.Context;
import android.content.SharedPreferences;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * What the home screen widget remembers between updates: the signed-in n8n server (copied
 * from the app when you leave it), which workflows each widget shows, and the last status
 * it fetched for each workflow.
 */
final class WidgetStore {
    private static final String PREFS = "n8n_widget";

    /** Last refresh problem: none, the n8n session ended, or n8n could not be reached. */
    static final String ERR_AUTH = "auth";
    static final String ERR_OFFLINE = "offline";

    /** A run you started counts as "Starting…" until n8n reports it, or for this long. */
    static final long PENDING_MS = 90_000;

    private WidgetStore() {}

    private static SharedPreferences prefs(Context c) {
        return c.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    // ---------- session ----------

    static final class Session {
        final String url; // n8n base URL, no trailing slash
        final String basic; // base64 user:pass for a reverse proxy in front of n8n, or null
        final String browserId; // n8n ties the session cookie to this id

        Session(String url, String basic, String browserId) {
            this.url = url;
            this.basic = basic;
            this.browserId = browserId;
        }
    }

    static Session session(Context c) {
        SharedPreferences p = prefs(c);
        String url = p.getString("session.url", null);
        String bid = p.getString("session.browserId", null);
        if (url == null || url.isEmpty() || bid == null || bid.isEmpty()) return null;
        return new Session(url, p.getString("session.basic", null), bid);
    }

    /** Saves the app's sign-in. Returns true when it changed (signed in, out, or to another server). */
    static boolean saveSession(Context c, String url, String basic, String browserId) {
        Session old = session(c);
        String oldKey = old == null ? "" : old.url + "|" + old.basic + "|" + old.browserId;
        String newKey = url == null ? "" : url + "|" + basic + "|" + browserId;
        SharedPreferences.Editor e = prefs(c).edit();
        if (url == null) {
            e.remove("session.url").remove("session.basic").remove("session.browserId");
        } else {
            e.putString("session.url", url).putString("session.basic", basic).putString("session.browserId", browserId);
        }
        if (old != null && (url == null || !old.url.equals(url))) clearCache(c, e); // another server: forget its workflows
        e.remove("error");
        e.apply();
        return !oldKey.equals(newKey);
    }

    // ---------- which workflows each widget shows ----------

    static List<String> selection(Context c, int widgetId) {
        List<String> out = new ArrayList<>();
        try {
            JSONArray a = new JSONArray(prefs(c).getString("widget." + widgetId, "[]"));
            for (int i = 0; i < a.length(); i++) out.add(a.getString(i));
        } catch (JSONException ignored) {}
        return out;
    }

    static void setSelection(Context c, int widgetId, List<String> ids) {
        prefs(c).edit().putString("widget." + widgetId, new JSONArray(ids).toString()).apply();
    }

    static boolean isConfigured(Context c, int widgetId) {
        return prefs(c).contains("widget." + widgetId);
    }

    static void removeWidget(Context c, int widgetId) {
        prefs(c).edit().remove("widget." + widgetId).apply();
    }

    // ---------- last known status per workflow ----------

    /** {name, found, active, runnable, status, startedAt} or null when never fetched. */
    static JSONObject workflow(Context c, String id) {
        String s = prefs(c).getString("wf." + id, null);
        if (s == null) return null;
        try { return new JSONObject(s); } catch (JSONException e) { return null; }
    }

    static void putWorkflow(Context c, String id, JSONObject info) {
        prefs(c).edit().putString("wf." + id, info.toString()).apply();
    }

    private static void clearCache(Context c, SharedPreferences.Editor e) {
        for (String k : prefs(c).getAll().keySet()) {
            if (k.startsWith("wf.") || k.startsWith("pending.")) e.remove(k);
        }
    }

    static void markPending(Context c, String id) {
        prefs(c).edit().putLong("pending." + id, System.currentTimeMillis()).apply();
    }

    static void clearPending(Context c, String id) {
        prefs(c).edit().remove("pending." + id).apply();
    }

    /** When you pressed play, if that was less than PENDING_MS ago; otherwise 0. */
    static long pendingSince(Context c, String id) {
        long t = prefs(c).getLong("pending." + id, 0);
        return System.currentTimeMillis() - t < PENDING_MS ? t : 0;
    }

    // ---------- refresh result ----------

    static void setRefreshed(Context c, String error) {
        SharedPreferences.Editor e = prefs(c).edit();
        if (error == null) e.putLong("refreshedAt", System.currentTimeMillis()).remove("error");
        else e.putString("error", error);
        e.apply();
    }

    static long refreshedAt(Context c) {
        return prefs(c).getLong("refreshedAt", 0);
    }

    static String error(Context c) {
        return prefs(c).getString("error", null);
    }
}
