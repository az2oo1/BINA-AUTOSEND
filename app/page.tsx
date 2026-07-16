'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  QrCode,
  Globe,
  Wifi,
  WifiOff,
  Copy,
  Check,
  RefreshCw,
  Trash2,
  LogOut,
  Key,
  Send,
  Code,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Info,
  XCircle,
  HelpCircle,
  Clock,
} from 'lucide-react';

interface LogEntry {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  details?: string;
}

interface BotStatus {
  status: 'idle' | 'connecting' | 'qrcode' | 'connected' | 'error' | 'disconnected';
  qrCodeDataUrl: string | null;
  user: { id: string; name?: string } | null;
  error: string | null;
  apiKey: string;
  logs: LogEntry[];
  webhookUrl: string;
  outgoingWebhookUrl: string;
  outgoingWebhookEnabled: boolean;
}

export default function Home() {
  const [data, setData] = useState<BotStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [pollingActive, setPollingActive] = useState<boolean>(true);
  
  // Clipboard states
  const [copiedKey, setCopiedKey] = useState<boolean>(false);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  // Test send form states
  const [targetNumber, setTargetNumber] = useState<string>('');
  const [messageText, setMessageText] = useState<string>('Hello! This is a secure test message from my WhatsApp Webhook Gateway. 🚀');
  const [sendingTest, setSendingTest] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; details?: any } | null>(null);

  // Filter logs state
  const [logFilter, setLogFilter] = useState<'all' | 'info' | 'success' | 'warning' | 'error'>('all');
  
  // API code snippet tabs
  const [activeTab, setActiveTab] = useState<'curl' | 'js' | 'python'>('curl');
  
  // Reveal API key state
  const [revealApiKey, setRevealApiKey] = useState<boolean>(false);

  // Action loading states
  const [performingAction, setPerformingAction] = useState<string | null>(null);

  // Outgoing Webhook states
  const [outgoingWebhookUrl, setOutgoingWebhookUrl] = useState<string>('');
  const [outgoingWebhookEnabled, setOutgoingWebhookEnabled] = useState<boolean>(false);
  const [savingConfig, setSavingConfig] = useState<boolean>(false);
  const [configSuccess, setConfigSuccess] = useState<string | null>(null);
  const [hasInitializedInputs, setHasInitializedInputs] = useState<boolean>(false);

  // Sync once when data first loads, asynchronously to avoid synchronous cascading render linter warning
  useEffect(() => {
    if (data && !hasInitializedInputs) {
      const url = data.outgoingWebhookUrl || '';
      const enabled = !!data.outgoingWebhookEnabled;
      
      setTimeout(() => {
        setOutgoingWebhookUrl(url);
        setOutgoingWebhookEnabled(enabled);
        setHasInitializedInputs(true);
      }, 0);
    }
  }, [data, hasInitializedInputs]);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    setConfigSuccess(null);

    try {
      const res = await fetch('/api/whatsapp/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_config',
          outgoingWebhookUrl: outgoingWebhookUrl.trim(),
          outgoingWebhookEnabled,
        }),
      });

      if (res.ok) {
        setConfigSuccess('Webhook settings saved successfully!');
        // Refresh status instantly
        const refreshRes = await fetch('/api/whatsapp/status');
        if (refreshRes.ok) {
          const json = await refreshRes.json();
          setData(json);
        }
        setTimeout(() => setConfigSuccess(null), 3000);
      } else {
        const errJson = await res.json();
        setConfigSuccess(`Error: ${errJson.error || 'Failed to save webhook settings'}`);
      }
    } catch (err) {
      setConfigSuccess('An unexpected error occurred while saving.');
    } finally {
      setSavingConfig(false);
    }
  };

  // Main polling logic
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/whatsapp/status');
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.error('Failed to poll status', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus(); // immediate call

    if (pollingActive) {
      intervalId = setInterval(fetchStatus, 2000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [pollingActive]);

  const triggerAction = async (action: 'reconnect' | 'logout' | 'regenerate_key') => {
    setPerformingAction(action);
    try {
      const res = await fetch('/api/whatsapp/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      
      // Instantly refresh data
      const refreshRes = await fetch('/api/whatsapp/status');
      if (refreshRes.ok) {
        const refreshJson = await refreshRes.json();
        setData(refreshJson);
      }
    } catch (err) {
      console.error(`Action ${action} failed`, err);
    } finally {
      setPerformingAction(null);
    }
  };

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetNumber.trim()) return;

    setSendingTest(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/whatsapp/test-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: targetNumber.trim(),
          text: messageText,
        }),
      });
      const result = await res.json();
      if (res.ok) {
        setTestResult({ success: true, message: 'Message queued and dispatched!' });
      } else {
        setTestResult({ success: false, message: result.error || 'Failed to dispatch test message' });
      }
    } catch (err) {
      setTestResult({ success: false, message: 'An unexpected request error occurred.' });
    } finally {
      setSendingTest(false);
    }
  };

  const copyToClipboard = (text: string, type: 'key' | 'url' | 'snippet') => {
    navigator.clipboard.writeText(text);
    if (type === 'key') {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } else if (type === 'url') {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } else {
      setCopiedSnippet(text);
      setTimeout(() => setCopiedSnippet(null), 2000);
    }
  };

  const clearTestResult = () => {
    setTestResult(null);
  };

  // Process logs filter
  const filteredLogs = data?.logs.filter((log) => {
    if (logFilter === 'all') return true;
    return log.type === logFilter;
  }) || [];

  // Generate dynamic snippets based on live credentials
  const webhookUrl = data?.webhookUrl || 'https://YOUR-APP-URL/api/webhook';
  const apiKey = data?.apiKey || 'wa_key_xxxxxxxxxxxxxxxxxxxxxxxx';

  const snippets = {
    curl: `curl -X POST "${webhookUrl}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -d '{
    "to": "1234567890",
    "message": "Hello! This is a secure notification sent via the WhatsApp Webhook Gateway. 🚀"
  }'`,
    js: `fetch("${webhookUrl}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer ${apiKey}"
  },
  body: JSON.stringify({
    to: "1234567890",
    message: "Hello! This is a secure notification sent via the WhatsApp Webhook Gateway. 🚀"
  })
})
.then(res => res.json())
.then(data => console.log("Success:", data))
.catch(err => console.error("Error:", err));`,
    python: `import requests

url = "${webhookUrl}"
headers = {
    "Authorization": "Bearer ${apiKey}",
    "Content-Type": "application/json"
}
payload = {
    "to": "1234567890",
    "message": "Hello! This is a secure notification sent via the WhatsApp Webhook Gateway. 🚀"
}

response = requests.post(url, json=payload, headers=headers)
print(response.status_code)
print(response.json())`,
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8" id="root-container">
      {/* Upper header */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-zinc-800/80 pb-6 gap-4" id="app-header">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-bold tracking-widest uppercase text-emerald-400 font-mono">
              Live Gateway Active
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent sm:text-4xl">
            WhatsApp Webhook Gateway
          </h1>
          <p className="mt-2 text-sm text-zinc-400 max-w-2xl leading-relaxed">
            Turn your personal WhatsApp app into an automated, authenticated notification microservice. Securely integrate instant alerts using standard REST payloads.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-center">
          <button
            onClick={() => setPollingActive(!pollingActive)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-300 flex items-center gap-1.5 ${
              pollingActive
                ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800/80 hover:text-white'
                : 'bg-emerald-950/20 border-emerald-900/50 text-emerald-400 hover:bg-emerald-900/30'
            }`}
            id="toggle-polling-btn"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${pollingActive ? 'animate-spin' : ''}`} />
            {pollingActive ? 'Polling Live' : 'Polling Paused'}
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4" id="loading-fallback">
          <div className="h-10 w-10 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
          <p className="text-zinc-400 font-mono text-xs tracking-wider uppercase">Synchronizing gateway system state...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="dashboard-grid">
          {/* LEFT PANEL - WhatsApp Auth/QR Status (5 Cols) */}
          <section className="lg:col-span-5 space-y-6" id="left-column">
            <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-md" id="status-card">
              {/* Header */}
              <div className="p-4 bg-zinc-950/40 border-b border-zinc-800/80 flex items-center justify-between">
                <span className="text-[11px] font-bold tracking-wider uppercase text-zinc-400 font-mono">
                  WhatsApp Connection Status
                </span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide font-mono ${
                  data?.status === 'connected'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : data?.status === 'qrcode'
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                }`}>
                  {data?.status === 'connected' ? 'Connected' : data?.status === 'qrcode' ? 'Scan Required' : 'Standby'}
                </span>
              </div>

              {/* Card Body */}
              <div className="p-6">
                <div className="space-y-6">
                  {/* 1. If QR-CODE is generated */}
                  {data?.status === 'qrcode' && (
                    <div className="flex flex-col items-center text-center space-y-4" id="qr-container">
                      <div className="p-4 bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] relative group transition-all duration-300 hover:shadow-[0_8px_35px_rgba(16,185,129,0.12)]">
                        {data.qrCodeDataUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={data.qrCodeDataUrl}
                            alt="WhatsApp Scan QR"
                            className="w-48 h-48 block"
                            id="qr-image"
                          />
                        ) : (
                          <div className="w-48 h-48 flex items-center justify-center bg-zinc-50 text-zinc-800 font-mono text-xs p-4 rounded-xl">
                            Generating QR Canvas...
                          </div>
                        )}
                      </div>
                      <div className="space-y-3 w-full">
                        <h3 className="text-sm font-semibold text-white flex items-center justify-center gap-1.5">
                          <QrCode className="h-4 w-4 text-emerald-400" />
                          Link WhatsApp Account
                        </h3>
                        <ol className="text-xs text-zinc-400 space-y-2 text-left list-decimal list-inside pl-1 bg-zinc-950/40 p-4 rounded-xl border border-zinc-800/60 leading-relaxed">
                          <li>Open <strong className="text-zinc-200">WhatsApp</strong> on your phone.</li>
                          <li>Tap <strong className="text-zinc-200">Menu</strong> or <strong className="text-zinc-200">Settings</strong>.</li>
                          <li>Select <strong className="text-zinc-200">Linked Devices</strong>.</li>
                          <li>Tap <strong className="text-zinc-200">Link a Device</strong> and scan this code.</li>
                        </ol>
                      </div>
                    </div>
                  )}

                  {/* 2. If already CONNECTED */}
                  {data?.status === 'connected' && (
                    <div className="space-y-4" id="connected-container">
                      <div className="bg-emerald-950/5 border border-emerald-900/20 rounded-xl p-4 flex items-start gap-3.5">
                        <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400">
                          <CheckCircle2 className="h-5.5 w-5.5" />
                        </div>
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider font-mono">Authenticated JID</h3>
                          <p className="text-xs text-zinc-300 font-mono break-all bg-zinc-950/80 py-1.5 px-2.5 rounded-lg border border-zinc-800/60">
                            {data.user?.id || 'unknown'}
                          </p>
                          {data.user?.name && (
                            <p className="text-xs text-zinc-400">
                              Push Name: <span className="text-zinc-200 font-semibold">{data.user.name}</span>
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="bg-zinc-950/30 border border-zinc-800/60 rounded-xl p-4 space-y-2.5">
                        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest font-mono">Service Details</h4>
                        <ul className="text-xs space-y-2 text-zinc-400">
                          <li className="flex justify-between border-b border-zinc-900/50 pb-1.5"><span className="text-zinc-500">Node Process:</span> <span className="font-mono text-zinc-300">Active</span></li>
                          <li className="flex justify-between border-b border-zinc-900/50 pb-1.5"><span className="text-zinc-500">Auto-Reconnect:</span> <span className="font-mono text-emerald-400">On</span></li>
                          <li className="flex justify-between"><span className="text-zinc-500">Protocol:</span> <span className="font-mono text-zinc-300">Multi-Device Socket</span></li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* 3. If CONNECTING */}
                  {data?.status === 'connecting' && (
                    <div className="flex flex-col items-center justify-center py-10 gap-3" id="connecting-spinner">
                      <RefreshCw className="h-8 w-8 text-emerald-500 animate-spin" />
                      <p className="text-xs text-zinc-400 font-mono">Establishing server handshakes...</p>
                    </div>
                  )}

                  {/* 4. If IDLE or DISCONNECTED / ERROR */}
                  {(data?.status === 'idle' || data?.status === 'disconnected' || data?.status === 'error') && (
                    <div className="text-center py-6 space-y-4" id="idle-reconnect-card">
                      <div className="p-3 bg-zinc-950/80 rounded-full inline-block text-zinc-400 border border-zinc-800 mb-1">
                        <AlertTriangle className="h-6 w-6 text-amber-500" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-zinc-200">Gateway Standby</h3>
                        <p className="text-xs text-zinc-400 max-w-xs mx-auto mt-1 leading-relaxed">
                          The connection is currently resting or encountered an issue. Click below to start the WhatsApp socket client.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Control Panel Actions */}
                  <div className="pt-4 border-t border-zinc-800/80 grid grid-cols-2 gap-3" id="quick-actions">
                    <button
                      disabled={performingAction !== null}
                      onClick={() => triggerAction('reconnect')}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 bg-zinc-800/60 hover:bg-zinc-700 text-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-xs font-semibold border border-zinc-700 hover:border-zinc-600 transition-all duration-300"
                      id="reconnect-action-btn"
                    >
                      <RefreshCw className={`h-3 w-3 ${performingAction === 'reconnect' ? 'animate-spin' : ''}`} />
                      {performingAction === 'reconnect' ? 'Retrying...' : 'Reconnect'}
                    </button>

                    <button
                      disabled={performingAction !== null}
                      onClick={() => triggerAction('logout')}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-950/10 hover:bg-rose-950/25 text-rose-400 border border-rose-900/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-xs font-semibold transition-all duration-300"
                      id="reset-session-action-btn"
                    >
                      <LogOut className="h-3 w-3" />
                      Reset Session
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Outgoing Webhook (Forwarding) Card */}
            <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-6 space-y-5 shadow-2xl backdrop-blur-md" id="outgoing-webhook-card">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Globe className="h-4 w-4 text-emerald-400" />
                  Outgoing Webhook (Forwarder)
                </h2>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={outgoingWebhookEnabled}
                    onChange={(e) => setOutgoingWebhookEnabled(e.target.checked)}
                    className="sr-only peer"
                    id="outgoing-webhook-enabled-toggle"
                  />
                  <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-300 after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 peer-checked:after:bg-white"></div>
                </label>
              </div>

              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Forward incoming messages received on your WhatsApp account to an external HTTP Webhook URL (e.g. Zapier, Make, or a custom backend) as instant POST payloads.
              </p>

              <form onSubmit={handleSaveConfig} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">
                    Webhook Target URL (HTTP POST)
                  </label>
                  <input
                    type="url"
                    required={outgoingWebhookEnabled}
                    value={outgoingWebhookUrl}
                    onChange={(e) => setOutgoingWebhookUrl(e.target.value)}
                    placeholder="https://your-server.com/webhook"
                    className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-600 text-xs font-mono focus:outline-none focus:border-zinc-700"
                    id="outgoing-webhook-url-input"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingConfig}
                  className="w-full py-2.5 px-4 bg-zinc-200 hover:bg-white text-zinc-950 font-bold text-xs rounded-xl transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm"
                  id="save-webhook-settings-btn"
                >
                  {savingConfig ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Saving Settings...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Save Webhook Settings
                    </>
                  )}
                </button>

                {configSuccess && (
                  <div className={`p-3 rounded-lg text-xs font-mono text-center ${
                    configSuccess.startsWith('Error')
                      ? 'bg-rose-950/20 border border-rose-900/30 text-rose-400'
                      : 'bg-emerald-950/20 border border-emerald-900/30 text-emerald-400'
                  }`}>
                    {configSuccess}
                  </div>
                )}
              </form>
            </div>

            {/* Quick Guide */}
            <div className="bg-zinc-900/20 border border-zinc-800/60 rounded-2xl p-5 space-y-4" id="quick-guide">
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 font-mono flex items-center gap-1.5">
                <HelpCircle className="h-3.5 w-3.5 text-zinc-400" />
                Integration Instructions
              </h3>
              <ul className="text-xs text-zinc-400 space-y-3">
                <li className="flex items-start gap-2.5">
                  <span className="text-amber-500 font-bold mt-0.5">•</span>
                  <span>Recipient format must include the country code without leading zeroes or plus signs (e.g. use <code className="bg-zinc-950 px-1.5 py-0.5 rounded font-mono text-zinc-200">15550199</code>, not <code className="bg-zinc-950 px-1.5 py-0.5 rounded font-mono text-zinc-200">+1 (555) 0199</code>).</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-amber-500 font-bold mt-0.5">•</span>
                  <span>Store your secret <strong className="text-zinc-200">API Key</strong> safely. Never disclose it in client-side public bundles.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-amber-500 font-bold mt-0.5">•</span>
                  <span>The gateway can deliver messages to individuals as well as group JIDs directly.</span>
                </li>
              </ul>
            </div>
          </section>

          {/* RIGHT PANEL - Webhook Config & Test Console (7 Cols) */}
          <section className="lg:col-span-7 space-y-6" id="right-column">
            {/* 1. API Credentials Card */}
            <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-6 space-y-5 shadow-2xl backdrop-blur-md" id="credentials-card">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Key className="h-5 w-5 text-amber-500" />
                Secure API Authentication
              </h2>

              <div className="space-y-4">
                {/* Webhook Gateway URL */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-widest font-mono block">
                    Gateway URL (Webhook Target)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={webhookUrl}
                      className="bg-zinc-950 border border-zinc-800 text-zinc-300 font-mono text-xs px-3.5 py-3 rounded-xl flex-1 focus:outline-none focus:border-zinc-700 transition-all duration-300"
                      id="webhook-url-field"
                    />
                    <button
                      onClick={() => copyToClipboard(webhookUrl, 'url')}
                      className="px-4 bg-zinc-800/60 hover:bg-zinc-700 text-zinc-200 rounded-xl flex items-center justify-center border border-zinc-700 hover:border-zinc-600 transition-all duration-300"
                      title="Copy webhook URL"
                      id="copy-url-btn"
                    >
                      {copiedUrl ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* API Key */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-widest font-mono block">
                      Secure API Key (Bearer Authorization)
                    </label>
                    <button
                      onClick={() => setRevealApiKey(!revealApiKey)}
                      className="text-xxs font-mono text-emerald-400 hover:underline"
                      id="toggle-reveal-key-btn"
                    >
                      {revealApiKey ? 'Hide Secret' : 'Reveal Key'}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type={revealApiKey ? 'text' : 'password'}
                      readOnly
                      value={apiKey}
                      className="bg-zinc-950 border border-zinc-800 text-emerald-400 font-mono text-xs px-3.5 py-3 rounded-xl flex-1 tracking-wider focus:outline-none focus:border-zinc-700 transition-all duration-300"
                      id="api-key-field"
                    />
                    <button
                      onClick={() => copyToClipboard(apiKey, 'key')}
                      className="px-4 bg-zinc-800/60 hover:bg-zinc-700 text-zinc-200 rounded-xl flex items-center justify-center border border-zinc-700 hover:border-zinc-600 transition-all duration-300"
                      title="Copy API key"
                      id="copy-key-btn"
                    >
                      {copiedKey ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    disabled={performingAction === 'regenerate_key'}
                    onClick={() => {
                      if (confirm('Are you sure you want to regenerate your API key? This will invalidate your previous key immediately.')) {
                        triggerAction('regenerate_key');
                      }
                    }}
                    className="text-xs font-semibold text-zinc-400 hover:text-white flex items-center gap-1.5 bg-zinc-850/30 hover:bg-zinc-850 py-1.5 px-3 rounded-xl border border-zinc-800/60 transition-all duration-300"
                    id="regenerate-key-btn"
                  >
                    <RefreshCw className={`h-3 w-3 ${performingAction === 'regenerate_key' ? 'animate-spin' : ''}`} />
                    Regenerate Secure Key
                  </button>
                </div>
              </div>
            </div>

            {/* 2. Interactive Testing Console */}
            <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-6 space-y-4 shadow-2xl backdrop-blur-md" id="test-console-card">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Send className="h-5 w-5 text-amber-500" />
                Instant Message Dispatcher
              </h2>

              <form onSubmit={handleSendTest} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-widest font-mono block">
                      Recipient Number
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 15550199"
                      value={targetNumber}
                      onChange={(e) => setTargetNumber(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-zinc-700 transition-all duration-300"
                      id="test-to-field"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-widest font-mono block">
                      Quick Payload Template
                    </label>
                    <select
                      onChange={(e) => {
                        if (e.target.value === 'alert') {
                          setMessageText('⚠️ ALERT: Database replication lag is exceeding threshold (302s). Actions required.');
                        } else if (e.target.value === 'otp') {
                          setMessageText('🔒 Security OTP: Your transaction code is 783109. Valid for 5 minutes.');
                        } else if (e.target.value === 'success') {
                          setMessageText('🎉 SUCCESS: Automated pipeline build #842 compiled successfully in 12.4s.');
                        } else {
                          setMessageText('Hello! This is a secure test message from my WhatsApp Webhook Gateway. 🚀');
                        }
                      }}
                      className="w-full bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs px-3.5 py-3 rounded-xl focus:outline-none focus:border-zinc-700 transition-all duration-300"
                      id="template-selector"
                    >
                      <option value="default">General Notification</option>
                      <option value="alert">System Alert (Warning)</option>
                      <option value="otp">Security Code (OTP)</option>
                      <option value="success">Pipeline Confirmation</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-widest font-mono block">
                    Message Text Body
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-zinc-700 font-sans transition-all duration-300"
                    id="test-message-field"
                  />
                </div>

                <div className="flex items-center justify-between gap-4 pt-1">
                  <div className="flex-1">
                    <AnimatePresence mode="wait">
                      {testResult && (
                        <motion.div
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          className={`text-xs p-2.5 rounded-xl flex items-center justify-between gap-2 border ${
                            testResult.success
                              ? 'bg-emerald-950/10 border-emerald-900/30 text-emerald-400'
                              : 'bg-rose-950/10 border-rose-900/30 text-rose-400'
                          }`}
                          id="test-result-alert"
                        >
                          <div className="flex items-center gap-1.5">
                            {testResult.success ? <Check className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                            <span>{testResult.message}</span>
                          </div>
                          <button
                            type="button"
                            onClick={clearTestResult}
                            className="text-zinc-500 hover:text-zinc-300"
                          >
                            Close
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <button
                    type="submit"
                    disabled={sendingTest || data?.status !== 'connected'}
                    className="flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-850 disabled:text-zinc-600 disabled:border-zinc-800/40 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs shadow-lg shadow-emerald-950/20 hover:shadow-emerald-900/30 transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 border border-emerald-500/20 self-end shrink-0"
                    id="send-test-btn"
                  >
                    <Send className="h-3.5 w-3.5" />
                    {sendingTest ? 'Sending...' : 'Dispatch Message'}
                  </button>
                </div>
              </form>
            </div>

            {/* 3. Developer Integration Snippets */}
            <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-6 space-y-4 shadow-2xl backdrop-blur-md" id="snippets-card">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white flex items-center gap-2 font-mono uppercase tracking-widest">
                  <Code className="h-4 w-4 text-amber-500" />
                  Integration Examples
                </h2>

                <div className="flex bg-zinc-950 rounded-xl p-1 border border-zinc-800/60">
                  {(['curl', 'js', 'python'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-3 py-1.5 rounded-lg text-xxs font-bold uppercase font-mono tracking-wider transition-all duration-300 ${
                        activeTab === tab
                          ? 'bg-zinc-900 text-emerald-400 border border-zinc-800/40'
                          : 'text-zinc-500 hover:text-zinc-200'
                      }`}
                      id={`tab-btn-${tab}`}
                    >
                      {tab === 'js' ? 'Fetch API' : tab}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative">
                <pre className="bg-zinc-950/80 p-5 rounded-2xl border border-zinc-800/60 text-emerald-400/90 font-mono text-xs overflow-x-auto whitespace-pre-wrap max-h-56 shadow-inner">
                  {snippets[activeTab]}
                </pre>
                <button
                  onClick={() => copyToClipboard(snippets[activeTab], 'snippet')}
                  className="absolute top-3.5 right-3.5 p-2 bg-zinc-900/90 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-xl border border-zinc-800/60 transition-all duration-300 backdrop-blur-sm"
                  title="Copy snippet"
                  id="copy-snippet-btn"
                >
                  {copiedSnippet === snippets[activeTab] ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* BOTTOM LOGS PANEL */}
      <section className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-md" id="logs-panel">
        <div className="p-4 bg-zinc-950/40 border-b border-zinc-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            <h2 className="text-xs font-bold uppercase tracking-widest text-white font-mono">
              Live Gateway Logs & Activity Console
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2" id="log-filters">
            {(['all', 'info', 'success', 'warning', 'error'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setLogFilter(type)}
                className={`px-2.5 py-1 rounded-lg text-xxs font-bold uppercase tracking-wider border transition-all duration-300 ${
                  logFilter === type
                    ? type === 'success'
                      ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-400'
                      : type === 'warning'
                      ? 'bg-amber-950/20 border-amber-900/40 text-amber-400'
                      : type === 'error'
                      ? 'bg-rose-950/20 border-rose-900/40 text-rose-400'
                      : type === 'info'
                      ? 'bg-blue-950/20 border-blue-900/40 text-blue-400'
                      : 'bg-zinc-800 border-zinc-700 text-white'
                    : 'bg-transparent border-transparent hover:bg-zinc-900/60 text-zinc-500 hover:text-zinc-300'
                }`}
                id={`filter-log-${type}`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Logs container */}
        <div className="p-4 bg-zinc-950/20 max-h-72 overflow-y-auto font-mono text-xs space-y-1.5 min-h-32" id="logs-list-container">
          {filteredLogs.length === 0 ? (
            <div className="text-zinc-500 text-center py-8">
              No logs matched the selected filter.
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3 py-2 px-3 hover:bg-zinc-900/40 rounded-xl transition-all duration-200"
                id={`log-item-${log.id}`}
              >
                <span className="text-zinc-500 text-[10px] shrink-0 font-mono flex items-center gap-1.5 pt-0.5">
                  <Clock className="h-3.5 w-3.5 text-zinc-600" />
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>

                <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] uppercase font-bold shrink-0 tracking-wider ${
                  log.type === 'success'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : log.type === 'warning'
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : log.type === 'error'
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                }`}>
                  {log.type}
                </span>

                <div className="flex-1 min-w-0">
                  <p className="text-zinc-300 break-words">{log.message}</p>
                  {log.details && (
                    <pre className="mt-1.5 bg-zinc-950/80 text-zinc-500 p-3 rounded-xl border border-zinc-900/60 leading-relaxed font-mono whitespace-pre-wrap break-all text-[10px]">
                      {log.details}
                    </pre>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
