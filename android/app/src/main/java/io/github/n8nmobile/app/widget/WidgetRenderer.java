package io.github.n8nmobile.app.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.text.format.DateFormat;
import android.text.format.DateUtils;
import android.view.View;
import android.widget.RemoteViews;
import io.github.n8nmobile.app.MainActivity;
import io.github.n8nmobile.app.R;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;
import org.json.JSONObject;

/**
 * Draws the widget. Each workflow gets a 2x2 block of home screen cells, so the same widget
 * shows 1 workflow at 2x2, 2 at 4x2, 4 at 4x4 and so on as you resize it. Smaller than
 * 2x2 it still shows one workflow, in a compact tile.
 */
final class WidgetRenderer {
    private static final int MAX_CELLS = 8;

    private WidgetRenderer() {}

    static void renderAll(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        for (int id : WidgetUpdates.widgetIds(c)) render(c, m, id);
    }

    static void render(Context c, AppWidgetManager m, int widgetId) {
        m.updateAppWidget(widgetId, build(c, widgetId, m.getAppWidgetOptions(widgetId)));
    }

    /** Home screen cells from a size in dp (Android's own sizing rule: n cells ≈ 70n − 30 dp). */
    static int cells(int dp, int fallback, int max) {
        if (dp <= 0) return fallback;
        return Math.max(1, Math.min(max, (dp + 30) / 70));
    }

