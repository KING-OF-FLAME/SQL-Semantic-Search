import { useState } from "react";
import { useLocation } from "wouter";
import { ShieldCheck, Lock, User, Loader2 } from "lucide-react";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

export default function AdminLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  
  const { mutate: performLogin, isPending } = useLogin();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    performLogin({ data: { username, password } }, {
      onSuccess: (data) => {
        login(data.token);
        toast({ title: "Success", description: "Logged in successfully." });
        setLocation("/admin");
      },
      onError: (err) => {
        toast({
          title: "Login Failed",
          description: err.message || "Invalid credentials.",
          variant: "destructive"
        });
      }
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4 relative overflow-hidden">
      {/* Background illustration */}
      <img 
        src={`${import.meta.env.BASE_URL}images/hero-bg.png`}
        alt=""
        className="absolute inset-0 w-full h-full object-cover opacity-10 pointer-events-none"
      />
      
      <div className="w-full max-w-md bg-card border border-border rounded-3xl p-8 shadow-2xl shadow-black/5 relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 text-primary">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground">Admin Portal</h1>
          <p className="text-muted-foreground mt-2 text-center">Sign in to manage the Grounded Answer Engine</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground ml-1">Username</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-background border-2 border-border focus:border-primary rounded-xl py-3 pl-12 pr-4 transition-colors outline-none"
                placeholder="admin"
                disabled={isPending}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-background border-2 border-border focus:border-primary rounded-xl py-3 pl-12 pr-4 transition-colors outline-none"
                placeholder="••••••••"
                disabled={isPending}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending || !username || !password}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3.5 rounded-xl mt-6 transition-all duration-200 hover:-translate-y-0.5 shadow-lg shadow-primary/25 active:translate-y-0 disabled:opacity-70 disabled:hover:translate-y-0 flex justify-center items-center gap-2"
          >
            {isPending && <Loader2 className="w-5 h-5 animate-spin" />}
            {isPending ? "Authenticating..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
