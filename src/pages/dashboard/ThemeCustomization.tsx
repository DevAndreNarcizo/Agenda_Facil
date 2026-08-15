import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';

export default function ThemeCustomization() {
  const { profile, loading: authLoading } = useAuth();
  const [primaryColor, setPrimaryColor] = useState('#5343d4');
  const [secondaryColor, setSecondaryColor] = useState('#00616f');
  const [accentColor, setAccentColor] = useState('#ae5b70');
  const [logoUrl, setLogoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingTheme, setLoadingTheme] = useState(true);

  useEffect(() => {
    if (authLoading) return; // Aguarda a autenticação inicial

    const organizationId = profile?.organization_id;
    if (!organizationId) {
      setLoadingTheme(false); // Remove o loading infinito
      return;
    }

    const fetchTheme = async () => {
      try {
        const { data, error } = await supabase
          .from("organizations")
          .select('primary_color, secondary_color, accent_color, logo_url')
          .eq('id', organizationId)
          .single();

        if (error) throw error;

        if (data) {
          setPrimaryColor(data.primary_color || '#5343d4');
          setSecondaryColor(data.secondary_color || '#00616f');
          setAccentColor(data.accent_color || '#ae5b70');
          setLogoUrl(data.logo_url || '');
        }
      } catch (error) {
        console.error('Error fetching theme:', error);
      } finally {
        setLoadingTheme(false);
      }
    };

    fetchTheme();
  }, [profile, authLoading]);

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
    } catch (error) {
      console.error('Error updating theme:', error);
      toast.error('Erro ao atualizar tema');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setPrimaryColor('#5343d4');
    setSecondaryColor('#00616f');
    setAccentColor('#ae5b70');
    setLogoUrl('');
  };

  if (loadingTheme) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-stitch-primary/20 border-t-stitch-primary rounded-full animate-spin" />
        <p className="font-bold text-stitch-on-surface-variant font-headline">Carregando estúdio...</p>
      </div>
    );
  }

  if (!profile?.organization_id) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
        <div className="w-20 h-20 bg-stitch-error/10 text-stitch-error rounded-[2rem] flex items-center justify-center">
          <span className="material-symbols-outlined text-4xl font-black">database_off</span>
        </div>
        <div className="max-w-md space-y-2">
          <h2 className="font-headline font-black text-2xl text-stitch-on-surface">Opa! Acesso Restrito</h2>
          <p className="text-stitch-on-surface-variant font-medium">As regras de segurança (RLS) do seu banco de dados foram apagadas mas ainda não foram recriadas corretamente.</p>
        </div>
        <div className="bg-stitch-primary/10 text-stitch-primary p-6 rounded-2xl max-w-lg text-left border border-stitch-primary/20">
          <p className="font-bold mb-2">Um último passo urgente no Supabase:</p>
          <ol className="list-decimal pl-4 space-y-2 text-sm">
            <li>Abra o VSCode e copie TODO o código do arquivo <code className="bg-stitch-primary/20 px-1 rounded font-black">supabase/fix_all_rls.sql</code>.</li>
            <li>Vá no <strong>Supabase</strong> {'>'} SQL Editor.</li>
            <li>Cole o código inteiro (apague o que havia antes) e aperte <strong>RUN</strong>.</li>
            <li>Após o "Success", recarregue esta página!</li>
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12 p-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-end">
        <div>
          <p className="text-stitch-on-surface-variant text-sm font-medium mb-1 uppercase tracking-wider">Branding & UI</p>
          <h1 className="font-headline text-4xl font-black tracking-tight text-stitch-on-surface">Identidade Visual</h1>
        </div>
        <div className="flex gap-3">
           <Button variant="outline" onClick={handleReset} className="h-12 px-6 rounded-xl font-bold border-stitch-outline-variant/20">Resetar</Button>
           <Button onClick={handleSave} disabled={loading} className="h-12 px-8 rounded-xl font-black shadow-lg shadow-stitch-primary/20">
             {loading ? 'Salvando...' : 'Aplicar Mudanças'}
           </Button>
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-8">
          <Card className="rounded-[2.5rem] p-8 border-stitch-outline-variant/10 shadow-sm bg-white">
            <CardHeader className="p-0 mb-8">
              <CardTitle className="text-2xl font-black font-headline">Cores da Marca</CardTitle>
              <CardDescription>Defina a paleta principal do seu sistema e portal.</CardDescription>
            </CardHeader>
            <CardContent className="p-0 space-y-8">
              <div className="space-y-4">
                <Label className="text-sm font-bold ml-1 text-stitch-on-surface-variant">Cor Primária</Label>
                <div className="flex gap-4 p-4 rounded-3xl bg-stitch-surface-container-lowest border border-stitch-outline-variant/10 shadow-inner group">
                  <Input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-16 h-16 rounded-2xl cursor-pointer border-0 p-0 overflow-hidden shadow-md group-hover:scale-105 transition-transform" />
                  <div className="flex-1 space-y-1">
                    <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-10 border-0 bg-transparent font-mono font-black text-lg focus-visible:ring-0 px-0" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-stitch-on-surface-variant opacity-40">Main Action Color</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <Label className="text-sm font-bold ml-1 text-stitch-on-surface-variant">Cor Secundária</Label>
                <div className="flex gap-4 p-4 rounded-3xl bg-stitch-surface-container-lowest border border-stitch-outline-variant/10 shadow-inner group">
                  <Input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="w-16 h-16 rounded-2xl cursor-pointer border-0 p-0 overflow-hidden shadow-md group-hover:scale-105 transition-transform" />
                  <div className="flex-1 space-y-1">
                    <Input value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="h-10 border-0 bg-transparent font-mono font-black text-lg focus-visible:ring-0 px-0" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-stitch-on-surface-variant opacity-40">Surface accents</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <Label className="text-sm font-bold ml-1 text-stitch-on-surface-variant">Cor de Destaque</Label>
                <div className="flex gap-4 p-4 rounded-3xl bg-stitch-surface-container-lowest border border-stitch-outline-variant/10 shadow-inner group">
                  <Input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="w-16 h-16 rounded-2xl cursor-pointer border-0 p-0 overflow-hidden shadow-md group-hover:scale-105 transition-transform" />
                  <div className="flex-1 space-y-1">
                    <Input value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="h-10 border-0 bg-transparent font-mono font-black text-lg focus-visible:ring-0 px-0" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-stitch-on-surface-variant opacity-40">Success & Highlights</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[2.5rem] p-8 bg-stitch-surface-container-lowest border border-stitch-outline-variant/10">
             <div className="space-y-4">
                <Label className="text-sm font-bold ml-1 text-stitch-on-surface-variant">Link do Logo (Imagem)</Label>
                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-stitch-primary opacity-50">link</span>
                  <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://exemplo.com/logo.png" className="h-14 pl-12 rounded-2xl border-stitch-outline-variant/20 bg-white" />
                </div>
                <p className="text-[11px] text-stitch-on-surface-variant opacity-60 ml-2 italic">Recomendamos fundos transparentes (PNG/SVG).</p>
             </div>
          </Card>
        </div>

        <div className="lg:col-span-3 space-y-8">
          <Card className="rounded-[3rem] p-10 bg-stitch-surface-container-lowest border border-stitch-outline-variant/10 shadow-sm relative overflow-hidden h-full">
            <div className="relative z-10 h-full flex flex-col">
              <div className="mb-10 text-center">
                <h3 className="text-3xl font-black font-headline tracking-tighter mb-2">Omni Preview</h3>
                <p className="text-stitch-on-surface-variant font-medium opacity-60 text-sm">Veja como os componentes reagem em tempo real</p>
              </div>

              <div className="flex-1 flex flex-col justify-center space-y-12">
                {/* Simulated Header */}
                <div className="p-6 rounded-3xl bg-white shadow-sm border border-stitch-outline-variant/5 flex items-center justify-between">
                   <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-xl" style={{ backgroundColor: primaryColor }}>
                     {logoUrl ? <img src={logoUrl} alt="Logo" className="w-6 h-6 object-contain" /> : "A"}
                   </div>
                   <div className="flex gap-4">
                     <div className="w-24 h-3 rounded-full bg-stitch-surface-container opacity-50" />
                     <div className="w-16 h-3 rounded-full bg-stitch-surface-container opacity-50" />
                   </div>
                </div>

                {/* Simulated Content */}
                <div className="grid grid-cols-2 gap-6">
                   <div className="p-8 rounded-[2rem] bg-white shadow-md border-l-8" style={{ borderLeftColor: primaryColor }}>
                      <div className="w-12 h-2 rounded-full mb-3 opacity-20" style={{ backgroundColor: primaryColor }} />
                      <div className="w-20 h-5 rounded-lg mb-1" style={{ backgroundColor: primaryColor }} />
                   </div>
                   <div className="p-8 rounded-[2rem] bg-white shadow-md border-l-8" style={{ borderLeftColor: secondaryColor }}>
                      <div className="w-12 h-2 rounded-full mb-3 opacity-20" style={{ backgroundColor: secondaryColor }} />
                      <div className="w-20 h-5 rounded-lg mb-1" style={{ backgroundColor: secondaryColor }} />
                   </div>
                </div>

                {/* Action Controls */}
                <div className="space-y-6">
                   <Button className="w-full h-16 rounded-2xl font-black text-xl shadow-xl transition-all" style={{ backgroundColor: primaryColor, color: 'white' }}>
                     Botão de Exemplo
                   </Button>
                   <div className="flex justify-center gap-4">
                      <div className="px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest text-white" style={{ backgroundColor: accentColor }}>Sucesso</div>
                      <div className="px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest text-white" style={{ backgroundColor: secondaryColor }}>Info</div>
                   </div>
                </div>
              </div>
            </div>
            {/* Background patterns */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-stitch-primary/5 rounded-full blur-[100px] -mr-32 -mt-32 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-stitch-secondary/5 rounded-full blur-[100px] -ml-32 -mb-32 pointer-events-none" />
          </Card>
        </div>
      </div>
    </div>
  );
}
