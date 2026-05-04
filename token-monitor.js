// TOKEN MONITOR v1 — Integración con Maarmapa Bot v7
// Trackea consumo de APIs en tiempo real + logs en R2

const R2_WORKER = 'https://maarmapa-media.mario-25d.workers.dev';

class TokenMonitor {
  constructor() {
    this.services = {
      grok: {
        name: 'Grok (X.AI)',
        key: process.env.GROK_KEY,
        balance: null,
        lastCheck: null,
        sessionTokens: 0,
        emoji: '🎨'
      },
      runway: {
        name: 'Runway ML',
        key: process.env.RUNWAY_KEY,
        balance: null,
        lastCheck: null,
        sessionTokens: 0,
        emoji: '🎬'
      },
      openrouter: {
        name: 'OpenRouter',
        key: process.env.OPENROUTER_KEY,
        balance: null,
        lastCheck: null,
        sessionTokens: 0,
        emoji: '🧠'
      },
      anthropic: {
        name: 'Anthropic (Claude)',
        key: process.env.ANTHROPIC_KEY,
        balance: null,
        lastCheck: null,
        sessionTokens: 0,
        emoji: '🤖'
      }
    };
    
    this.usageLog = [];
  }

  // Track consumo en cada comando
  async trackUsage(service, tokensConsumed, command, success = true) {
    if (!this.services[service]) return;
    
    const entry = {
      timestamp: new Date().toISOString(),
      service,
      tokensConsumed,
      command,
      success,
      remaining: this.services[service].balance
    };
    
    this.usageLog.push(entry);
    this.services[service].sessionTokens += tokensConsumed;
    
    // Guardar en R2 cada 5 logs o al terminar
    if (this.usageLog.length >= 5) {
      await this.flushToR2();
    }
  }

  // Barra de progreso con consumo
  getProgressBar(service) {
    const svc = this.services[service];
    if (!svc || !svc.balance) return null;
    
    // Normalizar balance a 0-100 (asumir 1000 tokens max por defecto)
    const maxTokens = 1000;
    const percent = Math.min(100, (svc.balance / maxTokens) * 100);
    const filled = Math.round(percent / 10);
    
    let status = '✅';
    if (percent < 30) status = '🔴';
    else if (percent < 60) status = '🟡';
    
    return `${svc.emoji} ${svc.name}\n[${'█'.repeat(filled)}${'░'.repeat(10-filled)}] ${Math.round(percent)}% (${svc.balance} tokens) ${status}`;
  }

  // Mostrar estado de todos los servicios
  getFullStatus() {
    let status = '📊 *API TOKEN STATUS*\n\n';
    for (const [key, svc] of Object.entries(this.services)) {
      if (!svc.key) continue;
      const bar = this.getProgressBar(key);
      if (bar) status += bar + '\n\n';
    }
    return status;
  }

  // Guardar logs en R2
  async flushToR2() {
    if (this.usageLog.length === 0) return;
    
    try {
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `token-logs/${timestamp}-${Date.now()}.json`;
      
      const payload = JSON.stringify({
        date: new Date().toISOString(),
        logs: this.usageLog,
        sessionSummary: Object.entries(this.services).reduce((acc, [key, svc]) => {
          acc[key] = {
            tokensUsed: svc.sessionTokens,
            remaining: svc.balance
          };
          return acc;
        }, {})
      });
      
      const res = await fetch(`${R2_WORKER}/${filename}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: payload
      });
      
      if (res.ok) {
        console.log(`✅ Token logs flushed to R2: ${filename}`);
        this.usageLog = [];
      }
    } catch (e) {
      console.error('R2 flush error:', e.message);
    }
  }

  // Obtener balance de cada servicio (requiere endpoints específicos)
  async checkBalances() {
    // Grok (X.AI)
    if (this.services.grok.key) {
      try {
        const res = await fetch('https://api.x.ai/v1/account/balance', {
          headers: { 'Authorization': `Bearer ${this.services.grok.key}` }
        });
        if (res.ok) {
          const data = await res.json();
          this.services.grok.balance = data.balance || data.remaining_credits || 0;
          this.services.grok.lastCheck = new Date().toISOString();
        }
      } catch (e) { console.log('Grok balance check failed'); }
    }

    // Runway (implementar según su API)
    if (this.services.runway.key) {
      try {
        const res = await fetch('https://api.dev.runwayml.com/v1/account', {
          headers: { 'Authorization': `Bearer ${this.services.runway.key}` }
        });
        if (res.ok) {
          const data = await res.json();
          this.services.runway.balance = data.credits || data.balance || 0;
          this.services.runway.lastCheck = new Date().toISOString();
        }
      } catch (e) { console.log('Runway balance check failed'); }
    }

    // OpenRouter (GET /api/v1/auth/key)
    if (this.services.openrouter.key) {
      try {
        const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
          headers: { 'Authorization': `Bearer ${this.services.openrouter.key}` }
        });
        if (res.ok) {
          const data = await res.json();
          this.services.openrouter.balance = data.balance || data.credit_balance || 0;
          this.services.openrouter.lastCheck = new Date().toISOString();
        }
      } catch (e) { console.log('OpenRouter balance check failed'); }
    }

    // Anthropic (GET /v1/account)
    if (this.services.anthropic.key) {
      try {
        const res = await fetch('https://api.anthropic.com/v1/account', {
          headers: { 'x-api-key': this.services.anthropic.key }
        });
        if (res.ok) {
          const data = await res.json();
          this.services.anthropic.balance = data.balance || data.credit_balance || 0;
          this.services.anthropic.lastCheck = new Date().toISOString();
        }
      } catch (e) { console.log('Anthropic balance check failed'); }
    }
  }

  // Salida formateada para mostrar en Telegram durante un comando
  formatCommandStatus(service, tokensUsed, commandName) {
    const svc = this.services[service];
    if (!svc || !svc.balance) return null;
    
    const newBalance = svc.balance - tokensUsed;
    const bar = this.getProgressBar(service);
    
    return `${bar}\n💾 *Comando:* ${commandName}\n📍 *Consumo:* +${tokensUsed} tokens\n📊 *Nuevo saldo:* ${newBalance}`;
  }
}

module.exports = TokenMonitor;
