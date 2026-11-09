package io.github.n8nmobile.app.widget;

import android.appwidget.AppWidgetManager;
import android.content.Intent;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseAdapter;
import android.widget.Button;
import android.widget.CheckedTextView;
import android.widget.EditText;
import android.widget.ListView;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
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
 * tick the workflows to show. The widget shows them in the order you ticked them.
 */
public class WidgetConfigActivity extends AppCompatActivity {
    private int widgetId = AppWidgetManager.INVALID_APPWIDGET_ID;
    private final List<JSONObject> all = new ArrayList<>();
    private final List<JSONObject> shown = new ArrayList<>();
    private final List<String> picked = new ArrayList<>();
    private String query = "";
    private Adapter adapter;
    private TextView status;
    private Button save;

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
        int pad = root.getPaddingLeft();
        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            Insets b = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.ime());
            v.setPadding(pad + b.left, pad + b.top, pad + b.right, pad + b.bottom);
            return WindowInsetsCompat.CONSUMED;
        });

        status = findViewById(R.id.config_status);
        save = findViewById(R.id.config_save);
        Button cancel = findViewById(R.id.config_cancel);
        cancel.setOnClickListener(v -> finish());
        boolean editing = WidgetStore.isConfigured(this, widgetId);
        save.setText(editing ? "Save" : "Add widget");
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

        WidgetStore.Session session = WidgetStore.session(this);
        if (session == null) {
            showProblem("Open n8n Mobile and sign in first, then add the widget again.");
            return;
        }
        status.setText("Loading your workflows…");
        status.setVisibility(View.VISIBLE);
        save.setEnabled(false);
        new Thread(() -> {
            try {
                List<JSONObject> rows = new N8nClient(session).workflows();
                List<JSONObject> live = new ArrayList<>();
                for (JSONObject w : rows) if (!w.optBoolean("isArchived")) live.add(w);
                Collections.sort(live, (a, b) -> a.optString("name").compareToIgnoreCase(b.optString("name")));
                runOnUiThread(() -> {
                    all.clear();
                    all.addAll(live);
                    status.setVisibility(all.isEmpty() ? View.VISIBLE : View.GONE);
                    status.setText("No workflows on this n8n yet.");
                    filter();
                    updateSave();
                });
            } catch (N8nClient.AuthException e) {
                runOnUiThread(() -> showProblem("Your n8n session ended. Open n8n Mobile, sign in again, then come back here."));
            } catch (Exception e) {
                runOnUiThread(() -> { status.setText("Could not load workflows: " + e.getMessage()); status.setVisibility(View.VISIBLE); });
            }
        }, "n8n-widget-config").start();
    }

    private void showProblem(String text) {
        status.setText(text);
        status.setVisibility(View.VISIBLE);
        save.setEnabled(true);
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
        adapter.notifyDataSetChanged();
    }

    private void updateSave() {
        save.setEnabled(!picked.isEmpty());
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
                        .put("runnable", N8nClient.canRun(wf)));
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
            CheckedTextView v = (CheckedTextView) (convert != null ? convert
                : getLayoutInflater().inflate(android.R.layout.simple_list_item_multiple_choice, parent, false));
            JSONObject w = shown.get(i);
            int order = picked.indexOf(w.optString("id"));
            v.setText((order >= 0 ? (order + 1) + ".  " : "") + w.optString("name"));
            v.setChecked(order >= 0);
            return v;
        }
    }
}
