package io.github.n8nmobile.app.widget;

import android.app.job.JobParameters;
import android.app.job.JobService;

/** Background job that refreshes the widgets (see WidgetUpdates.refreshSoon). */
public class WidgetRefreshJob extends JobService {
    @Override
    public boolean onStartJob(JobParameters params) {
        new Thread(() -> {
            try {
                WidgetUpdates.refreshNow(getApplicationContext());
            } finally {
                jobFinished(params, false);
            }
        }, "n8n-widget-refresh").start();
        return true;
    }

    @Override
    public boolean onStopJob(JobParameters params) {
        return true; // try again later
    }
}
