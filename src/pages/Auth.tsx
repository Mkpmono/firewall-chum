import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Terminal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast({
          title: "Cont creat!",
          description: "Verifică email-ul pentru confirmare.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Eroare",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background scanline relative overflow-hidden">
      {/* Background grid effect */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: `linear-gradient(hsl(var(--neon-glow) / 0.3) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--neon-glow) / 0.3) 1px, transparent 1px)`,
        backgroundSize: '40px 40px'
      }} />

      <div className="w-full max-w-md mx-4 relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-primary/10 border border-primary/30 glow-green mb-4">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold font-mono text-foreground text-glow">
            FIREWALL<span className="text-primary">PANEL</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1 font-mono">
            <Terminal className="inline w-3 h-3 mr-1" />
            Panou de control firewall
          </p>
        </div>

        {/* Form */}
        <div className="bg-card border border-border rounded-lg p-6 glow-green-sm">
          <div className="flex mb-6 bg-muted rounded-md p-1">
            <button
              className={`flex-1 py-2 text-sm font-mono rounded transition-all ${
                isLogin ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setIsLogin(true)}
            >
              LOGIN
            </button>
            <button
              className={`flex-1 py-2 text-sm font-mono rounded transition-all ${
                !isLogin ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setIsLogin(false)}
            >
              REGISTER
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-sm font-mono text-muted-foreground">EMAIL</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 bg-muted border-border font-mono text-foreground focus:border-primary focus:ring-primary"
                placeholder="user@example.com"
                required
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-sm font-mono text-muted-foreground">PAROLĂ</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 bg-muted border-border font-mono text-foreground focus:border-primary focus:ring-primary"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full font-mono" disabled={loading}>
              {loading ? "SE ÎNCARCĂ..." : isLogin ? "AUTENTIFICARE" : "CREARE CONT"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Auth;
