import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState as getMultiFileAuthState,
  WASocket,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import qrcode from 'qrcode';

export interface LogEntry {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  details?: string;
}

export class WhatsAppBot {
  public sock: WASocket | null = null;
  public status: 'idle' | 'connecting' | 'qrcode' | 'connected' | 'error' | 'disconnected' = 'idle';
  public qrCodeRaw: string | null = null;
  public qrCodeDataUrl: string | null = null;
  public user: any = null;
  public error: string | null = null;
  public logs: LogEntry[] = [];
  public apiKey: string = '';
  public outgoingWebhookUrl: string = '';
  public outgoingWebhookEnabled: boolean = false;
  private isInitializing: boolean = false;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.apiKey = this.getOrCreateApiKey();
    this.loadConfig();
    this.addLog('info', 'WhatsApp Bot Manager initialized.');
  }

  private getOrCreateApiKey(): string {
    const configPath = path.join(process.cwd(), 'data', 'config.json');
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (err) {
        // ignore
      }
    }

    if (fs.existsSync(configPath)) {
      try {
        const fileContent = fs.readFileSync(configPath, 'utf8');
        if (fileContent && fileContent.trim()) {
          const data = JSON.parse(fileContent);
          if (data && data.apiKey) {
            return data.apiKey;
          }
        }
      } catch (e) {
        // ignore and recreate
      }
    }

    const newKey = 'wa_key_' + crypto.randomBytes(16).toString('hex');
    try {
      fs.writeFileSync(configPath, JSON.stringify({ apiKey: newKey }, null, 2), 'utf8');
    } catch (err) {
      // ignore
    }
    return newKey;
  }

  public regenerateApiKey(): string {
    const newKey = 'wa_key_' + crypto.randomBytes(16).toString('hex');
    const configPath = path.join(process.cwd(), 'data', 'config.json');
    
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (err) {
        // ignore
      }
    }

    try {
      const configData = {
        apiKey: newKey,
        outgoingWebhookUrl: this.outgoingWebhookUrl,
        outgoingWebhookEnabled: this.outgoingWebhookEnabled,
      };
      fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), 'utf8');
    } catch (err) {
      // ignore
    }
    this.apiKey = newKey;
    this.addLog('info', 'Secure API Key has been regenerated.');
    return newKey;
  }

  private loadConfig() {
    try {
      const configPath = path.join(process.cwd(), 'data', 'config.json');
      if (fs.existsSync(configPath)) {
        const fileContent = fs.readFileSync(configPath, 'utf8');
        if (fileContent && fileContent.trim()) {
          const data = JSON.parse(fileContent);
          if (data) {
            this.outgoingWebhookUrl = data.outgoingWebhookUrl || '';
            this.outgoingWebhookEnabled = data.outgoingWebhookEnabled !== undefined ? !!data.outgoingWebhookEnabled : false;
            if (data.apiKey) {
              this.apiKey = data.apiKey;
            }
          }
        }
      }
    } catch (err) {
      this.addLog('error', `Failed to load configuration: ${(err as Error).message}`);
    }
  }

  public saveConfig() {
    try {
      const configPath = path.join(process.cwd(), 'data', 'config.json');
      const dir = path.dirname(configPath);
      if (!fs.existsSync(dir)) {
        try {
          fs.mkdirSync(dir, { recursive: true });
        } catch (err) {
          // ignore
        }
      }
      const configData = {
        apiKey: this.apiKey,
        outgoingWebhookUrl: this.outgoingWebhookUrl,
        outgoingWebhookEnabled: this.outgoingWebhookEnabled,
      };
      fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), 'utf8');
    } catch (err) {
      this.addLog('error', `Failed to save configuration: ${(err as Error).message}`);
    }
  }

  public addLog(type: 'info' | 'success' | 'warning' | 'error', message: string, details?: string) {
    const log: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type,
      message,
      details,
    };
    this.logs.unshift(log);
    // Limit logs list to last 100 entries
    if (this.logs.length > 100) {
      this.logs.pop();
    }
  }

  public async init() {
    this.loadConfig();

    if (this.isInitializing) {
      this.addLog('info', 'Initialization is already in progress...');
      return;
    }

    this.isInitializing = true;
    this.status = 'connecting';
    this.error = null;
    this.addLog('info', 'Starting WhatsApp connection flow...');

    // Clear any previous reconnection timers
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    try {
      const authDir = path.join(process.cwd(), 'data', 'whatsapp-auth');
      if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
      }

      const { state, saveCreds } = await getMultiFileAuthState(authDir);

      // Clean up previous socket if it exists
      if (this.sock) {
        try {
          this.sock.end(undefined);
        } catch (e) {
          // ignore
        }
        this.sock = null;
      }

      this.sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
      });

      this.sock.ev.on('creds.update', saveCreds);

      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.qrCodeRaw = qr;
          try {
            this.qrCodeDataUrl = await qrcode.toDataURL(qr);
            this.status = 'qrcode';
            this.addLog('info', 'A new authentication QR Code has been generated.');
          } catch (err) {
            this.addLog('error', 'Failed to generate QR Code image.', (err as Error).message);
          }
        }

        if (connection === 'connecting') {
          this.status = 'connecting';
          this.addLog('info', 'Connecting to WhatsApp servers...');
        }

        if (connection === 'open') {
          this.status = 'connected';
          this.qrCodeRaw = null;
          this.qrCodeDataUrl = null;
          this.user = this.sock?.user || null;
          this.addLog('success', `WhatsApp connected successfully! Authenticated as JID: ${this.user?.id || 'unknown'}`);
        }

        if (connection === 'close') {
          const error = lastDisconnect?.error;
          const statusCode = (error as any)?.output?.statusCode || (error as any)?.statusCode;
          
          this.addLog('warning', `WhatsApp connection closed. Status Code: ${statusCode || 'unknown'}. Error: ${error?.message || 'none'}`);
          
          if (statusCode === DisconnectReason.loggedOut) {
            this.addLog('error', 'Logged out from WhatsApp. Resetting session data...');
            await this.logout();
          } else {
            this.status = 'disconnected';
            this.addLog('info', 'Scheduling automatic reconnection...');
            this.scheduleReconnect();
          }
        }
      });

      this.sock.ev.on('messages.upsert', async (m) => {
        try {
          const { messages, type } = m;
          if (type !== 'notify') return;

          for (const msg of messages) {
            // Forward only incoming messages
            if (msg.key.fromMe) continue;

            const from = msg.key.remoteJid || '';
            const pushName = msg.pushName || '';
            const messageId = msg.key.id || '';
            const timestamp = msg.messageTimestamp 
              ? new Date((typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp : parseInt(msg.messageTimestamp as any)) * 1000).toISOString() 
              : new Date().toISOString();

            // Extract text message safely
            let text = '';
            if (msg.message) {
              text = msg.message.conversation || 
                     msg.message.extendedTextMessage?.text || 
                     msg.message.imageMessage?.caption || 
                     msg.message.videoMessage?.caption || 
                     '';
            }

            // Skip empty text or status messages
            if (!text && !msg.message?.imageMessage && !msg.message?.videoMessage) {
              continue;
            }

            this.addLog('info', `Received WhatsApp message from ${pushName || from}: "${text || '[Media]'}"`);

            if (this.outgoingWebhookUrl && this.outgoingWebhookEnabled) {
              this.addLog('info', `Forwarding message ${messageId} to external Webhook...`);
              
              fetch(this.outgoingWebhookUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  event: 'message.received',
                  from: from.split('@')[0],
                  jid: from,
                  name: pushName,
                  messageId,
                  timestamp,
                  text,
                  messageType: Object.keys(msg.message || {})[0] || 'unknown',
                  raw: msg,
                }),
              })
              .then(async (res) => {
                if (res.ok) {
                  this.addLog('success', `Message ${messageId} successfully forwarded to Webhook!`);
                } else {
                  this.addLog('warning', `Webhook server returned error status: ${res.status} ${res.statusText}`);
                }
              })
              .catch((err) => {
                this.addLog('error', `Failed to send webhook HTTP POST: ${(err as Error).message}`);
              });
            }
          }
        } catch (err) {
          this.addLog('error', `Error in messages.upsert handler: ${(err as Error).message}`);
        }
      });

    } catch (err) {
      this.status = 'error';
      this.error = (err as Error).message;
      this.addLog('error', `Initialization error: ${(err as Error).message}`);
      this.scheduleReconnect();
    } finally {
      this.isInitializing = false;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    this.reconnectTimer = setTimeout(() => {
      this.addLog('info', 'Attempting automatic reconnection now...');
      this.init();
    }, 8000);
  }

  public async logout() {
    this.status = 'disconnected';
    this.user = null;
    this.qrCodeRaw = null;
    this.qrCodeDataUrl = null;

    if (this.sock) {
      try {
        this.sock.end(undefined);
      } catch (e) {
        // ignore
      }
      this.sock = null;
    }

    try {
      const authDir = path.join(process.cwd(), 'data', 'whatsapp-auth');
      if (fs.existsSync(authDir)) {
        fs.rmSync(authDir, { recursive: true, force: true });
        this.addLog('info', 'Authentication folder deleted successfully.');
      }
    } catch (err) {
      this.addLog('error', 'Failed to delete authentication folder.', (err as Error).message);
    }

    this.addLog('info', 'Session cleared. Ready to generate a new QR Code.');
    this.init();
  }

  public async sendMessage(to: string, text: string) {
    if (this.status !== 'connected' || !this.sock) {
      this.addLog('error', `Failed to send message to ${to}: Bot is not connected.`);
      throw new Error('WhatsApp bot is not connected. Please connect via QR code first.');
    }

    // Process destination JID
    let targetJid = to.trim();
    if (!targetJid.includes('@')) {
      // Clean up number
      const digits = targetJid.replace(/[^0-9]/g, '');
      if (!digits) {
        throw new Error('Invalid phone number format. Must contain digits only.');
      }
      targetJid = `${digits}@s.whatsapp.net`;
    }

    this.addLog('info', `Attempting to send message to ${targetJid}`);

    try {
      const result = await this.sock.sendMessage(targetJid, { text });
      this.addLog('success', `Message successfully sent to ${targetJid}`, JSON.stringify(result));
      return result;
    } catch (err) {
      this.addLog('error', `Failed to send message to ${targetJid}: ${(err as Error).message}`);
      throw err;
    }
  }
}

declare global {
  var whatsappBot: WhatsAppBot | undefined;
}

export function getWhatsAppBot(): WhatsAppBot {
  if (!globalThis.whatsappBot) {
    globalThis.whatsappBot = new WhatsAppBot();
    globalThis.whatsappBot.init();
  }
  return globalThis.whatsappBot;
}