    static RemoteViews build(Context c, int widgetId, Bundle opts) {
        int cellsW = cells(opts == null ? 0 : opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH), 2, MAX_CELLS);
        int cellsH = cells(opts == null ? 0 : opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT), 2, MAX_CELLS);
        // One workflow per 2x2 block; a narrow or flat widget gets compact tiles.
        boolean full = cellsW >= 2 && cellsH >= 2;
        int cols = Math.max(1, cellsW / 2);
        int rows = Math.max(1, cellsH / 2);

        RemoteViews root = new RemoteViews(c.getPackageName(), R.layout.widget_root);
        root.removeAllViews(R.id.widget_grid);

        WidgetStore.Session s = WidgetStore.session(c);
        String err = WidgetStore.error(c);
        if (s == null) return message(root, "Open n8n Mobile and sign in to see your workflows here.", openApp(c, null));
        if (WidgetStore.ERR_AUTH.equals(err)) return message(root, "Your n8n session ended. Tap to sign in again.", openApp(c, null));
        List<String> sel = WidgetStore.selection(c, widgetId);
        if (sel.isEmpty()) return message(root, "Tap to pick the workflows to show.", openConfig(c, widgetId));

        root.setViewVisibility(R.id.widget_message, View.GONE);
        root.setViewVisibility(R.id.widget_grid, View.VISIBLE);

        // The header (last update, refresh, pick workflows) once the widget is 2 cells tall.
        boolean header = cellsH >= 2;
        root.setViewVisibility(R.id.widget_header, header ? View.VISIBLE : View.GONE);
        if (header) {
            long at = WidgetStore.refreshedAt(c);
            String when = at > 0 ? formatTime(c, at) : "";
            String txt = WidgetStore.ERR_OFFLINE.equals(err) ? "Offline" + (when.isEmpty() ? "" : " · " + when) : when.isEmpty() ? "" : "Updated " + when;
            root.setTextViewText(R.id.widget_updated, txt);
            root.setOnClickPendingIntent(R.id.widget_title, openApp(c, null));
            root.setOnClickPendingIntent(R.id.widget_refresh, broadcast(c, WorkflowWidgetProvider.ACTION_REFRESH, widgetId, null));
            root.setOnClickPendingIntent(R.id.widget_settings, openConfig(c, widgetId));
        }

        for (int r = 0; r < rows; r++) {
            RemoteViews line = new RemoteViews(c.getPackageName(), R.layout.widget_line);
            for (int col = 0; col < cols; col++) {
                int i = r * cols + col;
                RemoteViews cell;
                if (i < sel.size()) cell = full ? fullTile(c, widgetId, sel.get(i)) : tile(c, widgetId, sel.get(i));
                else if (i == sel.size()) {
                    cell = new RemoteViews(c.getPackageName(), R.layout.widget_tile_add);
                    cell.setOnClickPendingIntent(R.id.tile_add, openConfig(c, widgetId));
                } else cell = new RemoteViews(c.getPackageName(), R.layout.widget_tile_empty);
                line.addView(R.id.widget_line, cell);
            }
            root.addView(R.id.widget_grid, line);
        }
        return root;
    }

    private static RemoteViews message(RemoteViews root, String text, PendingIntent onTap) {
        root.setViewVisibility(R.id.widget_header, View.GONE);
        root.setViewVisibility(R.id.widget_grid, View.GONE);
        root.setViewVisibility(R.id.widget_message, View.VISIBLE);
        root.setTextViewText(R.id.widget_message, text);
        root.setOnClickPendingIntent(R.id.widget_message, onTap);
        return root;
    }

    private static final int[] HISTORY_DOTS = {
        R.id.tile_h0, R.id.tile_h1, R.id.tile_h2, R.id.tile_h3, R.id.tile_h4,
        R.id.tile_h5, R.id.tile_h6, R.id.tile_h7, R.id.tile_h8, R.id.tile_h9,
    };

    /** A 2x2 (or bigger) tile: name, result, when, how long, trigger, and the last 10 runs. */
    private static RemoteViews fullTile(Context c, int widgetId, String wfId) {
        RemoteViews t = new RemoteViews(c.getPackageName(), R.layout.widget_tile_full);
        JSONObject info = WidgetStore.workflow(c, wfId);
        long pending = WidgetStore.pendingSince(c, wfId);
        t.setTextViewText(R.id.tile_name, info != null ? info.optString("name", "Workflow") : "Loading…");

        String st = info != null ? info.optString("status", "") : "";
        long at = info != null ? info.optLong("startedAt", 0) : 0;
        String status;
        int dot;
        if (pending > 0) { status = "Starting…"; dot = R.drawable.widget_dot_info; }
        else if (info == null) { status = "Loading…"; dot = R.drawable.widget_dot_idle; }
        else if (!info.optBoolean("found", true)) { status = "Not found on n8n"; dot = R.drawable.widget_dot_bad; }
        else if (st.equals("success")) { status = "Succeeded"; dot = R.drawable.widget_dot_ok; }
        else if (st.equals("error")) { status = "Failed"; dot = R.drawable.widget_dot_bad; }
        else if (st.equals("running") || st.equals("new")) { status = "Running now"; dot = R.drawable.widget_dot_info; }
        else if (st.equals("waiting")) { status = "Waiting"; dot = R.drawable.widget_dot_info; }
        else if (st.equals("canceled")) { status = "Canceled"; dot = R.drawable.widget_dot_warn; }
        else if (st.isEmpty()) { status = "Never ran"; dot = R.drawable.widget_dot_idle; }
        else { status = st; dot = R.drawable.widget_dot_idle; }
        t.setTextViewText(R.id.tile_status, status);
        t.setImageViewResource(R.id.tile_dot, dot);

        // "Today 14:02 · 3 s": one short line, so it fits next to everything else on a 2x2 tile.
        String when = "";
        if (at > 0) {
            when = formatWhen(c, at);
            long dur = info.optLong("durationMs", -1);
            if (dur >= 0 && !st.equals("running")) when += " · " + formatDuration(dur);
        }
        t.setTextViewText(R.id.tile_when, when);
        t.setViewVisibility(R.id.tile_when, when.isEmpty() ? View.GONE : View.VISIBLE);

        // "Schedule · Active"
        String meta = "";
        if (info != null && info.optBoolean("found", true) && info.has("active")) {
            String trig = info.optString("trigger", "");
            meta = (trig.isEmpty() ? "" : trig + " · ") + (info.optBoolean("active") ? "Active" : "Inactive");
        }
        t.setTextViewText(R.id.tile_meta, meta);
        t.setViewVisibility(R.id.tile_meta, meta.isEmpty() ? View.GONE : View.VISIBLE);

        // Last runs as dots, oldest left, newest right, plus "9/10 OK".
        String hist = info != null ? info.optString("history", "") : "";
        for (int i = 0; i < HISTORY_DOTS.length; i++) {
            int j = HISTORY_DOTS.length - 1 - i; // history is newest first; the newest dot is on the right
            if (j >= hist.length()) { t.setViewVisibility(HISTORY_DOTS[i], View.GONE); continue; }
            char ch = hist.charAt(j);
            t.setViewVisibility(HISTORY_DOTS[i], View.VISIBLE);
            t.setImageViewResource(HISTORY_DOTS[i], ch == 's' ? R.drawable.widget_dot_ok : ch == 'e' ? R.drawable.widget_dot_bad
                : ch == 'c' ? R.drawable.widget_dot_warn : R.drawable.widget_dot_info);
        }
        String rate = "";
        if (!hist.isEmpty()) {
            int ok = info.optInt("ok");
            rate = ok + "/" + hist.length() + " OK";
        }
        t.setTextViewText(R.id.tile_rate, rate);
        t.setViewVisibility(R.id.tile_rate, rate.isEmpty() ? View.GONE : View.VISIBLE);

        setButtons(c, t, widgetId, wfId, info, pending);
        return t;
    }

    private static void setButtons(Context c, RemoteViews t, int widgetId, String wfId, JSONObject info, long pending) {
        t.setOnClickPendingIntent(R.id.tile, openApp(c, wfId));
        boolean runnable = info == null || info.optBoolean("runnable", true);
        if (pending > 0) {
            // Already starting: the button only refreshes, so a second tap doesn't run it twice.
            t.setImageViewResource(R.id.tile_play, R.drawable.widget_ic_play);
            t.setInt(R.id.tile_play, "setImageAlpha", 90);
            t.setOnClickPendingIntent(R.id.tile_play, broadcast(c, WorkflowWidgetProvider.ACTION_REFRESH, widgetId, null));
        } else if (runnable) {
            t.setImageViewResource(R.id.tile_play, R.drawable.widget_ic_play);
            t.setOnClickPendingIntent(R.id.tile_play, broadcast(c, WorkflowWidgetProvider.ACTION_RUN, widgetId, wfId));
        } else {
            // Starts only from its own trigger (schedule, form, chat…): open it in the app instead.
            t.setImageViewResource(R.id.tile_play, R.drawable.widget_ic_open);
            t.setOnClickPendingIntent(R.id.tile_play, openApp(c, wfId));
        }
    }

    /** "Today 14:02", "Yesterday 09:10", "Nov 3, 14:02". */
    static String formatWhen(Context c, long t) {
        String time = DateFormat.getTimeFormat(c).format(new Date(t));
        if (DateUtils.isToday(t)) return "Today " + time;
        if (DateUtils.isToday(t + DateUtils.DAY_IN_MILLIS)) return "Yesterday " + time;
        return DateUtils.formatDateTime(c, t, DateUtils.FORMAT_SHOW_DATE | DateUtils.FORMAT_ABBREV_MONTH | DateUtils.FORMAT_NO_YEAR) + ", " + time;
    }

    static String formatDuration(long ms) {
        if (ms < 100) return "< 0.1 s";
        if (ms < 1000) return String.format(Locale.US, "%.1f s", ms / 1000.0);
        long s = ms / 1000;
        if (s < 60) return s + " s";
        long m = s / 60;
        if (m < 60) return m + " min";
        return (m / 60) + " h " + (m % 60) + " min";
    }

    /** Compact tile for a widget smaller than 2x2. */
    private static RemoteViews tile(Context c, int widgetId, String wfId) {
        RemoteViews t = new RemoteViews(c.getPackageName(), R.layout.widget_tile);
        JSONObject info = WidgetStore.workflow(c, wfId);
        long pending = WidgetStore.pendingSince(c, wfId);

        t.setTextViewText(R.id.tile_name, info != null ? info.optString("name", "Workflow") : "Loading…");

        String status;
        int dot;
        String st = info != null ? info.optString("status", "") : "";
        long at = info != null ? info.optLong("startedAt", 0) : 0;
        if (pending > 0) { status = "Starting…"; dot = R.drawable.widget_dot_info; }
        else if (info == null) { status = ""; dot = R.drawable.widget_dot_idle; }
        else if (!info.optBoolean("found", true)) { status = "Not found"; dot = R.drawable.widget_dot_bad; }
        else if (st.equals("success")) { status = "OK " + formatTime(c, at); dot = R.drawable.widget_dot_ok; }
        else if (st.equals("error")) { status = "Failed " + formatTime(c, at); dot = R.drawable.widget_dot_bad; }
        else if (st.equals("running") || st.equals("new")) { status = "Running"; dot = R.drawable.widget_dot_info; }
        else if (st.equals("waiting")) { status = "Waiting"; dot = R.drawable.widget_dot_info; }
        else if (st.equals("canceled")) { status = "Canceled " + formatTime(c, at); dot = R.drawable.widget_dot_warn; }
        else if (st.isEmpty()) { status = "No runs yet"; dot = R.drawable.widget_dot_idle; }
        else { status = st; dot = R.drawable.widget_dot_idle; }
        t.setTextViewText(R.id.tile_status, status.trim());
        t.setImageViewResource(R.id.tile_dot, dot);

        setButtons(c, t, widgetId, wfId, info, pending);
        return t;
    }

    // ---------- intents ----------

    private static int flags() {
        return PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
    }

    static PendingIntent openApp(Context c, String wfId) {
        Intent i = new Intent(c, MainActivity.class)
            .setAction(MainActivity.ACTION_OPEN_WORKFLOW)
            .setData(Uri.parse("n8nmobile://widget/open/" + (wfId == null ? "" : Uri.encode(wfId))))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        if (wfId != null) i.putExtra(MainActivity.EXTRA_WORKFLOW_ID, wfId);
        return PendingIntent.getActivity(c, 0, i, flags());
    }

    static PendingIntent openConfig(Context c, int widgetId) {
        Intent i = new Intent(c, WidgetConfigActivity.class)
            .setData(Uri.parse("n8nmobile://widget/config/" + widgetId))
            .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(c, widgetId, i, flags());
    }

    private static PendingIntent broadcast(Context c, String action, int widgetId, String wfId) {
        Intent i = new Intent(c, WorkflowWidgetProvider.class)
            .setAction(action)
            .setData(Uri.parse("n8nmobile://widget/" + action + "/" + widgetId + "/" + (wfId == null ? "" : Uri.encode(wfId))))
            .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId);
        if (wfId != null) i.putExtra(WorkflowWidgetProvider.EXTRA_WORKFLOW_ID, wfId);
        return PendingIntent.getBroadcast(c, widgetId, i, flags());
    }

    // ---------- time ----------

    /** "14:02" today, "Nov 3" before that: stays true even if the widget isn't redrawn for a while. */
    static String formatTime(Context c, long t) {
        if (t <= 0) return "";
        if (DateUtils.isToday(t)) return DateFormat.getTimeFormat(c).format(new Date(t));
        return DateUtils.formatDateTime(c, t, DateUtils.FORMAT_SHOW_DATE | DateUtils.FORMAT_ABBREV_MONTH | DateUtils.FORMAT_NO_YEAR);
    }

    /** n8n's ISO times, e.g. 2026-11-09T23:23:40.123Z (UTC). */
    static long parseTime(String iso) {
        if (iso == null || iso.length() < 19) return 0;
        SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US);
        f.setTimeZone(TimeZone.getTimeZone("UTC"));
        try { return f.parse(iso.substring(0, 19)).getTime(); } catch (ParseException e) { return 0; }
    }
}
