package io.github.n8nmobile.app;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.CookieManager;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;
import io.github.n8nmobile.app.widget.WidgetUpdates;
import org.json.JSONObject;
import org.json.JSONTokener;

public class MainActivity extends BridgeActivity {
    /** The home screen widget opens the app with this to show one workflow. */
    public static final String ACTION_OPEN_WORKFLOW = "io.github.n8nmobile.app.OPEN_WORKFLOW";
    public static final String EXTRA_WORKFLOW_ID = "workflowId";

    // Reads the app's sign-in (server address, proxy password, browser id) for the widget.
    private static final String SESSION_JS = "(function(){try{"
        + "var g=function(k){var v=localStorage.getItem(k);if(v==null)v=sessionStorage.getItem(k);return v?JSON.parse(v):null};"
        + "return JSON.stringify({conn:g('n8n.conn'),bid:g('n8n.browserId')})}catch(e){return null}})()";

    private final Handler handler = new Handler(Looper.getMainLooper());
    private OnBackPressedCallback backCallback;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // In-app updates: downloads the new APK and opens Android's installer.
        registerPlugin(AppUpdaterPlugin.class);
        super.onCreate(savedInstanceState);

        // Android back (edge swipe or back button): let the web app close a sheet or go to
        // Overview first. It answers "exit" only on the second back within 2 seconds on Overview.
        backCallback = new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView web = getBridge() != null ? getBridge().getWebView() : null;
                if (web == null) { exitApp(); return; }
                web.evaluateJavascript("window.n8nBack ? window.n8nBack() : 'exit'", (result) -> {
                    if (!"\"handled\"".equals(result)) exitApp();
                });
            }
        };
        getOnBackPressedDispatcher().addCallback(this, backCallback);
    }

    @Override
    public void onPause() {
        shareSessionWithWidget();
        super.onPause();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent); // also runs once from onCreate with the launch intent
        String wfId = intent == null ? null : intent.getStringExtra(EXTRA_WORKFLOW_ID);
        if (wfId != null) {
            intent.removeExtra(EXTRA_WORKFLOW_ID);
            openWorkflow(wfId, 0);
        }
    }

    /** Tapped a workflow on the widget: open it once the web app has loaded. */
    private void openWorkflow(String wfId, int attempt) {
        WebView web = getBridge() != null ? getBridge().getWebView() : null;
        if (web == null) {
            if (attempt < 40) handler.postDelayed(() -> openWorkflow(wfId, attempt + 1), 250);
            return;
        }
        String js = "window.n8nOpenWorkflow ? window.n8nOpenWorkflow(" + JSONObject.quote(wfId) + ") : 'wait'";
        web.evaluateJavascript(js, (result) -> {
            if (!"\"ok\"".equals(result) && attempt < 40) handler.postDelayed(() -> openWorkflow(wfId, attempt + 1), 250);
        });
    }

    /**
     * The widget uses the app's n8n session. Each time you leave the app, hand it the
     * current sign-in (or that you signed out) and let it refresh.
     */
    private void shareSessionWithWidget() {
        WebView web = getBridge() != null ? getBridge().getWebView() : null;
        if (web == null) return;
        CookieManager.getInstance().flush();
        web.evaluateJavascript(SESSION_JS, (result) -> {
            try {
                Object v = new JSONTokener(result).nextValue();
                if (!(v instanceof String)) return;
                JSONObject o = new JSONObject((String) v);
                JSONObject conn = o.optJSONObject("conn");
                String bid = o.isNull("bid") ? "" : o.optString("bid");
                String url = conn == null || conn.isNull("url") ? "" : conn.optString("url").replaceAll("/+$", "");
                if (url.isEmpty() || bid.isEmpty() || conn.optBoolean("viaProxy")) {
                    WidgetUpdates.sessionFromApp(this, null, null, null);
                } else {
                    String basic = conn.isNull("basic") ? null : conn.optString("basic", null);
                    WidgetUpdates.sessionFromApp(this, url, basic, bid);
                }
            } catch (Exception ignored) {
                // Page not loaded yet: try again next time.
            }
        });
    }

    private void exitApp() {
        // Hand this one back press to Android so it closes the app the normal way.
        backCallback.setEnabled(false);
        getOnBackPressedDispatcher().onBackPressed();
        backCallback.setEnabled(true);
    }
}
