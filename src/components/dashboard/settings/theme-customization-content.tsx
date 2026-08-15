import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

export function ThemeCustomizationContent() {
  const { profile } = useAuth();
  const [primaryColor, setPrimaryColor] = useState('#5343d4');
  const [secondaryColor, setSecondaryColor] = useState('#00616f');
  const [accentColor, setAccentColor] = useState('#ae5b70');
  const [logoUrl, setLogoUrl] = useState('');
  const [slug, setSlug] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingTheme, setLoadingTheme] = useState(true);

  useEffect(() => {
    const organizationId = profile?.organization_id;
    if (!organizationId) {
      setLoadingTheme(false);
      return;
    }

    const fetchTheme = async () => {
      try {
        const { data, error } = await supabase
          .from("organizations")
          .select('primary_color, secondary_color, accent_color, logo_url, slug')
          .eq('id', organizationId)
          .single();

        if (error) throw error;

        if (data) {
          setPrimaryColor(data.primary_color || '#5343d4');
          setSecondaryColor(data.secondary_color || '#00616f');
          setAccentColor(data.accent_color || '#ae5b70');
          setLogoUrl(data.logo_url || '');
          setSlug(data.slug || '');
        }
      } catch {
        toast.error('Erro ao carregar tema.');
      } finally {
        setLoadingTheme(false);
      }
    };

    fetchTheme();
  }, [profile]);

  const handleSave = async () => {
    if (!profile?.organization_id) {
      toast.error('Organização não encontrada');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("organizations")
        .update({
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          accent_color: accentColor,
          logo_url: logoUrl || null
        })
        .eq('id', profile.organization_id);

      if (error) throw error;

      const root = document.documentElement;
      root.style.setProperty('--primary', primaryColor);
      root.style.setProperty('--secondary', secondaryColor);
      root.style.setProperty('--accent', accentColor);

      toast.success('Identidade visual atualizada!');
    } catch {
      toast.error('Erro ao atualizar tema');
    } finally {
      setLoading(false);
    }
  };


  if (loadingTheme) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
        <div className="w-10 h-10 border-4 border-stitch-primary/20 border-t-stitch-primary rounded-full animate-spin" />
        <p className="font-bold text-stitch-on-surface-variant font-headline">Carregando estúdio...</p>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-stitch-surface-container-low/20 p-8 rounded-[2rem] border border-white/5">
        <div>
          <Badge className="bg-stitch-primary/10 text-stitch-primary border-0 px-4 py-1 rounded-full mb-3 font-bold uppercase tracking-widest text-[10px]">Portal de Agendamentos</Badge>
          <h2 className="text-3xl font-black font-headline text-stitch-on-surface mb-2 tracking-tight">Estúdio de Design</h2>
          <p className="text-stitch-on-surface-variant font-medium max-w-xl leading-relaxed">
            Personalize a interface que seus clientes verão ao agendar. Escolha cores que transmitam a identidade da sua marca.
          </p>
        </div>
        <div className="flex flex-wrap gap-4">
           {slug && (
             <Button variant="outline" asChild className="h-14 px-8 rounded-xl font-bold border-white/10 hover:bg-white/5 gap-2">
               <a href={`/p/${slug}`} target="_blank" rel="noopener noreferrer">
                 <span className="material-symbols-outlined text-lg">open_in_new</span>
                 Ver Meu Portal
               </a>
             </Button>
           )}
           <Button onClick={handleSave} disabled={loading} className="h-14 px-10 rounded-xl font-black shadow-xl shadow-stitch-primary/30 transition-all hover:scale-[1.05] active:scale-95 bg-stitch-primary text-white">
             {loading ? 'Salvando...' : 'Salvar Alterações'}
           </Button>
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-8">
          <Card className="rounded-[2.5rem] border-none shadow-xl bg-stitch-surface-container-low/30 backdrop-blur-md overflow-hidden p-8 border border-white/5">
            <CardHeader className="p-0 mb-8">
              <CardTitle className="text-xl font-black font-headline text-stitch-on-surface">Cores da Marca</CardTitle>
              <CardDescription className="font-bold opacity-60">Escolha a paleta que define seu negócio.</CardDescription>
            </CardHeader>
            <CardContent className="p-0 space-y-8">
              <div className="space-y-4">
                <Label className="text-xs font-black uppercase tracking-widest text-stitch-on-surface-variant ml-1">Cor Primária</Label>
                <div className="flex gap-4 p-4 rounded-3xl bg-[#1a1c1e] border border-white/5 shadow-inner group transition-all hover:border-white/10">
                  <Input 
                    type="color" 
                    value={primaryColor} 
                    onChange={(e) => setPrimaryColor(e.target.value)} 
                    className="w-16 h-16 rounded-2xl cursor-pointer border-0 p-0 overflow-hidden shadow-2xl group-hover:scale-105 transition-transform bg-transparent" 
                  />
                  <div className="flex-1 space-y-1 flex flex-col justify-center">
                    <Input 
                      value={primaryColor} 
                      onChange={(e) => setPrimaryColor(e.target.value)} 
                      className="h-10 border-0 bg-transparent font-mono font-black text-xl focus-visible:ring-0 px-0 text-white" 
                    />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">Destaques e Botões Principais</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <Label className="text-xs font-black uppercase tracking-widest text-stitch-on-surface-variant ml-1">Secundária</Label>
                  <div className="flex gap-3 p-3 rounded-2xl bg-[#1a1c1e] border border-white/5 group transition-all">
                    <Input 
                      type="color" 
                      value={secondaryColor} 
                      onChange={(e) => setSecondaryColor(e.target.value)} 
                      className="w-10 h-10 rounded-lg cursor-pointer border-0 p-0 bg-transparent" 
                    />
                    <Input 
                      value={secondaryColor} 
                      onChange={(e) => setSecondaryColor(e.target.value)} 
                      className="h-10 border-0 bg-transparent font-mono font-bold text-sm focus-visible:ring-0 px-0 text-white" 
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <Label className="text-xs font-black uppercase tracking-widest text-stitch-on-surface-variant ml-1">Destaque</Label>
                  <div className="flex gap-3 p-3 rounded-2xl bg-[#1a1c1e] border border-white/5 group transition-all">
                    <Input 
                      type="color" 
                      value={accentColor} 
                      onChange={(e) => setAccentColor(e.target.value)} 
                      className="w-10 h-10 rounded-lg cursor-pointer border-0 p-0 bg-transparent" 
                    />
                    <Input 
                      value={accentColor} 
                      onChange={(e) => setAccentColor(e.target.value)} 
                      className="h-10 border-0 bg-transparent font-mono font-bold text-sm focus-visible:ring-0 px-0 text-white" 
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[2.5rem] border-none shadow-xl bg-stitch-surface-container-low/30 backdrop-blur-md overflow-hidden p-8 border border-white/5">
             <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-xl font-black font-headline text-stitch-on-surface">Logo da Empresa</Label>
                  <span className="material-symbols-outlined text-stitch-on-surface-variant opacity-40">image</span>
                </div>
                <p className="text-sm font-bold opacity-60 text-stitch-on-surface-variant">Insira o link da imagem do seu logotipo (URL).</p>
                <div className="relative group mt-4">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-stitch-primary opacity-50">link</span>
                  <Input 
                    value={logoUrl} 
                    onChange={(e) => setLogoUrl(e.target.value)} 
                    placeholder="https://suaempresa.com/logo.png" 
                    className="h-14 pl-12 rounded-2xl border-none bg-[#1a1c1e] text-white font-bold" 
                  />
                </div>
                <div className="flex items-center gap-3 p-4 bg-stitch-primary/5 rounded-2xl border border-stitch-primary/10 mt-2">
                   <span className="material-symbols-outlined text-stitch-primary">info</span>
                   <p className="text-[11px] text-stitch-primary font-bold italic leading-tight">Dica: Use logos em PNG com fundo transparente para um visual mais elegante.</p>
                </div>
             </div>
          </Card>
        </div>

        <div className="lg:col-span-3 space-y-8">
          <Card className="rounded-[3rem] p-10 bg-[#0f1113] border-none shadow-2xl relative overflow-hidden h-full ring-1 ring-white/10">
            <div className="relative z-10 h-full flex flex-col">
              <div className="mb-10 text-center">
                <Badge className="bg-white/5 text-white/50 border-white/10 px-4 py-1 rounded-full mb-3 font-bold tracking-[0.2em] text-[8px] uppercase">Página Pública do Cliente</Badge>
                <h3 className="text-2xl font-black font-headline text-white tracking-tight">Visualize o Resultado</h3>
              </div>

              <div className="flex-1 flex flex-col justify-center space-y-10">
                {/* Simulated Header */}
                <div className="p-5 rounded-[2rem] bg-white/5 border border-white/10 flex items-center justify-between backdrop-blur-md">
                   <div className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-white text-xl shadow-lg" style={{ backgroundColor: primaryColor }}>
                     {logoUrl ? <img src={logoUrl} alt="Logo" className="w-8 h-8 object-contain" /> : "A"}
                   </div>
                   <div className="flex gap-4">
                     <div className="w-20 h-2 rounded-full bg-white/20" />
                     <div className="w-12 h-2 rounded-full bg-white/10" />
                   </div>
                </div>

                {/* Simulated Content */}
                <div className="space-y-6">
                   <div className="p-6 rounded-[2rem] bg-white/5 border border-white/5 flex items-center justify-between group">
                      <div className="flex items-center gap-4">
                         <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center">
                           <span className="material-symbols-outlined text-white/40">content_cut</span>
                         </div>
                         <div>
                            <div className="w-24 h-3 rounded-full mb-2 bg-white/30" />
                            <div className="w-16 h-2 rounded-full bg-white/10" />
                         </div>
                      </div>
                      <div className="w-10 h-10 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center" style={{ color: primaryColor }}>
                        <span className="material-symbols-outlined text-xs">add</span>
                      </div>
                   </div>

                   <div className="flex flex-col gap-4">
                      <Button className="w-full h-16 rounded-[1.5rem] font-black text-lg shadow-2xl transition-all" style={{ backgroundColor: primaryColor, color: 'white' }}>
                        Agendar Horário
                      </Button>
                      <div className="flex justify-center gap-6">
                         <div className="flex items-center gap-2">
                           <div className="w-2 h-2 rounded-full" style={{ backgroundColor: accentColor }} />
                           <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Aberto</span>
                         </div>
                         <div className="flex items-center gap-2">
                           <div className="w-2 h-2 rounded-full" style={{ backgroundColor: secondaryColor }} />
                           <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Suporte 24h</span>
                         </div>
                      </div>
                   </div>
                </div>
              </div>

              <div className="mt-10 text-center">
                 <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20">Design By AgendaFácil Premium</p>
              </div>
            </div>
            {/* Ambient glows */}
            <div className="absolute top-0 right-0 w-80 h-80 rounded-full blur-[120px] -mr-40 -mt-40 opacity-20 pointer-events-none transition-colors duration-1000" style={{ backgroundColor: primaryColor }} />
            <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full blur-[120px] -ml-40 -mb-40 opacity-20 pointer-events-none transition-colors duration-1000" style={{ backgroundColor: secondaryColor }} />
          </Card>
        </div>
      </div>
    </div>
  );
}
