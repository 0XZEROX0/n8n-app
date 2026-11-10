package io.github.n8nmobile.app.widget;

import android.webkit.CookieManager;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.json.JSONTokener;

/**
 * Talks to n8n's signed-in API (/rest) for the widget, with the same session as the app:
 * the n8n-auth cookie the app's sign-in stored in Android's cookie jar, plus the app's
 * browser-id header that n8n ties that cookie to.
 */
final class N8nClient {

    /** n8n said the session is no longer valid: sign in again in the app. */
    static final class AuthException extends IOException {
        AuthException() { super("Your n8n session ended. Open n8n Mobile and sign in again."); }
    }

    private static final int TIMEOUT_MS = 15_000;
    // Triggers that wait for an outside event; n8n can't start these on request.
    private static final Pattern LISTENING =
        Pattern.compile("webhook|formTrigger|chatTrigger|errorTrigger|executeWorkflowTrigger|mcpTrigger", Pattern.CASE_INSENSITIVE);

    private final WidgetStore.Session s;

    N8nClient(WidgetStore.Session s) {
        this.s = s;
    }

    private static final class Response {
        int status;
        String body;
    }

    private Response send(String method, String url, String jsonBody, boolean withSession) throws IOException {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        try {
            c.setConnectTimeout(TIMEOUT_MS);
            c.setReadTimeout(TIMEOUT_MS);
            c.setRequestMethod(method);
            c.setInstanceFollowRedirects(true);
            c.setRequestProperty("Accept", "application/json");
            if (s.basic != null && !s.basic.isEmpty()) c.setRequestProperty("Authorization", "Basic " + s.basic);
            if (withSession) {
                c.setRequestProperty("browser-id", s.browserId);
                String cookie = CookieManager.getInstance().getCookie(url);
                if (cookie != null) c.setRequestProperty("Cookie", cookie);
            }
            if (jsonBody != null) {
                byte[] bytes = jsonBody.getBytes(StandardCharsets.UTF_8);
                c.setDoOutput(true);
                c.setRequestProperty("Content-Type", "application/json");
                c.setFixedLengthStreamingMode(bytes.length);
                try (OutputStream out = c.getOutputStream()) { out.write(bytes); }
            }
            Response r = new Response();
            r.status = c.getResponseCode();
            if (withSession) keepCookies(url, c.getHeaderFields());
            InputStream in = r.status >= 400 ? c.getErrorStream() : c.getInputStream();
            r.body = in == null ? "" : readAll(in);
            return r;
        } finally {
            c.disconnect();
        }
    }

    /** n8n renews its session cookie now and then: store it where the app will find it too. */
    private static void keepCookies(String url, Map<String, List<String>> headers) {
        if (headers == null) return;
        boolean any = false;
        for (Map.Entry<String, List<String>> h : headers.entrySet()) {
            if (h.getKey() == null || !h.getKey().equalsIgnoreCase("Set-Cookie")) continue;
            for (String v : h.getValue()) { CookieManager.getInstance().setCookie(url, v); any = true; }
        }
        if (any) CookieManager.getInstance().flush();
    }

