import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, ArrowRight } from "lucide-react";
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
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Gradient orbs */}
      <div className="absolute top-[-200px] right-[-200px] w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px]" />
      <div className="absolute bottom-[-150px] left-[-150px] w-[400px] h-[400px] rounded-full bg-primary/5 blur-[100px]" />

      <div className="w-full max-w-md mx-4 relative z-10">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 glow-cyan mb-5">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">
            Ho<span className="gradient-text">x</span>ta
          </h1>
          <p className="text-muted-foreground text-sm mt-2">
            Panou de control firewall
          </p>
        </div>

        {/* Form */}
        <div className="glass rounded-2xl p-8">
          <div className="flex mb-8 bg-muted rounded-xl p-1">
            <button
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                isLogin ? "gradient-btn text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setIsLogin(true)}
            >
              Autentificare
            </button>
            <button
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                !isLogin ? "gradient-btn text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setIsLogin(false)}
            >
              Înregistrare
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label htmlFor="email" className="text-sm text-muted-foreground">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 bg-muted/50 border-border/50 text-foreground h-11 rounded-xl focus:border-primary focus:ring-primary"
                placeholder="user@example.com"
                required
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-sm text-muted-foreground">Parolă</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 bg-muted/50 border-border/50 text-foreground h-11 rounded-xl focus:border-primary focus:ring-primary"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full h-11 rounded-xl gradient-btn text-primary-foreground font-semibold text-sm border-0 hover:opacity-90 transition-opacity" disabled={loading}>
              {loading ? "Se încarcă..." : isLogin ? "Autentificare" : "Creare cont"}
              {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Auth;
