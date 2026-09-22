// gate-prep proxy — a tiny STATELESS localhost forwarder so the browser can
// reach Azure AI Foundry (browsers can't call it directly: CORS).
//
//   browser  --POST /proxy {url,method,headers,body}-->  this exe  -->  Azure
//
// It stores nothing, logs no secrets, binds to 127.0.0.1 only, restricts CORS
// to the configured origin, answers the Private/Local Network Access preflight,
// and only forwards to an allow-listed set of hosts (Azure by default).
//
// Build:   go build -o gate-proxy.exe
// Run:     gate-proxy.exe                 (defaults: :8765, origin *)
//          gate-proxy.exe -port 8765 -origin https://you.github.io
package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type proxyReq struct {
	URL     string            `json:"url"`
	Method  string            `json:"method"`
	Headers map[string]string `json:"headers"`
	Body    json.RawMessage   `json:"body"`
}

type proxyResp struct {
	Status int             `json:"status"`
	Body   json.RawMessage `json:"body"`
}

var (
	port       = flag.String("port", "8765", "port to listen on (localhost only)")
	origin     = flag.String("origin", "*", "allowed CORS origin, e.g. https://you.github.io")
	allowExtra = flag.String("allow", "", "comma-separated extra allowed host suffixes")
)

var defaultAllowed = []string{
	".azure.com", ".microsoft.com", ".openai.azure.com",
	".services.ai.azure.com", ".cognitiveservices.azure.com", ".azure-api.net",
}

func hostAllowed(raw string) bool {
	u, err := url.Parse(raw)
	if err != nil || u.Scheme != "https" {
		return false
	}
	h := strings.ToLower(u.Hostname())
	allowed := append([]string{}, defaultAllowed...)
	if *allowExtra != "" {
		for _, s := range strings.Split(*allowExtra, ",") {
			if s = strings.TrimSpace(s); s != "" {
				allowed = append(allowed, s)
			}
		}
	}
	for _, suf := range allowed {
		if strings.HasSuffix(h, suf) || h == strings.TrimPrefix(suf, ".") {
			return true
		}
	}
	return false
}

func setCORS(w http.ResponseWriter, r *http.Request) {
	o := *origin
	if o == "*" {
		if ro := r.Header.Get("Origin"); ro != "" {
			o = ro // echo the caller's origin
		}
	}
	w.Header().Set("Access-Control-Allow-Origin", o)
	w.Header().Set("Vary", "Origin")
	w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	// Private Network Access preflight opt-in (older Chrome behaviour).
	if r.Header.Get("Access-Control-Request-Private-Network") == "true" {
		w.Header().Set("Access-Control-Allow-Private-Network", "true")
	}
	w.Header().Set("Access-Control-Max-Age", "600")
}

func handleProxy(w http.ResponseWriter, r *http.Request) {
	setCORS(w, r)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "POST only", http.StatusMethodNotAllowed)
		return
	}
	var pr proxyReq
	if err := json.NewDecoder(io.LimitReader(r.Body, 8<<20)).Decode(&pr); err != nil {
		http.Error(w, "bad json: "+err.Error(), http.StatusBadRequest)
		return
	}
	if !hostAllowed(pr.URL) {
		http.Error(w, "target host not allowed (Azure hosts only; use -allow to extend)", http.StatusForbidden)
		return
	}
	method := pr.Method
	if method == "" {
		method = http.MethodPost
	}
	req, err := http.NewRequest(method, pr.URL, bytes.NewReader(pr.Body))
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	for k, v := range pr.Headers {
		req.Header.Set(k, v)
	}
	if req.Header.Get("Content-Type") == "" {
		req.Header.Set("Content-Type", "application/json")
	}

	// Log method + host ONLY — never the key or body.
	u, _ := url.Parse(pr.URL)
	log.Printf("→ %s %s", method, u.Hostname())

	client := &http.Client{Timeout: 120 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, proxyResp{Status: 502, Body: jsonStr(err.Error())})
		return
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 16<<20))

	// Pass the upstream JSON through untouched; wrap plain text as a JSON string.
	var body json.RawMessage
	if json.Valid(raw) {
		body = raw
	} else {
		body = jsonStr(string(raw))
	}
	writeJSON(w, http.StatusOK, proxyResp{Status: resp.StatusCode, Body: body})
}

func jsonStr(s string) json.RawMessage {
	b, _ := json.Marshal(s)
	return b
}

func writeJSON(w http.ResponseWriter, code int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}

func main() {
	flag.Parse()
	mux := http.NewServeMux()
	mux.HandleFunc("/proxy", handleProxy)
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		setCORS(w, r)
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		w.Write([]byte("ok"))
	})
	addr := "127.0.0.1:" + *port // localhost ONLY — never 0.0.0.0
	log.Printf("gate-prep proxy on http://%s  (origin=%s)  — stateless, logs no secrets", addr, *origin)
	log.Fatal(http.ListenAndServe(addr, mux))
}