    private static String readAll(InputStream in) throws IOException {
        try (InputStream is = in) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            for (int n; (n = is.read(buf)) > 0; ) out.write(buf, 0, n);
            return out.toString("UTF-8");
        }
    }

    /** Calls /rest{path} and returns its "data" (or the whole body when there is none). */
    private Object api(String method, String path, String jsonBody) throws IOException {
        Response r = send(method, s.url + "/rest" + path, jsonBody, true);
        Object body = parse(r.body);
        if (r.status == 401) throw new AuthException();
        if (r.status >= 400) {
            String msg = body instanceof JSONObject ? ((JSONObject) body).optString("message", "") : "";
            throw new IOException(msg.isEmpty() ? "n8n answered HTTP " + r.status : msg);
        }
        if (body instanceof JSONObject && ((JSONObject) body).has("data")) return ((JSONObject) body).opt("data");
        return body;
    }

    private static Object parse(String text) {
        if (text == null || text.trim().isEmpty()) return null;
        try { return new JSONTokener(text).nextValue(); } catch (JSONException e) { return text; }
    }

    private static String enc(String v) {
        try { return URLEncoder.encode(v, "UTF-8"); } catch (Exception e) { return v; }
    }

    // ---------- workflows ----------

    /** All workflows with id, name, active, archived state and their nodes (to know how they start). */
    List<JSONObject> workflows() throws IOException {
        List<JSONObject> out = new ArrayList<>();
        String select = enc("[\"id\",\"name\",\"active\",\"isArchived\",\"updatedAt\",\"nodes\"]");
        for (int skip = 0; ; skip += 100) {
            Object data;
            try {
                data = api("GET", "/workflows?select=" + select + "&skip=" + skip + "&take=100", null);
            } catch (AuthException e) {
                throw e;
            } catch (IOException e) {
                if (skip > 0) throw e;
                data = api("GET", "/workflows", null); // older n8n without "select": one plain list
                addAll(out, data);
                return out;
            }
            int before = out.size();
            addAll(out, data);
            if (out.size() - before < 100) return out;
        }
    }

    private static void addAll(List<JSONObject> out, Object data) {
        if (!(data instanceof JSONArray)) return;
        JSONArray a = (JSONArray) data;
        for (int i = 0; i < a.length(); i++) {
            JSONObject o = a.optJSONObject(i);
            if (o != null) out.add(o);
        }
    }

    /** The newest executions of a workflow, newest first (empty when it never ran). */
    JSONArray recentExecutions(String workflowId, int limit) throws IOException {
        JSONObject filter = new JSONObject();
        try { filter.put("workflowId", workflowId); } catch (JSONException ignored) {}
        Object data = api("GET", "/executions?filter=" + enc(filter.toString()) + "&limit=" + limit, null);
        JSONArray rows = data instanceof JSONObject ? ((JSONObject) data).optJSONArray("results")
            : data instanceof JSONArray ? (JSONArray) data : null;
        return rows != null ? rows : new JSONArray();
    }

    /** success, error, running, waiting, canceled… the same wording the app uses. */
    static String executionStatus(JSONObject e) {
        String st = e.optString("status", "");
        if (!st.isEmpty()) return "crashed".equals(st) ? "error" : st;
        if (e.optBoolean("finished")) return "success";
        return e.isNull("stoppedAt") || e.optString("stoppedAt").isEmpty() ? "running" : "error";
    }

    // ---------- how a workflow starts ----------

    private static boolean isTrigger(JSONObject n) {
        String t = n.optString("type");
        return t.toLowerCase(Locale.ROOT).endsWith("trigger") || t.equals("n8n-nodes-base.webhook") || t.equals("n8n-nodes-base.cron");
    }

    /** First trigger n8n can start on request, like "Execute workflow" in the editor. */
    static JSONObject runnableTrigger(JSONObject wf) {
        JSONArray nodes = wf.optJSONArray("nodes");
        if (nodes == null) return null;
        for (int i = 0; i < nodes.length(); i++) {
            JSONObject n = nodes.optJSONObject(i);
            if (n != null && isTrigger(n) && !n.optBoolean("disabled") && !LISTENING.matcher(n.optString("type")).find()) return n;
        }
        return null;
    }

    static JSONObject webhookNode(JSONObject wf) {
        JSONArray nodes = wf.optJSONArray("nodes");
        if (nodes == null) return null;
        for (int i = 0; i < nodes.length(); i++) {
            JSONObject n = nodes.optJSONObject(i);
            if (n != null && "n8n-nodes-base.webhook".equals(n.optString("type")) && !n.optBoolean("disabled")) return n;
        }
        return null;
    }

    /** What starts the workflow, in a word: Schedule, Webhook, Manual, Form… */
    static String triggerLabel(JSONObject wf) {
        JSONArray nodes = wf.optJSONArray("nodes");
        if (nodes == null) return "";
        for (int i = 0; i < nodes.length(); i++) {
            JSONObject n = nodes.optJSONObject(i);
            if (n == null || !isTrigger(n) || n.optBoolean("disabled")) continue;
            String t = n.optString("type");
            switch (t) {
                case "n8n-nodes-base.webhook": return "Webhook";
                case "n8n-nodes-base.formTrigger": return "Form";
                case "n8n-nodes-base.manualTrigger": return "Manual";
                case "n8n-nodes-base.scheduleTrigger": case "n8n-nodes-base.cron": return "Schedule";
                case "n8n-nodes-base.executeWorkflowTrigger": return "Sub-workflow";
                case "n8n-nodes-base.errorTrigger": return "Error";
                case "@n8n/n8n-nodes-langchain.chatTrigger": return "Chat";
                default:
                    String tail = t.substring(t.lastIndexOf('.') + 1).replaceAll("(?i)trigger$", "");
                    if (tail.isEmpty()) return "Trigger";
                    return Character.toUpperCase(tail.charAt(0)) + tail.substring(1) + " trigger";
            }
        }
        return "";
    }

    /** Whether the widget's play button can start this workflow. */
    static boolean canRun(JSONObject wf) {
        return runnableTrigger(wf) != null || (wf.optBoolean("active") && webhookNode(wf) != null);
    }

    /** Starts a workflow and returns a short message for the toast. */
    String run(String workflowId) throws IOException {
        Object data = api("GET", "/workflows/" + enc(workflowId), null);
        if (!(data instanceof JSONObject)) throw new IOException("n8n did not return the workflow");
        JSONObject wf = (JSONObject) data;
        String name = wf.optString("name", "Workflow");

        JSONObject trigger = runnableTrigger(wf);
        if (trigger != null) {
            JSONObject body = new JSONObject();
            try {
                body.put("workflowData", wf);
                body.put("triggerToStartFrom", new JSONObject().put("name", trigger.optString("name")));
            } catch (JSONException e) { throw new IOException(e.getMessage()); }
            Object r = api("POST", "/workflows/" + enc(workflowId) + "/run", body.toString());
            String id = r instanceof JSONObject ? ((JSONObject) r).optString("executionId", "") : "";
            return "Started " + name + (id.isEmpty() ? "" : " (#" + id + ")");
        }

        JSONObject hook = webhookNode(wf);
        if (hook != null && wf.optBoolean("active")) {
            JSONObject p = hook.optJSONObject("parameters");
            String path = p != null ? p.optString("path", "") : "";
            if (path.isEmpty()) path = hook.optString("webhookId", "");
            path = path.replaceAll("^/+", "");
            String method = p != null ? p.optString("httpMethod", "GET").toUpperCase(Locale.ROOT) : "GET";
            boolean hasBody = !method.equals("GET") && !method.equals("HEAD");
            Response r = send(method, s.url + "/webhook/" + path, hasBody ? "{}" : null, false);
            if (r.status >= 400) throw new IOException("The webhook answered HTTP " + r.status);
            return "Triggered " + name;
        }
        throw new IOException(name + " can only start from its own trigger. Open it in the app to see how.");
    }
}
