package io.github.n8nmobile.app.widget;

import android.appwidget.AppWidgetManager;
import android.content.Intent;
import android.content.res.Configuration;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseAdapter;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.ListView;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import io.github.n8nmobile.app.MainActivity;
import io.github.n8nmobile.app.R;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Opens when you add the widget (and from its ⚙ button, or "Reconfigure" on Android 12+):
 * tap the workflows to show. The widget shows them in the order you picked them.
 * Styled like the app itself (colours from public/styles.css, light or dark with the phone).
 */
public class WidgetConfigActivity extends AppCompatActivity {
    private int widgetId = AppWidgetManager.INVALID_APPWIDGET_ID;
    private final List<JSONObject> all = new ArrayList<>();
    private final List<JSONObject> shown = new ArrayList<>();
    private final List<String> picked = new ArrayList<>();
    private String query = "";
    private Adapter adapter;
    private TextView status;
    private TextView count;
    private TextView save;
    private boolean editing;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Leaving with Back cancels adding the widget.
        setResult(RESULT_CANCELED);
        Bundle extras = getIntent().getExtras();
        if (extras != null) widgetId = extras.getInt(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID) { finish(); return; }

        setContentView(R.layout.widget_config);
        View root = findViewById(R.id.config_root);
        getWindow().getDecorView().setBackgroundColor(getColor(R.color.cfg_bg));

