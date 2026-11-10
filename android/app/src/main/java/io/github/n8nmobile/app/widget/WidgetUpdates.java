package io.github.n8nmobile.app.widget;

import android.app.job.JobInfo;
import android.app.job.JobScheduler;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import java.io.IOException;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** Fetches the latest status of every workflow shown on a widget, and redraws the widgets. */
public final class WidgetUpdates {
    private static final int JOB_ID = 73_01;
    /** While something is starting or running, check again this often. */
    private static final long POLL_MS = 10_000;
    /** …but stop following a run after this long; the 30-minute refresh picks it up. */
    private static final long FOLLOW_RUN_MS = 5 * 60_000;
    /** Runs shown as dots on a big tile. */
    static final int HISTORY = 10;

    private WidgetUpdates() {}

    static int[] widgetIds(Context c) {
        return AppWidgetManager.getInstance(c).getAppWidgetIds(new ComponentName(c, WorkflowWidgetProvider.class));
    }

    /** Asks Android to refresh the widgets in the background after `delayMs`, once there is network. */
    public static void refreshSoon(Context c, long delayMs) {
        if (widgetIds(c).length == 0) return;
        JobScheduler js = (JobScheduler) c.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (js == null) return;
        JobInfo job = new JobInfo.Builder(JOB_ID, new ComponentName(c, WidgetRefreshJob.class))
            .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
            .setMinimumLatency(delayMs)
            .setOverrideDeadline(delayMs + 5_000)
            .build();
        try {
            js.schedule(job); // replaces a pending refresh, so they never pile up
        } catch (RuntimeException e) {
            // Never let a refresh that can't be scheduled take the app or the widget down.
            android.util.Log.w("n8nWidget", "Could not schedule widget refresh", e);
        }
    }

    /** Called when you sign in or out in the app, or leave it. */
    public static void sessionFromApp(Context c, String url, String basic, String browserId) {
        boolean changed = WidgetStore.saveSession(c, url, basic, browserId);
        if (changed) WidgetRenderer.renderAll(c);
        refreshSoon(c, 0);
    }

    /** Network work: run on a background thread. */
    static void refreshNow(Context c) {
        int[] ids = widgetIds(c);
        if (ids.length == 0) return;
        WidgetStore.Session s = WidgetStore.session(c);
        if (s == null) { WidgetRenderer.renderAll(c); return; }

        Set<String> wanted = new LinkedHashSet<>();
        for (int id : ids) wanted.addAll(WidgetStore.selection(c, id));
        boolean follow = false;
        try {
            N8nClient api = new N8nClient(s);
            Map<String, JSONObject> byId = new HashMap<>();
            if (!wanted.isEmpty()) {
                List<JSONObject> all = api.workflows();
                for (JSONObject w : all) byId.put(w.optString("id"), w);
            }
            for (String id : wanted) {
                JSONObject wf = byId.get(id);
                JSONObject info = new JSONObject();
                info.put("found", wf != null);
                JSONObject old = WidgetStore.workflow(c, id);
                info.put("name", wf != null ? wf.optString("name") : old != null ? old.optString("name") : "Workflow " + id);
                if (wf != null) {
                    info.put("active", wf.optBoolean("active"));
                    info.put("runnable", N8nClient.canRun(wf));
                    info.put("trigger", N8nClient.triggerLabel(wf));
                    JSONArray runs = api.recentExecutions(id, HISTORY);
                    // Newest first: s = succeeded, e = failed, r = running/waiting, c = canceled.
                    StringBuilder hist = new StringBuilder();
                    int ok = 0, bad = 0;
                    for (int i = 0; i < runs.length(); i++) {
                        String st = N8nClient.executionStatus(runs.optJSONObject(i));
                        char k = "success".equals(st) ? 's' : "error".equals(st) ? 'e' : "canceled".equals(st) ? 'c' : 'r';
                        if (k == 's') ok++;
                        if (k == 'e') bad++;
                        hist.append(k);
                    }
                    info.put("history", hist.toString());
                    info.put("ok", ok);
                    info.put("failed", bad);
                    JSONObject ex = runs.length() > 0 ? runs.optJSONObject(0) : null;
                    if (ex != null) {
                        String st = N8nClient.executionStatus(ex);
                        long started = WidgetRenderer.parseTime(ex.optString("startedAt", ex.optString("createdAt", "")));
                        long stopped = WidgetRenderer.parseTime(ex.isNull("stoppedAt") ? "" : ex.optString("stoppedAt", ""));
                        info.put("status", st);
                        info.put("startedAt", started);
                        if (stopped >= started && started > 0) info.put("durationMs", stopped - started);
                        long pending = WidgetStore.pendingSince(c, id);
                        if (pending > 0 && started >= pending - 5_000) WidgetStore.clearPending(c, id); // n8n has it now
                        boolean live = "running".equals(st) || "new".equals(st) || "waiting".equals(st);
                        if (live && System.currentTimeMillis() - started < FOLLOW_RUN_MS) follow = true;
                    }
                }
                if (WidgetStore.pendingSince(c, id) > 0) follow = true;
                WidgetStore.putWorkflow(c, id, info);
            }
            WidgetStore.setRefreshed(c, null);
        } catch (N8nClient.AuthException e) {
            WidgetStore.setRefreshed(c, WidgetStore.ERR_AUTH);
        } catch (IOException | JSONException e) {
            WidgetStore.setRefreshed(c, WidgetStore.ERR_OFFLINE);
        }
        WidgetRenderer.renderAll(c);
        if (follow) refreshSoon(c, POLL_MS);
    }
}
