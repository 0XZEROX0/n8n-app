package io.github.n8nmobile.app.widget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.widget.Toast;

/**
 * The "n8n workflows" home screen widget. Resize it and it shows more workflows; each has
 * its last run status and a play button that starts it.
 */
public class WorkflowWidgetProvider extends AppWidgetProvider {
    static final String ACTION_RUN = "io.github.n8nmobile.app.widget.RUN";
    static final String ACTION_REFRESH = "io.github.n8nmobile.app.widget.REFRESH";
    static final String EXTRA_WORKFLOW_ID = "workflowId";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (ACTION_RUN.equals(action)) {
            run(context, intent.getStringExtra(EXTRA_WORKFLOW_ID));
        } else if (ACTION_REFRESH.equals(action)) {
            WidgetUpdates.refreshSoon(context, 0);
        } else {
            super.onReceive(context, intent);
        }
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        // Draw what we know right away, then fetch fresh statuses in the background.
        for (int id : ids) WidgetRenderer.render(context, manager, id);
        WidgetUpdates.refreshSoon(context, 0);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, Bundle newOptions) {
        // Resized: redraw with as many workflows as now fit.
        WidgetRenderer.render(context, manager, id);
    }

    @Override
    public void onDeleted(Context context, int[] ids) {
        for (int id : ids) WidgetStore.removeWidget(context, id);
    }

    private void run(Context context, String wfId) {
        if (wfId == null) return;
        WidgetStore.Session s = WidgetStore.session(context);
        if (s == null) { toast(context, "Open n8n Mobile and sign in first."); return; }
        WidgetStore.markPending(context, wfId);
        WidgetRenderer.renderAll(context); // shows "Starting…" at once

        Context app = context.getApplicationContext();
        PendingResult result = goAsync();
        new Thread(() -> {
            try {
                String msg = new N8nClient(s).run(wfId);
                toast(app, msg);
            } catch (N8nClient.AuthException e) {
                WidgetStore.clearPending(app, wfId);
                WidgetStore.setRefreshed(app, WidgetStore.ERR_AUTH);
                toast(app, e.getMessage());
            } catch (Exception e) {
                WidgetStore.clearPending(app, wfId);
                toast(app, e.getMessage() != null ? e.getMessage() : "Could not start the workflow.");
            } finally {
                WidgetRenderer.renderAll(app);
                WidgetUpdates.refreshSoon(app, 3_000);
                result.finish();
            }
        }, "n8n-widget-run").start();
    }

    private static void toast(Context c, String msg) {
        new Handler(Looper.getMainLooper()).post(() -> Toast.makeText(c, msg, Toast.LENGTH_LONG).show());
    }
}
