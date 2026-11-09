package io.github.n8nmobile.app;

import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
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

    private void exitApp() {
        // Hand this one back press to Android so it closes the app the normal way.
        backCallback.setEnabled(false);
        getOnBackPressedDispatcher().onBackPressed();
        backCallback.setEnabled(true);
    }
}