        // Draw under the status and navigation bars like the app, with icons readable on our background.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        boolean night = (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        WindowInsetsControllerCompat bars = WindowCompat.getInsetsController(getWindow(), root);
        bars.setAppearanceLightStatusBars(!night);
        bars.setAppearanceLightNavigationBars(!night);
        int padL = root.getPaddingLeft(), padT = root.getPaddingTop(), padR = root.getPaddingRight(), padB = root.getPaddingBottom();
        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            Insets b = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.ime());
            v.setPadding(padL + b.left, padT + b.top, padR + b.right, padB + b.bottom);
            return WindowInsetsCompat.CONSUMED;
        });

        status = findViewById(R.id.config_status);
        count = findViewById(R.id.config_count);
        save = findViewById(R.id.config_save);
        findViewById(R.id.config_cancel).setOnClickListener(v -> finish());
        editing = WidgetStore.isConfigured(this, widgetId);
        picked.addAll(WidgetStore.selection(this, widgetId));

        ListView list = findViewById(R.id.config_list);
        adapter = new Adapter();
        list.setAdapter(adapter);
        list.setOnItemClickListener((parent, view, position, id) -> {
            String wfId = shown.get(position).optString("id");
            if (picked.contains(wfId)) picked.remove(wfId); else picked.add(wfId);
            adapter.notifyDataSetChanged();
            updateSave();
        });

        EditText search = findViewById(R.id.config_search);
        search.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int a, int b, int c) {}
            @Override public void onTextChanged(CharSequence s, int a, int b, int c) {}
            @Override public void afterTextChanged(Editable s) { query = s.toString().trim().toLowerCase(Locale.ROOT); filter(); }
        });

        updateSave();
        WidgetStore.Session session = WidgetStore.session(this);
        if (session == null) {
            showProblem("Open n8n Mobile and sign in first, then add the widget again.");
            return;
        }
        showStatus("Loading your workflows…");
        new Thread(() -> {
            try {
                List<JSONObject> rows = new N8nClient(session).workflows();
                List<JSONObject> live = new ArrayList<>();
                for (JSONObject w : rows) if (!w.optBoolean("isArchived")) live.add(w);
                Collections.sort(live, (a, b) -> a.optString("name").compareToIgnoreCase(b.optString("name")));
                runOnUiThread(() -> {
                    all.clear();
                    all.addAll(live);
                    if (all.isEmpty()) showStatus("No workflows on this n8n yet."); else status.setVisibility(View.GONE);
                    filter();
                    updateSave();
                });
            } catch (N8nClient.AuthException e) {
                runOnUiThread(() -> showProblem("Your n8n session ended. Open n8n Mobile, sign in again, then come back here."));
            } catch (Exception e) {
                runOnUiThread(() -> showStatus("Could not load workflows.\n" + e.getMessage()));
            }
        }, "n8n-widget-config").start();
    }

    private void showStatus(String text) {
        status.setText(text);
        status.setVisibility(View.VISIBLE);
    }

    private void showProblem(String text) {
        showStatus(text);
        setSaveEnabled(true);
        save.setText("Open n8n Mobile");
        save.setOnClickListener(v -> {
            startActivity(new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            finish();
        });
    }

    private void filter() {
        shown.clear();
        for (JSONObject w : all) {
            if (query.isEmpty() || w.optString("name").toLowerCase(Locale.ROOT).contains(query)) shown.add(w);
        }
        if (!all.isEmpty() && shown.isEmpty()) showStatus("No workflow matches “" + query + "”.");
        else if (!all.isEmpty()) status.setVisibility(View.GONE);
        adapter.notifyDataSetChanged();
    }

    private void setSaveEnabled(boolean on) {
        save.setEnabled(on);
        save.setAlpha(on ? 1f : 0.4f);
    }

    private void updateSave() {
        int n = picked.size();
        count.setText(n == 0 ? "None picked" : n == 1 ? "1 picked" : n + " picked");
        count.setTextColor(getColor(n == 0 ? R.color.cfg_muted : R.color.cfg_accent));
        save.setText(editing ? "Save" : n <= 1 ? "Add widget" : "Add widget · " + n);
        setSaveEnabled(n > 0 && !all.isEmpty());
        save.setOnClickListener(v -> done());
    }

    private void done() {
        List<String> keep = new ArrayList<>();
        for (String id : picked) {
            JSONObject wf = find(id);
            if (wf == null) continue; // deleted since
            keep.add(id);
            if (WidgetStore.workflow(this, id) == null) {
                // Show the name at once; the status follows with the refresh below.
                try {
                    WidgetStore.putWorkflow(this, id, new JSONObject()
                        .put("name", wf.optString("name"))
                        .put("found", true)
                        .put("active", wf.optBoolean("active"))
                        .put("runnable", N8nClient.canRun(wf))
                        .put("trigger", N8nClient.triggerLabel(wf)));
                } catch (JSONException ignored) {}
            }
        }
        WidgetStore.setSelection(this, widgetId, keep);
        WidgetRenderer.render(this, AppWidgetManager.getInstance(this), widgetId);
        WidgetUpdates.refreshSoon(this, 0);
        setResult(RESULT_OK, new Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId));
        finish();
    }

    private JSONObject find(String id) {
        for (JSONObject w : all) if (id.equals(w.optString("id"))) return w;
        return null;
    }

    private class Adapter extends BaseAdapter {
        @Override public int getCount() { return shown.size(); }
        @Override public Object getItem(int i) { return shown.get(i); }
        @Override public long getItemId(int i) { return i; }

        @Override
        public View getView(int i, View convert, ViewGroup parent) {
            View v = convert != null ? convert : getLayoutInflater().inflate(R.layout.widget_config_row, parent, false);
            JSONObject w = shown.get(i);
            int order = picked.indexOf(w.optString("id"));
            boolean on = order >= 0;

            v.setBackgroundResource(on ? R.drawable.cfg_row_on : R.drawable.cfg_row);
            TextView badge = v.findViewById(R.id.row_badge);
            badge.setBackgroundResource(on ? R.drawable.cfg_badge_on : R.drawable.cfg_badge_off);
            badge.setText(on ? String.valueOf(order + 1) : "");

            ((TextView) v.findViewById(R.id.row_name)).setText(w.optString("name"));
            boolean active = w.optBoolean("active");
            String trig = N8nClient.triggerLabel(w);
            ((TextView) v.findViewById(R.id.row_meta)).setText((trig.isEmpty() ? "" : trig + " · ") + (active ? "Active" : "Inactive"));
            ((ImageView) v.findViewById(R.id.row_dot)).setImageResource(active ? R.drawable.widget_dot_ok : R.drawable.widget_dot_idle);
            return v;
        }
    }
}
