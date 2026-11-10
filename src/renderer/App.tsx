import { useEffect, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  LayoutDashboard,
  WalletCards,
  LockKeyhole,
  Settings2,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Moon,
  Sun,
  ChevronRight,
  Database,
} from "lucide-react";
import { Toaster, toast } from "sonner";

const money = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
export default function App() {
  const [unlocked, setUnlocked] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [configured, setConfigured] = useState(false);
  const [section, setSection] = useState("Overview");
  const [dark, setDark] = useState(true);
  const [summary, setSummary] = useState({ income: 0, expense: 0 });
  const [tx, setTx] = useState<any[]>([]);
  const [vault, setVault] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingTx, setEditingTx] = useState<any>(null);
  const [showVaultAdd, setShowVaultAdd] = useState(false);
  const [selectedVault, setSelectedVault] = useState<any>(null);
  const [editingVault, setEditingVault] = useState<any>(null);
  const [vaultPassword, setVaultPassword] = useState("");
  const [vaultKind, setVaultKind] = useState("account");
  const [vaultFilter, setVaultFilter] = useState("all");
  const [vaultSearch, setVaultSearch] = useState("");
  const [autoLockMinutes, setAutoLockMinutes] = useState(() => Number(localStorage.getItem("saku:auto-lock-minutes") || "15"));
  const [transactionFilter, setTransactionFilter] = useState("all");
  const [budget, setBudget] = useState(0);
  const [savings, setSavings] = useState<any[]>([]);
  const [editingSavings, setEditingSavings] = useState<any>(null);
  const [backupAction, setBackupAction] = useState<"export" | "import" | null>(null);
  const [backupPassword, setBackupPassword] = useState("");
  const [restoreMode, setRestoreMode] = useState<"merge" | "replace">("merge");
  const [backupBusy, setBackupBusy] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; action: () => Promise<void> } | null>(null);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState("");
  const [recoveryPin, setRecoveryPin] = useState("");
  const [changePinOpen, setChangePinOpen] = useState(false);
  const chart = Array.from({ length: 7 }, (_, offset) => { const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - (6 - offset)); const key = date.toISOString().slice(0, 10); const dayTx = tx.filter((item) => String(item.date).slice(0, 10) === key); return { day: date.toLocaleDateString("id-ID", { weekday: "short" }), in: dayTx.filter((item) => item.type === "income").reduce((sum, item) => sum + Number(item.amount), 0), out: dayTx.filter((item) => item.type === "expense").reduce((sum, item) => sum + Number(item.amount), 0) }; });
  useEffect(() => {
    window.saku.auth.status().then((s) => {
      setConfigured(s.configured);
      setAuthReady(true);
    });
  }, []);
  useEffect(() => {
    if (!unlocked) return;
    document.documentElement.classList.toggle("light", !dark);
    Promise.all([window.saku.summary(), window.saku.transactions.list(), window.saku.vault.list(), window.saku.budget.get(), window.saku.savings.list()])
      .then(([s, t, v, b, g]) => {
        setSummary(s);
        setTx(t);
        setVault(v);
        setBudget(b.amount);
        setSavings(g);
      })
      .catch(() => toast.error("Gagal memuat data"));
  }, [dark, unlocked]);
  useEffect(() => {
    if (!unlocked) return;
    let timer: number;
    const lock = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(
        () => {
          setUnlocked(false);
          setPin("");
          setTx([]);
          setVault([]);
          toast.info("SAKU terkunci otomatis karena tidak aktif.");
        },
        autoLockMinutes * 60 * 1000,
      );
    };
    const events = ["mousemove", "keydown", "mousedown", "touchstart"] as const;
    events.forEach((event) => window.addEventListener(event, lock));
    lock();
    return () => {
      window.clearTimeout(timer);
      events.forEach((event) => window.removeEventListener(event, lock));
    };
  }, [unlocked, autoLockMinutes]);
  async function submitPin(e: any) {
    e.preventDefault();
    try {
      if (!configured) {
        if (pin !== pinConfirm) return toast.error("PIN tidak sama");
        const setup = await window.saku.auth.setup(pin);
        setConfigured(true);
        setUnlocked(true);
        window.alert(`Simpan recovery key ini di tempat aman:\n\n${setup.recovery}`);
      } else {
        const result = await window.saku.auth.verify(pin);
        if (result.ok) setUnlocked(true);
        else { toast.error(result.lockedUntil ? "Terlalu banyak percobaan. Tunggu 30 detik." : "PIN salah"); setRecoveryOpen(true); }
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal memproses PIN");
    }
  }
  async function submitRecovery(e: any) { e.preventDefault(); try { await window.saku.auth.recover(recoveryKey, recoveryPin); setRecoveryOpen(false); setRecoveryKey(""); setRecoveryPin(""); setPin(""); toast.success("PIN berhasil dipulihkan"); } catch (e: any) { toast.error(e.message || "Recovery gagal"); } }
  async function submitChangePin(e: any) { e.preventDefault(); const f = new FormData(e.currentTarget); try { await window.saku.auth.change(String(f.get("current")), String(f.get("next"))); setChangePinOpen(false); toast.success("PIN berhasil diubah"); } catch (e: any) { toast.error(e.message || "Gagal mengubah PIN"); } }
  if (!authReady) return <div className="auth-screen">Memuat SAKU...</div>;
  if (!unlocked)
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="brand auth-brand"><img src="/logo-vertikal.png" alt="SAKU" /></div>
          <LockKeyhole size={34} className="auth-lock" />
          <h1>{configured ? "Welcome back" : "Secure your SAKU"}</h1>
          <p>{configured ? "Masukkan PIN 6 digit untuk membuka workspace." : "Buat PIN 6 digit untuk melindungi data pribadi Anda."}</p>
          <form onSubmit={submitPin}>
            <input
              type="password"
              autoFocus
              inputMode="numeric"
              maxLength={6}
              pattern="[0-9]{6}"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="••••••"
            />
            <div className="pin-dots">
              {Array.from({ length: 6 }).map((_, i) => (
                <i className={i < pin.length ? "filled" : ""} key={i} />
              ))}
            </div>
            {!configured && (
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pinConfirm}
                onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ""))}
                placeholder="Ulangi PIN"
              />
            )}
            <button className="primary">{configured ? "Unlock workspace" : "Create secure PIN"}</button>
          </form>
          <small>Data tetap tersimpan lokal dan terenkripsi.</small>
          {recoveryOpen && <div className="modal-backdrop"><form className="modal" onSubmit={submitRecovery}><h2>Recover access</h2><p className="muted">Gunakan recovery key yang dibuat saat setup PIN.</p><label>Recovery key<input required value={recoveryKey} onChange={(e) => setRecoveryKey(e.target.value)} autoFocus /></label><label>New PIN<input required inputMode="numeric" maxLength={6} pattern="[0-9]{6}" type="password" value={recoveryPin} onChange={(e) => setRecoveryPin(e.target.value.replace(/\D/g, ""))} /></label><div className="modal-actions"><button type="button" onClick={() => setRecoveryOpen(false)}>Cancel</button><button className="primary">Recover PIN</button></div></form></div>}
        </div>
        <Toaster theme={dark ? "dark" : "light"} />
      </div>
    );
  const nav = [
    ["Overview", LayoutDashboard],
    ["Finance", WalletCards],
    ["Vault", LockKeyhole],
    ["Settings", Settings2],
  ] as const;
  async function addTx(e: any) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const payload = {
      type: f.get("type"),
      category: f.get("category"),
      amount: Number(f.get("amount")),
      note: f.get("note"),
      date: new Date().toISOString(),
    };
    if (editingTx) await window.saku.transactions.update({ ...payload, id: editingTx.id, date: editingTx.date }); else await window.saku.transactions.add(payload);
    setEditingTx(null);
    setShowAdd(false);
    toast.success("Transaksi tersimpan");
    location.reload();
  }
  async function addVault(e: any) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const payload = {
      kind: vaultKind,
      title: f.get("title"),
      payload: { username: f.get("username"), password: vaultPassword, note: f.get("note") },
    };
    if (editingVault) await window.saku.vault.update({ ...payload, id: editingVault.id }); else await window.saku.vault.add(payload);
    setEditingVault(null);
    setVaultPassword("");
    setShowVaultAdd(false);
    toast.success("Vault item tersimpan terenkripsi");
    const rows = await window.saku.vault.list();
    setVault(rows);
  }
  function generatePassword() { const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*"; const values = crypto.getRandomValues(new Uint32Array(24)); setVaultPassword(Array.from(values, (v) => chars[v % chars.length]).join("")); }
  const visibleTransactions = tx.filter((item) => transactionFilter === "all" || item.type === transactionFilter);
  const visibleVault = vault.filter((item) => (vaultFilter === "all" || item.kind === vaultFilter) && (!vaultSearch.trim() || `${item.title} ${item.kind}`.toLowerCase().includes(vaultSearch.trim().toLowerCase())));
  function updateAutoLock(value: string) { const minutes = Number(value); setAutoLockMinutes(minutes); localStorage.setItem("saku:auto-lock-minutes", String(minutes)); toast.success(`Auto-lock diatur ${minutes} menit`); }
  async function deleteTransaction(id: number) {
    setConfirmDialog({ title: "Delete transaction", message: "Transaksi ini akan dihapus secara permanen.", action: async () => { await window.saku.transactions.delete(id); setTx(await window.saku.transactions.list()); toast.success("Transaksi dihapus"); } });
  }
  function editTransaction(tx: any) { setEditingTx(tx); setShowAdd(true); }
  async function deleteVault(id: number) {
    setConfirmDialog({ title: "Delete vault item", message: "Item terenkripsi ini akan dihapus secara permanen.", action: async () => { await window.saku.vault.delete(id); setVault(await window.saku.vault.list()); toast.success("Item vault dihapus"); } });
  }
  async function openVault(id: number) {
    const item = await window.saku.vault.read(id);
    setSelectedVault(item);
  }
  async function copySecret(value: string) {
    await navigator.clipboard.writeText(value);
    toast.success("Disalin sementara ke clipboard");
    window.setTimeout(() => navigator.clipboard.writeText(""), 30_000);
  }
  async function saveBudget(e: any) {
    e.preventDefault();
    const amount = Number(new FormData(e.currentTarget).get("amount"));
    await window.saku.budget.set(amount);
    setBudget(amount);
    toast.success("Budget bulan ini tersimpan");
  }
  async function submitBackup(e: any) {
    e.preventDefault();
    if (backupPassword.length < 10) {
      toast.error("Password backup minimal 10 karakter");
      return;
    }
    setBackupBusy(true);
    try {
      if (backupAction === "export") {
        await window.saku.backup.export(backupPassword);
        toast.success("Backup berhasil diekspor");
      } else {
        await window.saku.backup.import(backupPassword, restoreMode);
        toast.success("Backup berhasil dipulihkan");
        window.location.reload();
      }
      setBackupAction(null);
      setBackupPassword("");
    } catch (e: any) {
      toast.error(e.message || (backupAction === "export" ? "Backup gagal" : "Restore gagal"));
    } finally {
      setBackupBusy(false);
    }
  }
  async function addSavings(e: any) { e.preventDefault(); const f = new FormData(e.currentTarget); await window.saku.savings.add({ title: f.get("title"), target: Number(f.get("target")), current: Number(f.get("current") || 0), deadline: f.get("deadline") }); setSavings(await window.saku.savings.list()); e.currentTarget.reset(); toast.success("Target tabungan dibuat"); }
  async function saveSavingsEdit(e: any) { e.preventDefault(); const f = new FormData(e.currentTarget); await window.saku.savings.update({ ...editingSavings, title: f.get("title"), current: Number(f.get("current")) }); setSavings(await window.saku.savings.list()); setEditingSavings(null); toast.success("Target diperbarui"); }
  async function deleteSavings(id: number) { setConfirmDialog({ title: "Delete savings goal", message: "Target tabungan ini akan dihapus secara permanen.", action: async () => { await window.saku.savings.delete(id); setSavings(await window.saku.savings.list()); toast.success("Target dihapus"); } }); }
  return (
    <div className="app">
      <aside>
        <div className="brand app-brand"><img src="/logo-horizontal.png" alt="SAKU" /></div>
        <div className="workspace">
          <small>WORKSPACE</small>
          <div className="workspace-row">
            <div className="avatar">R</div>
            <span>Rama's Space</span>
            <ChevronRight size={16} />
          </div>
        </div>
        <nav>
          {nav.map(([name, Icon]) => (
            <button className={section === name ? "active" : ""} onClick={() => setSection(name)} key={name}>
              <Icon size={18} />
              {name}
            </button>
          ))}
        </nav>
        <div className="side-bottom">
          <button
            onClick={() => { setBackupAction("export"); setBackupPassword(""); }}
          >
            <Settings2 size={18} />
            Backup & settings
          </button>
          <button
            onClick={() => { setBackupAction("import"); setBackupPassword(""); setRestoreMode("merge"); }}
          >
            <LockKeyhole size={18} />
            Restore backup
          </button>
          <div className="secure">
            <ShieldCheck size={18} />
            <div>
              <b>Secure mode</b>
              <small>Encrypted locally</small>
            </div>
            <span className="dot" />
          </div>
        </div>
      </aside>
      <main>
        <header>
          <div>
            <p className="eyebrow">{new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date()).toUpperCase()}</p>
            <h1>{section === "Overview" ? "Good morning, Rama." : section}</h1>
            <p className="muted">Your private workspace, organized and secure.</p>
          </div>
          <div className="header-actions">
            <button className="icon-btn" onClick={() => setDark(!dark)}>
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div className="profile">R</div>
          </div>
        </header>
        {section === "Overview" && (
          <>
            <div className="hero-grid">
              <div className="balance-card">
                <div className="card-label">
                  TOTAL BALANCE <span>•••</span>
                </div>
                <div className="balance">{money(summary.income - summary.expense)}</div>
                <div className="positive">
                  <ShieldCheck size={15} /> Local balance <span>encrypted on this device</span>
                </div>
                <div className="card-footer">
                  <span>SAKU WALLET</span>
                  <span>LOCAL</span>
                </div>
              </div>
              <div className="metric">
                <div className="metric-icon green">
                  <ArrowUpRight size={18} />
                </div>
                <small>THIS MONTH'S INCOME</small>
                <h3>{money(summary.income)}</h3>
                <span className="green-text">
                  Recorded this month
                </span>
              </div>
              <div className="metric">
                <div className="metric-icon red">
                  <ArrowDownRight size={18} />
                </div>
                <small>THIS MONTH'S SPENDING</small>
                <h3>{money(summary.expense)}</h3>
                <span className="red-text">
                  Recorded this month
                </span>
              </div>
            </div>
            <section className="content-grid">
              <div className="panel chart-panel">
                <div className="panel-head">
                  <div>
                    <h2>Cash flow</h2>
                    <p>Income vs spending · Last 7 days</p>
                  </div>
                  <button className="select">This week ▾</button>
                </div>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={chart}>
                    <defs>
                      <linearGradient id="a" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#8490a6", fontSize: 12 }} />
                    <YAxis hide />
                    <Tooltip contentStyle={{ background: "#1b2030", border: "1px solid #30394d", borderRadius: 10 }} />
                    <Area type="monotone" dataKey="in" stroke="#9b7bff" fill="url(#a)" strokeWidth={2} />
                    <Area type="monotone" dataKey="out" stroke="#36d399" fill="none" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="legend">
                  <span>
                    <i className="purple" />
                    Income
                  </span>
                  <span>
                    <i className="green" />
                    Spending
                  </span>
                </div>
              </div>
              <div className="panel">
                <div className="panel-head">
                  <div>
                    <h2>Recent activity</h2>
                    <p>Your latest transactions</p>
                  </div>
                  <button className="link" onClick={() => setSection("Finance")}>
                    View all <ChevronRight size={14} />
                  </button>
                </div>
                <div className="activity">
                  {tx.length ? tx.slice(0, 4).map((x, i) => (
                      <div className="activity-row" key={i}>
                        <div className={"tx-icon " + x.type}>{x.type === "income" ? <ArrowDownRight size={17} /> : <ArrowUpRight size={17} />}</div>
                        <div className="tx-info">
                          <b>{x.category}</b>
                          <small>{x.note || "Transaction"}</small>
                        </div>
                        <strong className={x.type === "income" ? "income" : ""}>
                          {x.type === "income" ? "+" : "-"}
                          {money(x.amount)}
                        </strong>
                      </div>
                    )) : <div className="empty compact"><span>No transactions yet</span><button className="link" onClick={() => setSection("Finance")}>Add your first transaction</button></div>}
                </div>
              </div>
            </section>
          </>
        )}
        {section === "Settings" && (
          <section className="settings-page">
            <div className="settings-intro">
              <div>
                <p className="eyebrow">PREFERENCES & SECURITY</p>
                <h2>Settings</h2>
                <p className="muted">Kelola tampilan, keamanan, dan pemindahan data SAKU.</p>
              </div>
              <button className="primary" onClick={() => setUnlocked(false)}>Lock now</button>
            </div>
            <div className="settings-grid">
              <div className="panel setting-card">
                <div className="setting-icon"><Sun size={18} /></div>
                <h3>Appearance</h3>
                <p className="muted">Pilih tampilan yang nyaman digunakan.</p>
                <button className="setting-action" onClick={() => setDark(!dark)}>{dark ? "Switch to light mode" : "Switch to dark mode"}</button>
              </div>
              <div className="panel setting-card">
                <div className="setting-icon green"><ShieldCheck size={18} /></div>
                <h3>Security</h3>
                <p className="muted">PIN lock dan auto-lock melindungi workspace ini.</p>
                <label className="setting-select">Auto-lock<select value={autoLockMinutes} onChange={(e) => updateAutoLock(e.target.value)}><option value={5}>5 minutes</option><option value={15}>15 minutes</option><option value={30}>30 minutes</option><option value={60}>60 minutes</option></select></label>
                <div className="setting-actions"><button className="setting-action" onClick={() => setChangePinOpen(true)}>Change PIN</button><button className="setting-action" onClick={() => setUnlocked(false)}>Lock workspace</button></div>
              </div>
              <div className="panel setting-card">
                <div className="setting-icon"><Database size={18} /></div>
                <h3>Backup & restore</h3>
                <p className="muted">Backup terenkripsi dapat dipindahkan ke perangkat baru.</p>
                <div className="setting-actions">
                  <button className="setting-action" onClick={() => { setBackupAction("export"); setBackupPassword(""); }}>Create backup</button>
                  <button className="setting-action" onClick={() => { setBackupAction("import"); setBackupPassword(""); setRestoreMode("merge"); }}>Restore backup</button>
                </div>
              </div>
            </div>
            <div className="secure-notice"><ShieldCheck size={20} /><div><b>Secure mode enabled</b><span>Data SAKU tersimpan lokal. Personal Vault dienkripsi sebelum disimpan.</span></div></div>
          </section>
        )}
        {section === "Finance" && (
          <section className="panel full">
            <div className="panel-head">
              <div>
                <h2>Transactions</h2>
                <p>Track your income and spending.</p>
              </div>
              <button className="primary" onClick={() => setShowAdd(true)}>
                <Plus size={17} />
                Add transaction
              </button>
            </div>
            <div className="filter-row">
              <button className={transactionFilter === "all" ? "filter active" : "filter"} onClick={() => setTransactionFilter("all")}>All</button>
              <button className={transactionFilter === "income" ? "filter active" : "filter"} onClick={() => setTransactionFilter("income")}>Income</button>
              <button className={transactionFilter === "expense" ? "filter active" : "filter"} onClick={() => setTransactionFilter("expense")}>Expense</button>
            </div>
            <form className="budget-strip" onSubmit={saveBudget}>
              <div>
                <b>Monthly budget</b>
                <small>Set your spending limit for this month</small>
              </div>
              <input name="amount" type="number" min="0" defaultValue={budget} />
              <button className="primary">Save budget</button>
            </form>
            <div className="savings-strip"><form onSubmit={addSavings}><b>New savings goal</b><input name="title" required placeholder="Goal name" /><input name="target" type="number" min="1" required placeholder="Target amount" /><input name="current" type="number" min="0" placeholder="Saved" /><input name="deadline" type="date" /><button className="primary">Add goal</button></form>{savings.length > 0 && <div className="savings-list">{savings.map((g) => <div className="goal" key={g.id}><span><b>{g.title}</b><small>{money(g.current)} / {money(g.target)}</small></span><progress value={g.current} max={g.target} /><button className="row-delete" onClick={() => setEditingSavings(g)}>Edit</button><button className="row-delete" onClick={() => deleteSavings(g.id)}>Delete</button></div>)}</div>}</div>
            <div className="table">
              {visibleTransactions.length ? visibleTransactions.map((x) => (
                  <div className="table-row">
                    <span>{x.category}</span>
                    <span>{x.note}</span>
                    <span>{new Date(x.date).toLocaleDateString("id-ID")}</span>
                    <b className={x.type === "income" ? "income" : ""}>
                      {x.type === "income" ? "+" : "-"} {money(x.amount)}
                    </b>
                  <button className="row-delete" onClick={() => editTransaction(x)}>Edit</button>
                    <button className="row-delete" onClick={() => deleteTransaction(x.id)}>
                      Delete
                    </button>
                  </div>
                )) : <div className="empty compact"><span>No transactions match this filter.</span></div>}
            </div>
          </section>
        )}
        {section === "Vault" && (
          <section className="panel full">
            <div className="panel-head">
              <div>
                <h2>Personal Vault</h2>
                <p>Your encrypted private information.</p>
              </div>
              <button className="primary" onClick={() => { setEditingVault(null); setVaultKind("account"); setVaultPassword(""); setShowVaultAdd(true); }}>
                {" "}
                <Plus size={17} />
                Add item
              </button>
            </div>
            <div className="filter-row">
              {[["all", "All"], ["account", "Accounts"], ["identity", "Identity"], ["secure-note", "Secure notes"]].map(([value, label]) => (
                <button key={value} className={vaultFilter === value ? "filter active" : "filter"} onClick={() => setVaultFilter(value)}>{label}</button>
              ))}
            </div>
            <input className="vault-search" value={vaultSearch} onChange={(e) => setVaultSearch(e.target.value)} placeholder="Search vault items..." />
            <div className="vault-grid">
              {visibleVault.length ? (
                visibleVault.map((v) => (
                  <div className="vault-card" key={v.id} onClick={() => openVault(v.id)}>
                    <LockKeyhole size={18} />
                    <b>{v.title}</b>
                    <small>{v.kind}</small>
                    <button className="row-delete" onClick={(e) => { e.stopPropagation(); deleteVault(v.id); }}>
                      Delete
                    </button>
                  </div>
                ))
              ) : (
                <div className="empty">
                  <LockKeyhole size={28} />
                  <b>Your vault is empty</b>
                  <span>Add passwords, secure notes, and identity details.</span>
                </div>
              )}
            </div>
          </section>
        )}
        {showAdd && (
          <div className="modal-backdrop">
            <form className="modal" onSubmit={addTx}>
                <h2>{editingTx ? "Edit transaction" : "Add transaction"}</h2>
              <label>
                Type
                  <select name="type" defaultValue={editingTx?.type ?? "expense"}>
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </label>
              <label>
                Category
                  <input name="category" required defaultValue={editingTx?.category ?? ""} placeholder="e.g. Groceries" />
              </label>
              <label>
                Amount
                  <input name="amount" type="number" required defaultValue={editingTx?.amount ?? ""} placeholder="0" />
              </label>
              <label>
                Note
                  <input name="note" defaultValue={editingTx?.note ?? ""} placeholder="Optional note" />
              </label>
              <div className="modal-actions">
                <button type="button" onClick={() => { setShowAdd(false); setEditingTx(null); }}>
                  Cancel
                </button>
                <button className="primary">Save transaction</button>
              </div>
            </form>
          </div>
        )}
        {editingSavings && (
          <div className="modal-backdrop">
            <form className="modal" onSubmit={saveSavingsEdit}>
              <h2>Edit savings goal</h2>
              <label>Goal name<input name="title" required defaultValue={editingSavings.title} /></label>
              <label>Saved amount<input name="current" type="number" min="0" required defaultValue={editingSavings.current} /></label>
              <div className="modal-actions"><button type="button" onClick={() => setEditingSavings(null)}>Cancel</button><button className="primary">Save goal</button></div>
            </form>
          </div>
        )}
        {showVaultAdd && (
          <div className="modal-backdrop">
            <form className="modal" onSubmit={addVault}>
                <h2>{editingVault ? "Edit vault item" : "Add vault item"}</h2>
              <label>
                Type
                  <select name="kind" value={vaultKind} onChange={(e) => setVaultKind(e.target.value)}>
                  <option value="account">Account</option>
                  <option value="identity">Identity</option>
                  <option value="secure-note">Secure note</option>
                </select>
              </label>
              <label>
                Title
                  <input name="title" required defaultValue={editingVault?.title ?? ""} placeholder="e.g. Email utama" />
              </label>
              <label>
                {vaultKind === "identity" ? "Full name / identity" : "Username / email"}
                  <input name="username" defaultValue={editingVault?.payload?.username ?? ""} placeholder={vaultKind === "identity" ? "Nama lengkap" : "Username atau email"} />
              </label>
              <label>
                {vaultKind === "secure-note" ? "Optional secret" : "Password"}
                <div className="password-row"><input type="password" name="password" value={vaultPassword} onChange={(e) => setVaultPassword(e.target.value)} placeholder={editingVault ? "Leave blank to clear" : "Optional"} /><button type="button" className="row-delete" onClick={generatePassword}>Generate</button></div>
              </label>
              <label>
                Secure note
                <textarea name="note" rows={3} defaultValue={editingVault?.payload?.note ?? ""} placeholder="Encrypted note" />
              </label>
              <div className="modal-actions">
                <button type="button" onClick={() => { setShowVaultAdd(false); setEditingVault(null); setVaultPassword(""); }}>
                  Cancel
                </button>
                <button className="primary">Save securely</button>
              </div>
            </form>
          </div>
        )}
        {selectedVault && (
          <div className="modal-backdrop">
            <div className="modal">
              <h2>{selectedVault.title}</h2>
              <p className="muted">{selectedVault.kind}</p>
              <div className="secret-field">
                <b>Username</b>
                <span>{selectedVault.payload?.username || "—"}</span>
              </div>
              <div className="secret-field">
                <b>Password</b>
                <span>{selectedVault.payload?.password ? "••••••••" : "—"}</span>
                {selectedVault.payload?.password && (
                  <button className="row-delete" onClick={() => copySecret(selectedVault.payload.password)}>
                    Copy
                  </button>
                )}
              </div>
              <div className="secret-field">
                <b>Note</b>
                <span>{selectedVault.payload?.note || "—"}</span>
              </div>
              <div className="modal-actions">
                <button className="primary" onClick={() => { setEditingVault(selectedVault); setVaultKind(selectedVault.kind ?? "account"); setVaultPassword(selectedVault.payload?.password ?? ""); setSelectedVault(null); setShowVaultAdd(true); }}>Edit</button>
                <button onClick={() => setSelectedVault(null)}>Close</button>
              </div>
            </div>
          </div>
        )}
        {backupAction && (
          <div className="modal-backdrop">
            <form className="modal" onSubmit={submitBackup}>
              <h2>{backupAction === "export" ? "Export encrypted backup" : "Restore backup"}</h2>
              <p className="muted">
                {backupAction === "export" ? "File .saku akan dienkripsi dengan password ini." : "Pilih file .saku lalu masukkan password backup."}
              </p>
              <label>
                Password backup
                <input type="password" minLength={10} required autoFocus value={backupPassword} onChange={(e) => setBackupPassword(e.target.value)} placeholder="Minimal 10 karakter" />
              </label>
              {backupAction === "import" && (
                <label>
                  Restore mode
                  <select value={restoreMode} onChange={(e) => setRestoreMode(e.target.value as "merge" | "replace")}>
                    <option value="merge">Merge — pertahankan data lokal</option>
                    <option value="replace">Replace — ganti data lokal</option>
                  </select>
                </label>
              )}
              <div className="modal-actions">
                <button type="button" onClick={() => { setBackupAction(null); setBackupPassword(""); }} disabled={backupBusy}>Cancel</button>
                <button className="primary" disabled={backupBusy}>{backupBusy ? "Processing..." : backupAction === "export" ? "Choose save location" : "Choose backup file"}</button>
              </div>
            </form>
          </div>
        )}
        {confirmDialog && (
          <div className="modal-backdrop">
            <div className="modal confirm-modal">
              <div className="confirm-mark">!</div>
              <h2>{confirmDialog.title}</h2>
              <p className="muted">{confirmDialog.message}</p>
              <div className="modal-actions">
                <button onClick={() => setConfirmDialog(null)}>Cancel</button>
                <button className="danger-button" onClick={async () => { const action = confirmDialog.action; setConfirmDialog(null); try { await action(); } catch (e: any) { toast.error(e.message || "Operasi gagal"); } }}>Delete permanently</button>
              </div>
            </div>
          </div>
        )}
        {changePinOpen && <div className="modal-backdrop"><form className="modal" onSubmit={submitChangePin}><h2>Change PIN</h2><p className="muted">PIN baru harus terdiri dari 6 digit.</p><label>Current PIN<input name="current" required type="password" inputMode="numeric" maxLength={6} pattern="[0-9]{6}" /></label><label>New PIN<input name="next" required type="password" inputMode="numeric" maxLength={6} pattern="[0-9]{6}" /></label><div className="modal-actions"><button type="button" onClick={() => setChangePinOpen(false)}>Cancel</button><button className="primary">Save PIN</button></div></form></div>}
        <Toaster theme={dark ? "dark" : "light"} />
      </main>
    </div>
  );
}
