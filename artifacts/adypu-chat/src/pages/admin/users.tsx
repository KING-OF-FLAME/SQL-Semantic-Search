import { useState, useCallback, useEffect } from "react";
import { AdminLayout } from "@/components/layout/admin-layout";
import {
  Users, UserPlus, Trash2, Pencil, X, Check,
  Search, Shield, ShieldCheck, AlertCircle,
  Loader2, RefreshCw, ArrowUpCircle, ArrowDownCircle,
  Eye, EyeOff,
} from "lucide-react";
import { useAdminApi } from "@/hooks/use-admin-api";
import { useToast } from "@/hooks/use-toast";

interface UserRow {
  id: number;
  username: string;
  role: "admin" | "user";
  isActive: boolean;
  createdAt: string;
}

interface UsersResponse {
  users: UserRow[];
  total: number;
  page: number;
  limit: number;
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function AdminUsersPage() {
  const { adminFetch } = useAdminApi();
  const { toast } = useToast();

  const [data, setData] = useState<UsersResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  // Create modal state
  const [showCreate, setShowCreate] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"user" | "admin">("user");
  const [creating, setCreating] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  // Edit modal state
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editRole, setEditRole] = useState<"user" | "admin">("user");
  const [editActive, setEditActive] = useState(true);
  const [editPw, setEditPw] = useState("");
  const [showEditPw, setShowEditPw] = useState(false);
  const [saving, setSaving] = useState(false);

