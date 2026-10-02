"use client";

import { useState, useEffect } from "react";
import { 
  Settings, Shield, Server, Coins, Check, X, 
  Save, AlertCircle, RefreshCw, KeyRound, Globe, Mail
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiClient } from "@ethsltd/api-client";

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState("platform");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  const [formData, setFormData] = useState({
    maintenanceMode: false,
    tradingEnabled: true,
    userRegistration: true,
    baseCurrency: "USDT",
    makerFee: "0.1",
    takerFee: "0.2",
    dailyWithdrawalLimit: "50000",
    minDeposit: "10",
    minWithdrawal: "10",
    withdrawalFeeType: "FIXED",
    withdrawalFeeAmount: "0",
    withdrawalFeePercentage: "0",
    depositFeeType: "PERCENTAGE",
    depositFeeAmount: "0",
    depositFeePercentage: "0",
    requireAdmin2FA: true,
    sessionTimeout: "30",
    ipWhitelist: "",
    maxFailedLogins: "5",
    globalApiStatus: true,
    apiRateLimit: "100",
    
    // Notification Settings
    EMAIL_ADMIN: "admin@ethsltd.com",
    EMAIL_SUPPORT: "support@ethsltd.com",
    EMAIL_NOTIFY_NEW_USER: true,
    EMAIL_NOTIFY_DEPOSIT: true,
    EMAIL_NOTIFY_WITHDRAWAL: true,
    EMAIL_NOTIFY_P2P: true,
    EMAIL_NOTIFY_TRADE: true,
    EMAIL_NOTIFY_TRANSFER: true,
  });

  const [bankCurrencies, setBankCurrencies] = useState<any[]>([]);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const ratesRes = await apiClient.getPublicCurrencyRates();
      if (ratesRes.success && ratesRes.list) {
        setBankCurrencies(ratesRes.list.filter((c: any) => c.isBank));
      }

      const res = await apiClient.adminGetPlatformSettings();
      if (res.success && res.data) {
        const newForm = { ...formData };
        res.data.forEach((s: any) => {
          if (s.key === 'BASE_CURRENCY') newForm.baseCurrency = s.value;
          if (s.key === 'MIN_WITHDRAWAL' || s.key === 'DAILY_WITHDRAWAL_LIMIT' || s.key === 'MIN_DEPOSIT') {
            const parsed = parseJsonSafely(s.value);
            if (parsed && typeof parsed.amount !== 'undefined') newForm[s.key === 'MIN_WITHDRAWAL' ? 'minWithdrawal' : s.key === 'DAILY_WITHDRAWAL_LIMIT' ? 'dailyWithdrawalLimit' : 'minDeposit'] = parsed.amount.toString();
            else newForm[s.key === 'MIN_WITHDRAWAL' ? 'minWithdrawal' : s.key === 'DAILY_WITHDRAWAL_LIMIT' ? 'dailyWithdrawalLimit' : 'minDeposit'] = s.value;
          }
          if (s.key === 'WITHDRAWAL_FEE' || s.key === 'DEPOSIT_FEE') {
            const parsed = parseJsonSafely(s.value);
            const prefix = s.key === 'WITHDRAWAL_FEE' ? 'withdrawalFee' : 'depositFee';
            if (parsed) {
              (newForm as any)[`${prefix}Type`] = parsed.type || 'FIXED';
              (newForm as any)[`${prefix}Amount`] = parsed.amount?.toString() || '0';
              (newForm as any)[`${prefix}Percentage`] = parsed.percentage?.toString() || '0';
            }
          }
          if (s.key === 'TRADING_FEE_MAKER') newForm.makerFee = parseJsonSafely(s.value)?.percentage?.toString() || s.value;
          if (s.key === 'TRADING_FEE_TAKER') newForm.takerFee = parseJsonSafely(s.value)?.percentage?.toString() || s.value;
        });
        setFormData(newForm);
      }

      // Load System Settings for Notifications
      const sysRes = await apiClient.adminGetSystemSettings();
      if (sysRes.success && sysRes.data) {
        setFormData(prev => ({
          ...prev,
          EMAIL_ADMIN: sysRes.data.EMAIL_ADMIN || "admin@ethsltd.com",
          EMAIL_SUPPORT: sysRes.data.EMAIL_SUPPORT || "support@ethsltd.com",
          EMAIL_NOTIFY_NEW_USER: sysRes.data.EMAIL_NOTIFY_NEW_USER !== 'false',
          EMAIL_NOTIFY_DEPOSIT: sysRes.data.EMAIL_NOTIFY_DEPOSIT !== 'false',
          EMAIL_NOTIFY_WITHDRAWAL: sysRes.data.EMAIL_NOTIFY_WITHDRAWAL !== 'false',
          EMAIL_NOTIFY_P2P: sysRes.data.EMAIL_NOTIFY_P2P !== 'false',
          EMAIL_NOTIFY_TRADE: sysRes.data.EMAIL_NOTIFY_TRADE !== 'false',
          EMAIL_NOTIFY_TRANSFER: sysRes.data.EMAIL_NOTIFY_TRANSFER !== 'false',
        }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const parseJsonSafely = (str: string) => {
    try { return JSON.parse(str); } catch { return null; }
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaved(false);
    try {
      const updates = [
        apiClient.adminUpdatePlatformSetting('MIN_WITHDRAWAL', { value: JSON.stringify({ amount: parseFloat(formData.minWithdrawal) }) }),
        apiClient.adminUpdatePlatformSetting('DAILY_WITHDRAWAL_LIMIT', { value: JSON.stringify({ amount: parseFloat(formData.dailyWithdrawalLimit) }) }),
        apiClient.adminUpdatePlatformSetting('MIN_DEPOSIT', { value: JSON.stringify({ amount: parseFloat(formData.minDeposit) }) }),
        apiClient.adminUpdatePlatformSetting('WITHDRAWAL_FEE', { value: JSON.stringify({ 
          type: formData.withdrawalFeeType, 
          amount: parseFloat(formData.withdrawalFeeAmount),
          percentage: parseFloat(formData.withdrawalFeePercentage)
        }) }),
        apiClient.adminUpdatePlatformSetting('DEPOSIT_FEE', { value: JSON.stringify({ 
          type: formData.depositFeeType, 
          amount: parseFloat(formData.depositFeeAmount),
          percentage: parseFloat(formData.depositFeePercentage)
        }) }),
        apiClient.adminUpdatePlatformSetting('TRADING_FEE_TAKER', { value: JSON.stringify({ type: 'PERCENTAGE', percentage: parseFloat(formData.takerFee) }) }),
        apiClient.adminUpdateSystemSettings({
          EMAIL_ADMIN: formData.EMAIL_ADMIN,
          EMAIL_SUPPORT: formData.EMAIL_SUPPORT,
          EMAIL_NOTIFY_NEW_USER: formData.EMAIL_NOTIFY_NEW_USER.toString(),
          EMAIL_NOTIFY_DEPOSIT: formData.EMAIL_NOTIFY_DEPOSIT.toString(),
          EMAIL_NOTIFY_WITHDRAWAL: formData.EMAIL_NOTIFY_WITHDRAWAL.toString(),
          EMAIL_NOTIFY_P2P: formData.EMAIL_NOTIFY_P2P.toString(),
          EMAIL_NOTIFY_TRADE: formData.EMAIL_NOTIFY_TRADE.toString(),
          EMAIL_NOTIFY_TRANSFER: formData.EMAIL_NOTIFY_TRANSFER.toString(),
        })
      ];
      await Promise.all(updates);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  // Custom Switch Component
  const CustomSwitch = ({ checked, onChange, label, description }: { checked: boolean, onChange: (c: boolean) => void, label: string, description?: string }) => (
    <div className="flex items-center justify-between py-3 flex-wrap gap-y-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 focus:ring-offset-background ${
          checked ? 'bg-brand-primary' : 'bg-muted'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">System Settings</h1>
          <p className="text-muted-foreground mt-1 text-sm">Manage global platform configurations and rules.</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto">
          {isSaving ? (
            <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
          ) : saved ? (
            <><Check className="w-4 h-4 mr-2 text-green-500" /> Saved</>
          ) : (
            <><Save className="w-4 h-4 mr-2" /> Save Changes</>
          )}
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Navigation Sidebar */}
        <div className="w-full lg:w-64 flex flex-col gap-1 bg-card border border-border p-2 rounded-xl sticky top-24">
          {[
            { id: "platform", label: "Platform", icon: Server },
            { id: "security", label: "Security & Access", icon: Shield },
            { id: "api", label: "API & Webhooks", icon: Globe },
            { id: "notifications", label: "Email Notifications", icon: Mail },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id 
                    ? "bg-brand-primary/10 text-brand-primary" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 w-full space-y-6">
          
          {/* PLATFORM SETTINGS */}
          {activeTab === "platform" && (
            <div className="space-y-6">
              <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                <div className="px-6 py-4 border-b border-border bg-muted/20">
                <h3 className="text-lg font-medium">Platform Controls</h3>
                <p className="text-sm text-muted-foreground">Manage core system availability and behavior.</p>
              </div>
              <div className="p-6 space-y-4 divide-y divide-border">
                
                <CustomSwitch 
                  label="User Registrations" 
                  description="Allow new users to sign up for accounts."
                  checked={formData.userRegistration} 
                  onChange={(c) => handleInputChange('userRegistration', c)} 
                />
                <div className="py-4">
                  <label className="text-sm font-medium block mb-2">Platform Base Currency</label>
                  <select 
                    value={formData.baseCurrency}
                    onChange={(e) => handleInputChange('baseCurrency', e.target.value)}
                    className="w-full sm:w-64 bg-background border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-brand-primary outline-none"
                  >
                    {bankCurrencies.length === 0 && <option value="USDT">USDT - Tether (USD Equivalent)</option>}
                    {bankCurrencies.map(c => (
                      <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Legacy System Maintenance was here. Replaced by dedicated System Maintenance page */}
            </div>
          )}


          {/* SECURITY & ACCESS */}
          {activeTab === "security" && (
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2">
              <div className="px-6 py-4 border-b border-border bg-muted/20">
                <h3 className="text-lg font-medium">Security & Admin Access</h3>
                <p className="text-sm text-muted-foreground">Control authentication requirements and access policies.</p>
              </div>
              <div className="p-6 space-y-4 divide-y divide-border">
                <CustomSwitch 
                  label="Enforce Admin 2FA" 
                  description="Require all administrators to use Two-Factor Authentication."
                  checked={formData.requireAdmin2FA} 
                  onChange={(c) => handleInputChange('requireAdmin2FA', c)} 
                />
                
                <div className="py-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Session Timeout (Minutes)</label>
                    <input 
                      type="number" 
                      value={formData.sessionTimeout}
                      onChange={(e) => handleInputChange('sessionTimeout', e.target.value)}
                      className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-brand-primary outline-none" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Max Failed Login Attempts</label>
                    <input 
                      type="number" 
                      value={formData.maxFailedLogins}
                      onChange={(e) => handleInputChange('maxFailedLogins', e.target.value)}
                      className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-brand-primary outline-none" 
                    />
                  </div>
                </div>

                <div className="py-4 space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-muted-foreground" />
                    Admin IP Whitelist
                  </label>
                  <p className="text-xs text-muted-foreground mb-2">Enter one IP address per line. Leave blank to allow access from anywhere.</p>
                  <textarea 
                    rows={4}
                    value={formData.ipWhitelist}
                    onChange={(e) => handleInputChange('ipWhitelist', e.target.value)}
                    placeholder="e.g. 192.168.1.1&#10;10.0.0.5"
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-brand-primary outline-none font-mono"
                  ></textarea>
                </div>
              </div>
            </div>
          )}

          {/* API & WEBHOOKS */}
          {activeTab === "api" && (
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2">
              <div className="px-6 py-4 border-b border-border bg-muted/20">
                <h3 className="text-lg font-medium">API & Integrations</h3>
                <p className="text-sm text-muted-foreground">Manage public and partner API endpoints.</p>
              </div>
              <div className="p-6 space-y-4 divide-y divide-border">
                <CustomSwitch 
                  label="Global API Access" 
                  description="Enable or disable external API usage completely."
                  checked={formData.globalApiStatus} 
                  onChange={(c) => handleInputChange('globalApiStatus', c)} 
                />
                
                <div className="py-4 space-y-2">
                  <label className="text-sm font-medium">Default Rate Limit (req/min)</label>
                  <input 
                    type="number" 
                    value={formData.apiRateLimit}
                    onChange={(e) => handleInputChange('apiRateLimit', e.target.value)}
                    className="w-full sm:w-64 bg-background border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-brand-primary outline-none" 
                  />
                </div>

                <div className="py-4">
                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 flex gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-medium text-yellow-500">API Documentation Required</h4>
                      <p className="text-xs text-muted-foreground mt-1">Changes to API limits will affect active algorithmic traders. Ensure clients are notified before reducing limits.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* EMAIL NOTIFICATIONS */}
          {activeTab === "notifications" && (
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2">
              <div className="px-6 py-4 border-b border-border bg-muted/20">
                <h3 className="text-lg font-medium">Email Notification Settings</h3>
                <p className="text-sm text-muted-foreground">Manage system email addresses and notification events.</p>
              </div>
              <div className="p-6 space-y-6">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Admin Email Address</label>
                    <p className="text-xs text-muted-foreground">Receives alerts for new users, deposits, and withdrawals.</p>
                    <input 
                      type="email" 
                      value={formData.EMAIL_ADMIN}
                      onChange={(e) => handleInputChange('EMAIL_ADMIN', e.target.value)}
                      className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-brand-primary outline-none" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Support Email Address</label>
                    <p className="text-xs text-muted-foreground">Used as the "Reply-To" address for user-facing emails.</p>
                    <input 
                      type="email" 
                      value={formData.EMAIL_SUPPORT}
                      onChange={(e) => handleInputChange('EMAIL_SUPPORT', e.target.value)}
                      className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-brand-primary outline-none" 
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-border space-y-2">
                  <h4 className="text-sm font-medium mb-4">Admin Alert Events</h4>
                  <div className="space-y-4 divide-y divide-border">
                    <CustomSwitch 
                      label="New User Registrations" 
                      description="Send an email to the Admin when a new user registers."
                      checked={formData.EMAIL_NOTIFY_NEW_USER} 
                      onChange={(c) => handleInputChange('EMAIL_NOTIFY_NEW_USER', c)} 
                    />
                    <CustomSwitch 
                      label="New Deposits" 
                      description="Send an email to the Admin when a new deposit is initiated."
                      checked={formData.EMAIL_NOTIFY_DEPOSIT} 
                      onChange={(c) => handleInputChange('EMAIL_NOTIFY_DEPOSIT', c)} 
                    />
                    <CustomSwitch 
                      label="New Withdrawals" 
                      description="Send an email to the Admin when a user requests a withdrawal."
                      checked={formData.EMAIL_NOTIFY_WITHDRAWAL} 
                      onChange={(c) => handleInputChange('EMAIL_NOTIFY_WITHDRAWAL', c)} 
                    />
                    <CustomSwitch 
                      label="New P2P Orders" 
                      description="Send an email to the Admin when a new P2P order is created or updated."
                      checked={formData.EMAIL_NOTIFY_P2P} 
                      onChange={(c) => handleInputChange('EMAIL_NOTIFY_P2P', c)} 
                    />
                    <CustomSwitch 
                      label="New Spot Trades" 
                      description="Send an email to the Admin when a spot trade is executed."
                      checked={formData.EMAIL_NOTIFY_TRADE} 
                      onChange={(c) => handleInputChange('EMAIL_NOTIFY_TRADE', c)} 
                    />
                    <CustomSwitch 
                      label="Internal Transfers" 
                      description="Send an email to the Admin when a user transfers funds between wallets."
                      checked={formData.EMAIL_NOTIFY_TRANSFER} 
                      onChange={(c) => handleInputChange('EMAIL_NOTIFY_TRANSFER', c)} 
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
