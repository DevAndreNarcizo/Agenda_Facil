import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { ThemeCustomizationContent } from "@/components/dashboard/settings/theme-customization-content";
import {
  isDuplicateSlugError,
  normalizeSlug,
  SLUG_UNAVAILABLE_MESSAGE,
  SLUG_VALIDATION_MESSAGE,
  validateOrganizationSlugAvailability,
} from "@/lib/slug";

export default function SettingsPage() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState("profile");
  const [loading, setLoading] = useState(false);
  const [company, setCompany] = useState<{ name: string; slug: string; plan_name: string; subscription_status: string } | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugError, setSlugError] = useState("");

  useEffect(() => {
    if (profile?.organization_id) {
      fetchCompanyDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.organization_id]);

  const fetchCompanyDetails = async () => {
    if (!profile?.organization_id) return;
    const { data } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", profile.organization_id)
      .single();

    if (data) {
      setCompany(data);
      setName(data.name);
      setSlug(data.slug || "");
    }
  };

  const handleUpdateCompany = async () => {
    if (!profile?.organization_id) {
      toast.error("Organização não encontrada.");
      return;
    }

    setLoading(true);
    setSlugError("");

    try {
      const normalizedSlug = normalizeSlug(slug);
      const slugValidation = await validateOrganizationSlugAvailability(
        normalizedSlug,
        async (organizationSlug) => {
          const { data: existingOrganization, error: lookupError } = await supabase
            .from("organizations")
            .select("id")
            .eq("slug", organizationSlug)
            .maybeSingle();

          if (lookupError) throw lookupError;

          return existingOrganization;
        },
        profile.organization_id,
      );

      if (slugValidation.status === "invalid") {
        setSlugError("Use pelo menos 3 caracteres, apenas letras minúsculas, números e hífens.");
        return;
      }

      if (slugValidation.status === "unavailable") {
        setSlugError(SLUG_UNAVAILABLE_MESSAGE);
        return;
      }

      if (slugValidation.status === "error") {
        setSlugError(SLUG_VALIDATION_MESSAGE);
        return;
      }

      const { error } = await supabase
        .from("organizations")
        .update({ name, slug: normalizedSlug })
        .eq("id", profile.organization_id);

      if (error) throw error;
      toast.success("Configurações salvas com sucesso!");
      setSlug(normalizedSlug);
      fetchCompanyDetails();
    } catch (error) {
      if (isDuplicateSlugError(error)) {
        setSlugError(SLUG_UNAVAILABLE_MESSAGE);
        return;
      }

      toast.error("Erro ao salvar configurações.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-flat space-y-10 p-8 max-w-[1600px] mx-auto animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-stitch-surface-container/50 p-10 rounded-[3rem] border border-stitch-outline-variant/20 relative overflow-hidden group">
        <div className="relative z-10">
          <Badge className="bg-stitch-primary/10 text-stitch-primary border-0 px-4 py-1 rounded-full mb-4 font-black uppercase tracking-[0.2em] text-[10px]">Painel de Gestão</Badge>
          <h1 className="font-headline text-5xl font-black tracking-tight text-stitch-on-surface">Configurações</h1>
          <p className="text-stitch-on-surface-variant font-bold mt-2 max-w-lg">Gerencie a identidade, equipe e faturamento da sua empresa em um só lugar.</p>
        </div>

        <div className="relative z-10 flex flex-col items-end gap-2">
           <p className="text-[10px] font-black uppercase tracking-widest text-stitch-on-surface-variant/60">Painel de Gestão Ativo</p>
        </div>

        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-stitch-primary/5 rounded-full blur-[100px] group-hover:bg-stitch-primary/10 transition-colors duration-1000" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 border-b border-stitch-outline-variant/20 pb-6">
          <TabsList className="bg-stitch-surface-container p-1.5 rounded-2xl border border-stitch-outline-variant/20">
            <TabsTrigger value="profile" className="rounded-xl px-8 py-3 data-[state=active]:bg-stitch-primary data-[state=active]:text-stitch-on-primary font-black transition-all">Perfil Geral</TabsTrigger>
            <TabsTrigger value="appearance" className="rounded-xl px-8 py-3 data-[state=active]:bg-stitch-primary data-[state=active]:text-stitch-on-primary font-black transition-all">Aparência</TabsTrigger>
            <TabsTrigger value="billing" className="rounded-xl px-8 py-3 data-[state=active]:bg-stitch-primary data-[state=active]:text-stitch-on-primary font-black transition-all">Plano e Faturas</TabsTrigger>
          </TabsList>

          <div className="hidden lg:flex items-center gap-4 text-xs font-black uppercase tracking-widest text-stitch-on-surface-variant/60">
            <span className="material-symbols-outlined text-sm">lock</span>
            Conexão Segura SSL/256
          </div>
        </div>

        <TabsContent value="profile" className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
            <div className="xl:col-span-8 space-y-10">
              <Card className="rounded-[3rem] shadow-2xl p-0 overflow-hidden bg-stitch-surface-container-low border border-stitch-outline-variant/20 relative">
                <div className="h-32 bg-gradient-to-r from-stitch-primary/20 via-stitch-primary/10 to-transparent absolute top-0 left-0 right-0 pointer-events-none" />

                <CardHeader className="p-12 pb-8 relative z-10">
                  <div className="flex items-center gap-6 mb-2">
                    <div className="w-16 h-16 rounded-[1.5rem] bg-stitch-primary/10 flex items-center justify-center text-stitch-primary shadow-inner">
                      <span className="material-symbols-outlined text-4xl">storefront</span>
                    </div>
                    <div>
                      <CardTitle className="text-3xl font-black font-headline text-stitch-on-surface">Dados do Negócio</CardTitle>
                      <CardDescription className="text-sm font-bold text-stitch-on-surface-variant">Como seus clientes identificam sua marca.</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-12 pt-0 space-y-10 relative z-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-3">
                      <Label htmlFor="orgName" className="text-xs font-black uppercase tracking-widest text-stitch-on-surface-variant ml-2">Nome Comercial</Label>
                      <Input
                        id="orgName"
                        className="h-16 px-6 rounded-2xl border border-stitch-outline-variant/20 bg-stitch-surface-container text-stitch-on-surface font-black text-lg placeholder:text-stitch-on-surface-variant/30 shadow-inner focus-visible:ring-2 focus-visible:ring-stitch-primary/50 transition-all"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ex: Studio Alessa"
                      />
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="orgSlug" className="text-xs font-black uppercase tracking-widest text-stitch-on-surface-variant ml-2">URL do Catálogo (Slug)</Label>
                      <div className="flex items-center gap-3">
                        <div className="h-16 px-5 rounded-2xl bg-stitch-surface-container border border-stitch-outline-variant/20 flex items-center text-stitch-primary font-black text-xs xl:text-sm shadow-sm backdrop-blur-sm">
                          agendafacil.io/p/
                        </div>
                        <Input
                          id="orgSlug"
                          className="h-16 flex-1 px-6 rounded-2xl border border-stitch-outline-variant/20 bg-stitch-surface-container text-stitch-on-surface font-black text-lg placeholder:text-stitch-on-surface-variant/30 shadow-inner focus-visible:ring-2 focus-visible:ring-stitch-primary/50 transition-all min-w-0"
                          value={slug}
                          onChange={(e) => {
                            setSlug(normalizeSlug(e.target.value));
                            setSlugError("");
                          }}
                          placeholder="studio-alessa"
                        />
                      </div>
                      {slugError && (
                        <p className="text-[11px] font-black uppercase tracking-wider text-stitch-error ml-2">{slugError}</p>
                      )}
                    </div>
                  </div>

                  <div className="pt-6 flex justify-end">
                    <Button onClick={handleUpdateCompany} disabled={loading} className="h-18 px-14 rounded-[2rem] font-black text-xl shadow-2xl shadow-stitch-primary/30 transition-all hover:scale-[1.05] active:scale-95 bg-stitch-primary text-stitch-on-primary border-0">
                      {loading ? (
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 border-3 border-stitch-on-primary/30 border-t-stitch-on-primary rounded-full animate-spin" />
                          Processando...
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <span className="material-symbols-outlined text-2xl">verified_user</span>
                          Salvar Identidade
                        </div>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Link to="/dashboard/services" className="group">
                  <Card className="rounded-[2.5rem] p-10 bg-stitch-surface-container-low border border-stitch-outline-variant/20 hover:bg-stitch-primary/5 transition-all shadow-xl hover:shadow-2xl relative overflow-hidden h-full">
                    <div className="relative z-10 flex items-center gap-8">
                      <div className="w-16 h-16 bg-stitch-primary/10 rounded-2xl flex items-center justify-center text-stitch-primary shadow-sm group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
                        <span className="material-symbols-outlined text-4xl">content_cut</span>
                      </div>
                      <div>
                        <h4 className="text-xl font-black font-headline text-stitch-on-surface mb-1">Catálogo de Serviços</h4>
                        <p className="text-sm text-stitch-on-surface-variant font-bold">Gerencie preços, tempos e categorias.</p>
                      </div>
                    </div>
                    <span className="material-symbols-outlined absolute -right-6 -bottom-6 text-9xl text-stitch-primary opacity-5 group-hover:opacity-10 transition-opacity">content_cut</span>
                  </Card>
                </Link>

                <Link to="/dashboard/employees" className="group">
                  <Card className="rounded-[2.5rem] p-10 bg-stitch-surface-container-low border border-stitch-outline-variant/20 hover:bg-stitch-secondary/5 transition-all shadow-xl hover:shadow-2xl relative overflow-hidden h-full">
                    <div className="relative z-10 flex items-center gap-8">
                      <div className="w-16 h-16 bg-stitch-secondary/10 rounded-2xl flex items-center justify-center text-stitch-secondary shadow-sm group-hover:scale-110 group-hover:-rotate-6 transition-all duration-500">
                        <span className="material-symbols-outlined text-4xl">badge</span>
                      </div>
                      <div>
                        <h4 className="text-xl font-black font-headline text-stitch-on-surface mb-1">Equipe Profissional</h4>
                        <p className="text-sm text-stitch-on-surface-variant font-bold">Controle permissões e horários.</p>
                      </div>
                    </div>
                    <span className="material-symbols-outlined absolute -right-6 -bottom-6 text-9xl text-stitch-secondary opacity-5 group-hover:opacity-10 transition-opacity">badge</span>
                  </Card>
                </Link>
              </div>
            </div>

            <div className="xl:col-span-4 space-y-10">
              <Card className="rounded-[3rem] p-12 bg-stitch-primary/5 border-2 border-stitch-primary/10 relative overflow-hidden transition-all hover:bg-stitch-primary/10 group h-full flex flex-col justify-center">
                <div className="relative z-10 text-center space-y-8">
                  <div className="w-24 h-24 bg-stitch-primary/20 rounded-[2rem] mx-auto flex items-center justify-center text-stitch-primary shadow-lg transform group-hover:rotate-12 transition-transform duration-700">
                    <span className="material-symbols-outlined text-5xl">auto_awesome</span>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-stitch-primary font-black uppercase tracking-[0.3em] text-xs">Sucesso do Cliente</h4>
                    <p className="text-stitch-on-surface font-black text-2xl leading-tight font-headline">
                      Complete seu perfil para vender mais
                    </p>
                    <p className="text-stitch-on-surface-variant font-bold text-sm leading-relaxed">
                      Um perfil completo com logo e descrição passa 3x mais confiança para novos agendamentos online.
                    </p>
                  </div>
                  <Button className="w-full h-14 rounded-2xl font-black bg-stitch-primary text-stitch-on-primary hover:scale-105 transition-all shadow-xl shadow-stitch-primary/20" onClick={() => setActiveTab("appearance")}>
                    Personalizar Estilo
                  </Button>
                </div>
                <div className="absolute -top-40 -left-40 w-80 h-80 bg-stitch-primary/20 rounded-full blur-[100px] pointer-events-none" />
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="appearance" className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          <ThemeCustomizationContent />
        </TabsContent>

        <TabsContent value="billing" className="animate-in fade-in slide-in-from-bottom-2 duration-500">
           <Link to="/dashboard/subscription" className="block outline-none">
            <Card className="rounded-[3rem] bg-stitch-surface-container-highest dark:bg-[#0f1113] p-12 shadow-none hover:shadow-none relative overflow-hidden group border-none transition-all hover:scale-[1.01]">
              <div className="relative z-10 max-w-lg">
                <Badge className="bg-stitch-primary text-stitch-on-primary border-0 px-6 py-1.5 rounded-full mb-8 font-black uppercase tracking-[0.2em] text-[10px] shadow-none">
                    {company?.plan_name ? company.plan_name.toUpperCase() : "FREE TRIAL"}
                </Badge>
                <h3 className="text-5xl font-black font-headline mb-4 tracking-tighter text-stitch-on-surface">Assinatura Premium</h3>
                <p className="text-xl font-bold text-stitch-on-surface-variant mb-10 leading-relaxed">
                  Gerencie seu plano, faturas e métodos de pagamento com segurança através do Stripe.
                </p>
                <div className="flex gap-4">
                  <Button className="bg-stitch-primary text-stitch-on-primary h-16 px-10 rounded-2xl font-black text-lg hover:scale-105 transition-all shadow-none">
                    {company?.subscription_status === 'active' ? "Gerenciar Assinatura" : "Ver Planos & Ativar"}
                  </Button>
                </div>
              </div>

              <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:scale-125 transition-transform duration-1000">
                <span className="material-symbols-outlined text-[300px] text-stitch-primary">workspace_premium</span>
              </div>
              <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-stitch-primary/10 rounded-full blur-[100px]" />
            </Card>
           </Link>
        </TabsContent>
      </Tabs>
    </div>
  );
}