  // Per-row action loading
  const [promoteId, setPromoteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [toggleId, setToggleId] = useState<number | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch("/admin/users?limit=100");
      const json = await res.json();
      setData(json);
    } catch {
      toast({ title: "Error", description: "Failed to load users.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [adminFetch, toast]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  /* ── Create ── */
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword.trim()) return;
    setCreating(true);
    try {
      const res = await adminFetch("/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: newUsername.trim(), password: newPassword, role: newRole }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || "Failed to create user"); }
      toast({ title: "User created", description: `@${newUsername} has been created as ${newRole}.` });
      setShowCreate(false); setNewUsername(""); setNewPassword(""); setNewRole("user");
      loadUsers();
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to create user.", variant: "destructive" });
    } finally { setCreating(false); }
  };

  /* ── Quick Promote / Demote (one-click) ── */
  const handlePromoteToggle = async (u: UserRow) => {
    const newRole = u.role === "admin" ? "user" : "admin";
    setPromoteId(u.id);
    try {
      const res = await adminFetch(`/admin/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) throw new Error("Failed to update role");
      toast({
        title: newRole === "admin" ? "Promoted to Admin" : "Demoted to User",
        description: `@${u.username} is now ${newRole === "admin" ? "an admin" : "a regular user"}.`,
      });
      loadUsers();
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Role change failed.", variant: "destructive" });
    } finally { setPromoteId(null); }
  };

  /* ── Quick Toggle Active ── */
  const handleToggleActive = async (u: UserRow) => {
    setToggleId(u.id);
    try {
      const res = await adminFetch(`/admin/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !u.isActive }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      toast({ title: u.isActive ? "Account Disabled" : "Account Enabled", description: `@${u.username} is now ${u.isActive ? "disabled" : "active"}.` });
      loadUsers();
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Status change failed.", variant: "destructive" });
    } finally { setToggleId(null); }
  };

  /* ── Edit Modal Save ── */
  const openEdit = (u: UserRow) => { setEditUser(u); setEditRole(u.role); setEditActive(u.isActive); setEditPw(""); setShowEditPw(false); };

  const handleSave = async () => {
    if (!editUser) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = { isActive: editActive, role: editRole };
      if (editPw.trim()) body.password = editPw;
      const res = await adminFetch(`/admin/users/${editUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to update user");
      toast({ title: "User updated", description: `@${editUser.username} has been updated.` });
      setEditUser(null);
      loadUsers();
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Update failed.", variant: "destructive" });
    } finally { setSaving(false); }
  };

  /* ── Delete ── */
  const handleDelete = async (u: UserRow) => {
    if (!confirm(`Delete user @${u.username}? This cannot be undone.`)) return;
    setDeletingId(u.id);
    try {
      const res = await adminFetch(`/admin/users/${u.id}`, { method: "DELETE" });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || "Failed to delete"); }
      toast({ title: "User deleted", description: `@${u.username} has been removed.` });
      loadUsers();
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Delete failed.", variant: "destructive" });
    } finally { setDeletingId(null); }
  };

  const filtered = (data?.users ?? []).filter(
    (u) => !search || u.username.toLowerCase().includes(search.toLowerCase()),
  );

  const inputCls = "w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all";

  return (
    <AdminLayout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="w-6 h-6 text-primary" /> User Management
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {data?.total ?? 0} total users · Manage access and roles
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={loadUsers} className="p-2 rounded-lg hover:bg-muted transition-colors" title="Refresh">
              <RefreshCw className={`w-4 h-4 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl transition-all shadow-md text-sm"
            >
              <UserPlus className="w-4 h-4" /> New User
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-card border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
          />
        </div>

        {/* ── Create User Modal ── */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
              <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
                <h2 className="font-display font-bold text-lg">Create New User</h2>
                <button onClick={() => setShowCreate(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
              <form onSubmit={handleCreate} className="px-6 py-5 flex flex-col gap-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Username</label>
                  <input type="text" placeholder="e.g. john_doe" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} required className={inputCls} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Password</label>
                  <div className="relative">
                    <input type={showNewPw ? "text" : "password"} placeholder="Min 6 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} className={inputCls + " pr-10"} />
                    <button type="button" onClick={() => setShowNewPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Role</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["user", "admin"] as const).map(r => (
                      <button
                        key={r} type="button"
                        onClick={() => setNewRole(r)}
                        className={`py-2.5 rounded-xl text-sm font-semibold border flex items-center justify-center gap-2 transition-all ${newRole === r ? "bg-primary text-primary-foreground border-primary shadow-md" : "bg-muted text-muted-foreground border-border hover:border-primary/40"}`}
                      >
                        {r === "admin" ? <ShieldCheck className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                        {r.charAt(0).toUpperCase() + r.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={creating}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2.5 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-1"
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  Create User
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ── Edit User Modal ── */}
        {editUser && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
              <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
                <div>
                  <h2 className="font-display font-bold text-lg">Edit @{editUser.username}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Update role, status, or password</p>
                </div>
                <button onClick={() => setEditUser(null)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
              <div className="px-6 py-5 flex flex-col gap-5">

                {/* Role selector */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Role</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["user", "admin"] as const).map(r => (
                      <button
                        key={r} type="button"
                        onClick={() => setEditRole(r)}
                        className={`py-3 rounded-xl text-sm font-semibold border flex items-center justify-center gap-2 transition-all ${editRole === r ? (r === "admin" ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20" : "bg-green-600 text-white border-green-600 shadow-md") : "bg-muted text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"}`}
                      >
                        {r === "admin" ? <ShieldCheck className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                        {r === "admin" ? "Admin" : "User"}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {editRole === "admin" ? "Admin: full access to the admin panel, crawl controls, and user management." : "User: chat access + personal search history only."}
                  </p>
                </div>

                {/* Account status */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Account Status</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[{ label: "Active", value: true }, { label: "Disabled", value: false }].map(opt => (
                      <button
                        key={String(opt.value)} type="button"
                        onClick={() => setEditActive(opt.value)}
                        className={`py-2.5 rounded-xl text-sm font-semibold border transition-all ${editActive === opt.value ? (opt.value ? "bg-green-600 text-white border-green-600" : "bg-destructive text-destructive-foreground border-destructive") : "bg-muted text-muted-foreground border-border hover:border-primary/40"}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Password reset */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">New Password <span className="font-normal">(optional)</span></label>
                  <div className="relative">
                    <input
                      type={showEditPw ? "text" : "password"}
                      placeholder="Leave blank to keep current"
                      value={editPw}
                      onChange={(e) => setEditPw(e.target.value)}
                      className={inputCls + " pr-10"}
                    />
                    <button type="button" onClick={() => setShowEditPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showEditPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex gap-3 pt-1">
                  <button onClick={() => setEditUser(null)} className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-border bg-muted hover:bg-muted/70 text-muted-foreground transition-all">
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-primary/20"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Users Table ── */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {loading && !data ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center px-6">
              <AlertCircle className="w-8 h-8 text-muted-foreground/40 mb-2" />
              <p className="text-muted-foreground">No users found</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((u) => (
                <div key={u.id} className="flex items-center gap-3 px-4 sm:px-6 py-4 hover:bg-muted/20 transition-colors">

                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${u.role === "admin" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {u.username.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground text-sm">@{u.username}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${u.role === "admin" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {u.role === "admin" ? <ShieldCheck className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                        {u.role}
                      </span>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${u.isActive ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"}`}>
                        {u.isActive ? "Active" : "Disabled"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">Joined {formatDate(u.createdAt)}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">

                    {/* Promote / Demote — one-click, always visible */}
                    <button
                      onClick={() => handlePromoteToggle(u)}
                      disabled={promoteId === u.id}
                      title={u.role === "admin" ? "Demote to User" : "Promote to Admin"}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all disabled:opacity-50 ${
                        u.role === "admin"
                          ? "bg-orange-500/10 text-orange-600 border-orange-500/20 hover:bg-orange-500/20"
                          : "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                      }`}
                    >
                      {promoteId === u.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : u.role === "admin"
                          ? <ArrowDownCircle className="w-3.5 h-3.5" />
                          : <ArrowUpCircle className="w-3.5 h-3.5" />
                      }
                      <span className="hidden sm:inline">{u.role === "admin" ? "Demote" : "Promote"}</span>
                    </button>

                    {/* Edit */}
                    <button
                      onClick={() => openEdit(u)}
                      className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      title="Edit user"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>

                    {/* Toggle active */}
                    <button
                      onClick={() => handleToggleActive(u)}
                      disabled={toggleId === u.id}
                      className={`p-1.5 rounded-lg transition-colors ${u.isActive ? "text-muted-foreground hover:text-orange-600 hover:bg-orange-500/10" : "text-muted-foreground hover:text-green-600 hover:bg-green-500/10"}`}
                      title={u.isActive ? "Disable account" : "Enable account"}
                    >
                      {toggleId === u.id ? <Loader2 className="w-4 h-4 animate-spin" /> : u.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(u)}
                      disabled={deletingId === u.id}
                      className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                      title="Delete user"
                    >
                      {deletingId === u.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Role Legend */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2 text-muted-foreground uppercase tracking-wider">
            <Shield className="w-4 h-4" /> Role Access
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-muted rounded-lg shrink-0"><Shield className="w-4 h-4 text-muted-foreground" /></div>
              <div>
                <p className="font-semibold text-sm">User</p>
                <p className="text-xs text-muted-foreground">Chat access + personal search history. No admin panel access.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary/10 rounded-lg shrink-0"><ShieldCheck className="w-4 h-4 text-primary" /></div>
              <div>
                <p className="font-semibold text-sm">Admin</p>
                <p className="text-xs text-muted-foreground">Full access: crawl controls, document management, source config, user management.</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}
