import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Copy, Download, Key, Server, Shield, CheckCircle2,
  ChevronDown, ChevronUp, Globe, FileCode, RefreshCw,
} from "lucide-react";

interface WhmcsModuleProps {
  whmcsApiSecret: string;
  onSecretChange: (secret: string) => void;
}

export const WhmcsModule = ({ whmcsApiSecret, onSecretChange }: WhmcsModuleProps) => {
  const { toast } = useToast();
  const [hoxtaUrl, setHoxtaUrl] = useState("");
  const [showPhpPreview, setShowPhpPreview] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiat în clipboard!" });
  };

  const generateSecret = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < 48; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    onSecretChange(result);
  };

  const hasConfig = whmcsApiSecret && hoxtaUrl;

  const generatePhpModule = () => {
    const apiUrl = hoxtaUrl
      ? `${hoxtaUrl.replace(/\/$/, "")}/functions/v1/whmcs-provision`
      : "https://YOUR_SUPABASE_URL/functions/v1/whmcs-provision";
    const secret = whmcsApiSecret || "YOUR_WHMCS_API_SECRET";

    return `<?php
/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  Hoxta Firewall Manager — WHMCS Server Module               ║
 * ║  Provisioning: Create / Suspend / Unsuspend / Terminate      ║
 * ║  Auto IP Allocation from WHMCS Dedicated IP                  ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * INSTALARE:
 * 1. Copiază acest fișier în: /path/to/whmcs/modules/servers/hoxta/hoxta.php
 * 2. Creează folder-ul dacă nu există: mkdir -p modules/servers/hoxta
 * 3. În WHMCS Admin → Setup → Products/Services → Servers → Add New
 *    - Name: Hoxta Firewall
 *    - Type: Hoxta (va apărea automat)
 * 4. Configurează produsul cu Module Settings → Hoxta
 */

if (!defined("WHMCS")) die("This file cannot be accessed directly");

/**
 * Module metadata
 */
function hoxta_MetaData() {
    return [
        'DisplayName' => 'Hoxta Firewall Manager',
        'APIVersion' => '1.1',
        'RequiresServer' => true,
    ];
}

/**
 * Server configuration fields
 */
function hoxta_ConfigOptions() {
    return [
        'Max Rules' => [
            'Type' => 'text',
            'Size' => '5',
            'Default' => '20',
            'Description' => 'Numărul maxim de reguli firewall pentru client',
        ],
        'DDoS Protection' => [
            'Type' => 'yesno',
            'Default' => 'no',
            'Description' => 'Activează protecția DDoS premium',
        ],
    ];
}

/**
 * Hoxta API call helper
 */
function hoxta_api_call(\$action, \$params = []) {
    \$apiUrl = '${apiUrl}';
    \$apiSecret = '${secret}';

    \$data = array_merge(['action' => \$action], \$params);

    \$ch = curl_init(\$apiUrl);
    curl_setopt_array(\$ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode(\$data),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'x-whmcs-key: ' . \$apiSecret,
        ],
    ]);

    \$response = curl_exec(\$ch);
    \$httpCode = curl_getinfo(\$ch, CURLINFO_HTTP_CODE);
    \$error = curl_error(\$ch);
    curl_close(\$ch);

    if (\$error) {
        return ['success' => false, 'error' => "cURL Error: \$error"];
    }

    \$result = json_decode(\$response, true);

    if (\$httpCode !== 200 || !isset(\$result['success']) || !\$result['success']) {
        return [
            'success' => false,
            'error' => \$result['error'] ?? "HTTP \$httpCode - Unknown error",
        ];
    }

    return \$result;
}

/**
 * Get client's dedicated IP from WHMCS
 */
function hoxta_get_dedicated_ip(\$params) {
    // Method 1: Dedicated IP from service
    if (!empty(\$params['dedicatedip'])) {
        return \$params['dedicatedip'];
    }

    // Method 2: Custom field named "IP Address" or "Dedicated IP"
    if (!empty(\$params['customfields'])) {
        foreach (\$params['customfields'] as \$field => \$value) {
            if (stripos(\$field, 'ip') !== false && !empty(\$value)) {
                return \$value;
            }
        }
    }

    // Method 3: Assigned IPs
    if (!empty(\$params['assignedips'])) {
        \$ips = explode("\\n", \$params['assignedips']);
        return trim(\$ips[0]);
    }

    return null;
}

/**
 * CREATE ACCOUNT — Called when service is activated
 */
function hoxta_CreateAccount(array \$params) {
    \$email = \$params['clientsdetails']['email'];
    \$firstName = \$params['clientsdetails']['firstname'];
    \$lastName = \$params['clientsdetails']['lastname'];
    \$displayName = trim("\$firstName \$lastName");
    \$password = \$params['password'] ?: bin2hex(random_bytes(12));
    \$maxRules = intval(\$params['configoption1']) ?: 20;
    \$ip = hoxta_get_dedicated_ip(\$params);

    \$result = hoxta_api_call('create_account', [
        'email' => \$email,
        'password' => \$password,
        'display_name' => \$displayName,
        'ip_address' => \$ip,
        'ip_label' => "WHMCS #" . \$params['serviceid'] . " - " . (\$ip ?: 'no IP'),
        'max_rules' => \$maxRules,
    ]);

    if (!\$result['success']) {
        return \$result['error'];
    }

    // Store Hoxta user_id in service custom field for future reference
    try {
        \\WHMCS\\Database\\Capsule::table('tblhosting')
            ->where('id', \$params['serviceid'])
            ->update(['notes' => 'Hoxta User ID: ' . (\$result['user_id'] ?? '')]);
    } catch (\\Exception \$e) {
        // Non-critical
    }

    return 'success';
}

/**
 * SUSPEND ACCOUNT — Called when service is suspended (e.g. non-payment)
 */
function hoxta_SuspendAccount(array \$params) {
    \$email = \$params['clientsdetails']['email'];

    \$result = hoxta_api_call('suspend_account', [
        'email' => \$email,
    ]);

    if (!\$result['success']) {
        return \$result['error'];
    }

    return 'success';
}

/**
 * UNSUSPEND ACCOUNT — Called when service is reactivated
 */
function hoxta_UnsuspendAccount(array \$params) {
    \$email = \$params['clientsdetails']['email'];

    \$result = hoxta_api_call('unsuspend_account', [
        'email' => \$email,
    ]);

    if (!\$result['success']) {
        return \$result['error'];
    }

    return 'success';
}

/**
 * TERMINATE ACCOUNT — Called when service is cancelled/terminated
 */
function hoxta_TerminateAccount(array \$params) {
    \$email = \$params['clientsdetails']['email'];

    \$result = hoxta_api_call('terminate_account', [
        'email' => \$email,
    ]);

    if (!\$result['success']) {
        return \$result['error'];
    }

    return 'success';
}

/**
 * CHANGE PACKAGE — Called when product is upgraded/downgraded
 */
function hoxta_ChangePackage(array \$params) {
    \$email = \$params['clientsdetails']['email'];
    \$maxRules = intval(\$params['configoption1']) ?: 20;

    // For now, just log it. Could update max_rules via API in the future.
    logModuleCall('hoxta', 'ChangePackage', \$params, 'Package change noted', '');

    return 'success';
}

/**
 * CLIENT AREA OUTPUT — Shows "Manage Firewall" link in client area
 */
function hoxta_ClientArea(array \$params) {
    \$panelUrl = '${hoxtaUrl ? hoxtaUrl.replace(/\\/functions.*/, "").replace(/https:\\/\\/[^/]+\\.supabase\\.co/, hoxtaUrl) : "https://YOUR_HOXTA_PANEL_URL"}';

    return '<div style="text-align:center;padding:20px;">
        <p style="margin-bottom:15px;color:#666;">Gestionează regulile de firewall și protecția DDoS din panoul Hoxta.</p>
        <a href="' . \$panelUrl . '" target="_blank" 
           style="display:inline-block;padding:12px 30px;background:linear-gradient(135deg,#00d4ff,#0099cc);
                  color:#fff;text-decoration:none;border-radius:10px;font-weight:bold;font-size:14px;">
            🛡️ Deschide Panou Firewall
        </a>
    </div>';
}

/**
 * ADMIN AREA OUTPUT — Shows status info in admin service view
 */
function hoxta_AdminServicesTabFields(array \$params) {
    \$email = \$params['clientsdetails']['email'];
    \$result = hoxta_api_call('get_status', ['email' => \$email]);

    if (!\$result['success']) {
        return [
            'Hoxta Status' => '<span style="color:red;">❌ ' . (\$result['error'] ?? 'Error') . '</span>',
        ];
    }

    \$status = \$result['status'] === 'active'
        ? '<span style="color:green;">✅ Activ</span>'
        : '<span style="color:orange;">⚠️ Suspendat</span>';

    \$ips = array_map(function(\$ip) { return \$ip['ip_address']; }, \$result['ips'] ?? []);

    return [
        'Hoxta Status' => \$status,
        'Hoxta User ID' => \$result['user_id'] ?? 'N/A',
        'IP-uri alocate' => implode(', ', \$ips) ?: 'Niciun IP',
        'Reguli' => (\$result['rules']['enabled'] ?? 0) . '/' . (\$result['rules']['total'] ?? 0) . ' active',
        'DDoS Protection' => (\$result['ddos_protection'] ?? false) ? '🛡️ Premium' : 'Standard',
    ];
}
`;
  };

  const downloadPhpModule = () => {
    const content = generatePhpModule();
    const blob = new Blob([content], { type: "application/x-php" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hoxta.php";
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "hoxta.php descărcat!" });
  };

  const testConnection = async () => {
    if (!hoxtaUrl || !whmcsApiSecret) {
      toast({ title: "Completează URL-ul și API Secret", variant: "destructive" });
      return;
    }
    setTesting(true);
    setTestResult(null);

    try {
      const apiUrl = `${hoxtaUrl.replace(/\/$/, "")}/functions/v1/whmcs-provision`;
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-whmcs-key": whmcsApiSecret,
        },
        body: JSON.stringify({ action: "get_status", email: "test@nonexistent.com" }),
      });

      if (res.status === 401) {
        setTestResult("❌ API Secret invalid");
      } else if (res.status === 404) {
        setTestResult("✅ Conexiune OK! (user test nu există — normal)");
      } else if (res.status === 500) {
        const data = await res.json().catch(() => ({}));
        setTestResult(`⚠️ Eroare server: ${data.error || "unknown"}`);
      } else {
        setTestResult("✅ Conexiune reușită!");
      }
    } catch (err: any) {
      setTestResult(`❌ Eroare conexiune: ${err.message}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Config */}
      <div className="glass rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
          <Server className="h-5 w-5 text-primary" />
          Configurare WHMCS
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Conectează WHMCS la Hoxta pentru provisionare automată a conturilor de firewall.
        </p>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="text-xs text-muted-foreground mb-1 block">URL API Hoxta (Supabase URL) *</label>
            <Input
              value={hoxtaUrl}
              onChange={e => setHoxtaUrl(e.target.value)}
              placeholder="https://xxxxx.supabase.co"
              className="bg-muted/50 border-border/50 text-sm rounded-xl font-mono"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Pentru self-hosted: https://api.domeniul-tau.com
            </p>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-muted-foreground mb-1 block">WHMCS API Secret *</label>
            <div className="flex gap-2">
              <Input
                value={whmcsApiSecret}
                onChange={e => onSecretChange(e.target.value)}
                placeholder="secret-lung-aleator"
                className="bg-muted/50 border-border/50 text-sm rounded-xl font-mono flex-1"
              />
              <Button size="sm" variant="outline" onClick={generateSecret} className="rounded-xl text-xs shrink-0">
                <Key className="h-3 w-3 mr-1" /> Generează
              </Button>
              <Button size="sm" variant="outline" onClick={() => copy(whmcsApiSecret)} className="rounded-xl text-xs shrink-0" disabled={!whmcsApiSecret}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Acest secret trebuie setat ca variabilă de mediu <code className="text-primary">WHMCS_API_SECRET</code> în backend.
            </p>
          </div>
        </div>

        {hasConfig && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
              <CheckCircle2 className="h-3 w-3 mr-1" /> Configurare completă
            </Badge>
            <Button size="sm" variant="outline" onClick={testConnection} disabled={testing} className="rounded-xl text-xs">
              <RefreshCw className={`h-3 w-3 mr-1 ${testing ? "animate-spin" : ""}`} />
              {testing ? "Se testează..." : "Test conexiune"}
            </Button>
          </div>
        )}

        {testResult && (
          <div className="mt-3 bg-muted/30 rounded-xl p-3 border border-border/50 text-sm">
            {testResult}
          </div>
        )}
      </div>

      {/* Download module */}
      <div className="glass rounded-2xl p-6 border border-primary/20">
        <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
          <FileCode className="h-5 w-5 text-primary" />
          📦 Modul WHMCS (PHP)
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Descarcă modulul PHP și instalează-l în WHMCS. Valorile sunt pre-completate cu configurarea ta.
        </p>

        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
            <p className="text-sm font-semibold text-foreground mb-1">🔧 Funcționalități incluse:</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>✅ Create Account (la activare serviciu)</li>
              <li>✅ Suspend Account (la suspendare)</li>
              <li>✅ Unsuspend Account (la reactivare)</li>
              <li>✅ Terminate Account (la anulare)</li>
              <li>✅ IP dedicat din WHMCS → Hoxta automat</li>
              <li>✅ Buton "Manage Firewall" în Client Area</li>
              <li>✅ Status info în Admin Services Tab</li>
            </ul>
          </div>

          <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
            <p className="text-sm font-semibold text-foreground mb-1">📋 Instalare în WHMCS:</p>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Descarcă <code className="text-primary">hoxta.php</code></li>
              <li>Upload în <code className="text-primary">modules/servers/hoxta/hoxta.php</code></li>
              <li>WHMCS Admin → Setup → Servers → Add New</li>
              <li>Type: <strong>Hoxta</strong></li>
              <li>Configurează produsul cu Module: Hoxta</li>
              <li>Setează "Dedicated IP" pe serviciu</li>
            </ol>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={downloadPhpModule} className="rounded-xl text-xs gradient-btn text-primary-foreground border-0">
            <Download className="h-3 w-3 mr-1" /> Descarcă hoxta.php
          </Button>
          <Button variant="outline" onClick={() => copy(generatePhpModule())} className="rounded-xl text-xs">
            <Copy className="h-3 w-3 mr-1" /> Copiază cod PHP
          </Button>
          <Button
            variant="ghost" size="sm"
            onClick={() => setShowPhpPreview(!showPhpPreview)}
            className="text-xs text-muted-foreground"
          >
            {showPhpPreview ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
            {showPhpPreview ? "Ascunde" : "Previzualizare"} cod
          </Button>
        </div>

        {showPhpPreview && (
          <div className="mt-3 bg-muted/30 rounded-xl p-3 border border-border/50 max-h-96 overflow-auto relative">
            <Button
              variant="ghost" size="icon"
              className="absolute top-2 right-2 h-7 w-7 rounded-lg"
              onClick={() => copy(generatePhpModule())}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap pr-8">
              {generatePhpModule()}
            </pre>
          </div>
        )}
      </div>

      {/* API Reference */}
      <div className="glass rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" />
          API Reference
        </h3>
        <div className="bg-muted/30 rounded-xl p-3 border border-border/50">
          <pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap">{`POST ${hoxtaUrl || "https://YOUR_URL"}/functions/v1/whmcs-provision
Header: x-whmcs-key: ${whmcsApiSecret || "YOUR_SECRET"}
Content-Type: application/json

── Acțiuni disponibile ──

▸ create_account
  { "action": "create_account", "email": "client@email.com", 
    "password": "pass123", "display_name": "Ion Popescu",
    "ip_address": "185.1.2.3", "ip_label": "VPS #123", "max_rules": 20 }

▸ suspend_account
  { "action": "suspend_account", "email": "client@email.com" }

▸ unsuspend_account
  { "action": "unsuspend_account", "email": "client@email.com" }

▸ terminate_account
  { "action": "terminate_account", "email": "client@email.com" }

▸ get_status
  { "action": "get_status", "email": "client@email.com" }

▸ add_ip
  { "action": "add_ip", "email": "client@email.com",
    "ip_address": "185.1.2.4", "ip_label": "Extra IP" }

▸ remove_ip
  { "action": "remove_ip", "email": "client@email.com",
    "ip_address": "185.1.2.4" }`}</pre>
        </div>
      </div>
    </div>
  );
};
