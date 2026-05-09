import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { applyOrganizationBrandTheme } from '@/lib/theme';

export function ThemeCustomizationContent() {
  const { profile } = useAuth();
  const [primaryColor, setPrimaryColor] = useState('#5343d4');
  const [secondaryColor, setSecondaryColor] = useState('#00616f');
  const [accentColor, setAccentColor] = useState('#ae5b70');
  const [logoUrl, setLogoUrl] = useState('');
  const [slug, setSlug] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingTheme, setLoadingTheme] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!profile?.organization_id) {
      setLoadingTheme(false);
      return;
    }

    const fetchTheme = async () => {
      try {
        const { data, error } = await supabase
          .from("organizations")
          .select('primary_color, secondary_color, accent_color, logo_url, slug')
          .eq('id', profile.organization_id)
          .single();

        if (error) throw error;

        if (data) {
          setPrimaryColor(data.primary_color || '#5343d4');
          setSecondaryColor(data.secondary_color || '#00616f');
          setAccentColor(data.accent_color || '#ae5b70');
          setLogoUrl(data.logo_url || '');
          setSlug(data.slug || '');
          applyOrganizationBrandTheme({
            primaryColor: data.primary_color,
            secondaryColor: data.secondary_color,
            accentColor: data.accent_color,
          });
        }
      } catch {
        toast.error('Erro ao carregar tema.');
      } finally {
        setLoadingTheme(false);
      }
    };

    fetchTheme();
  }, [profile]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.organization_id) return;

    // Validar tipo
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione um arquivo de imagem (PNG, JPG, SVG, etc.)');
      return;
    }

    // Validar tamanho (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB.');
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const filePath = `${profile.organization_id}/logo.${ext}`;

      // Upload para Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        // Se o bucket não existir, informar
        if (uploadError.message?.includes('not found') || uploadError.message?.includes('Bucket')) {
          toast.error('Bucket "logos" não encontrado no Supabase Storage. Crie-o no painel do Supabase.');
          return;
        }
        throw uploadError;
      }

      // Gerar URL pública
      const { data: urlData } = supabase.storage
        .from('logos')
        .getPublicUrl(filePath);

      if (urlData?.publicUrl) {
        // Adicionar timestamp para invalidar cache
        const freshUrl = `${urlData.publicUrl}?t=${Date.now()}`;
        setLogoUrl(freshUrl);
        toast.success('Logo enviada com sucesso!');
      }
    } catch {
      toast.error('Erro ao fazer upload da imagem.');
    } finally {
      setUploading(false);
      // Limpar input para permitir reupload do mesmo arquivo
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

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

      applyOrganizationBrandTheme({
        primaryColor,
        secondaryColor,
        accentColor,
      });

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
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-stitch-surface-container/50 p-8 rounded-[2rem] border border-stitch-outline-variant/20">
        <div>
          <Badge className="bg-stitch-primary/10 text-stitch-primary border-0 px-4 py-1 rounded-full mb-3 font-bold uppercase tracking-widest text-[10px]">Portal de Agendamentos</Badge>
          <h2 className="text-3xl font-black font-headline text-stitch-on-surface mb-2 tracking-tight">Estúdio de Design</h2>
          <p className="text-stitch-on-surface-variant font-medium max-w-xl leading-relaxed">
            Personalize a interface que seus clientes verão ao agendar. Escolha cores que transmitam a identidade da sua marca.
          </p>
        </div>
        <div className="flex flex-wrap gap-4">
           {slug && (
             <Button variant="outline" asChild className="h-14 px-8 rounded-xl font-bold border-stitch-outline-variant/30 hover:bg-stitch-surface-container gap-2">
               <Link to={`/p/${slug}`} target="_blank" rel="noopener noreferrer">
                 <span className="material-symbols-outlined text-lg">open_in_new</span>
                 Ver Meu Portal
               </Link>
             </Button>
           )}
           <Button onClick={handleSave} disabled={loading} className="h-14 px-10 rounded-xl font-black shadow-xl shadow-stitch-primary/30 transition-all hover:scale-[1.05] active:scale-95 bg-stitch-primary text-stitch-on-primary">
             {loading ? 'Salvando...' : 'Salvar Alterações'}
           </Button>
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-5">
        {/* Left Column - Color Pickers */}
        <div className="lg:col-span-2 space-y-8">
          <Card className="rounded-[2.5rem] border border-stitch-outline-variant/20 shadow-xl bg-stitch-surface-container-low overflow-hidden p-8">
            <CardHeader className="p-0 mb-8">
              <CardTitle className="text-xl font-black font-headline text-stitch-on-surface">Cores da Marca</CardTitle>
              <CardDescription className="font-bold text-stitch-on-surface-variant">Escolha a paleta que define seu negócio.</CardDescription>
            </CardHeader>
            <CardContent className="p-0 space-y-8">
              {/* Primary Color */}
              <div className="space-y-4">
                <Label className="text-xs font-black uppercase tracking-widest text-stitch-on-surface-variant ml-1">Cor Primária</Label>
                <div className="flex gap-4 p-4 rounded-3xl bg-stitch-surface-container border border-stitch-outline-variant/20 shadow-inner group transition-all hover:border-stitch-outline-variant/40">
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
                      className="h-10 border-0 bg-transparent font-mono font-black text-xl focus-visible:ring-0 px-0 text-stitch-on-surface"
                    />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-stitch-on-surface-variant">Destaques e Botões Principais</p>
                  </div>
                </div>
              </div>

              {/* Secondary & Accent */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <Label className="text-xs font-black uppercase tracking-widest text-stitch-on-surface-variant ml-1">Secundária</Label>
                  <div className="flex gap-3 p-3 rounded-2xl bg-stitch-surface-container border border-stitch-outline-variant/20 group transition-all">
                    <Input
                      type="color"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="w-10 h-10 rounded-lg cursor-pointer border-0 p-0 bg-transparent"
                    />
                    <Input
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="h-10 border-0 bg-transparent font-mono font-bold text-sm focus-visible:ring-0 px-0 text-stitch-on-surface"
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <Label className="text-xs font-black uppercase tracking-widest text-stitch-on-surface-variant ml-1">Destaque</Label>
                  <div className="flex gap-3 p-3 rounded-2xl bg-stitch-surface-container border border-stitch-outline-variant/20 group transition-all">
                    <Input
                      type="color"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="w-10 h-10 rounded-lg cursor-pointer border-0 p-0 bg-transparent"
                    />
                    <Input
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="h-10 border-0 bg-transparent font-mono font-bold text-sm focus-visible:ring-0 px-0 text-stitch-on-surface"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Logo Card */}
          <Card className="rounded-[2.5rem] border border-stitch-outline-variant/20 shadow-xl bg-stitch-surface-container-low overflow-hidden p-8">
             <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <Label className="text-xl font-black font-headline text-stitch-on-surface">Logo da Empresa</Label>
                  <span className="material-symbols-outlined text-stitch-on-surface-variant opacity-40">image</span>
                </div>

                {/* Preview da logo atual */}
                {logoUrl && (
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-stitch-surface-container border border-stitch-outline-variant/20">
                    <img src={logoUrl} alt="Logo atual" className="w-16 h-16 object-contain rounded-xl bg-stitch-surface-container-highest p-1" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-stitch-on-surface truncate">Logo atual</p>
                      <p className="text-xs text-stitch-on-surface-variant truncate">{logoUrl}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setLogoUrl('')} className="text-stitch-on-surface-variant hover:text-red-500 shrink-0">
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </Button>
                  </div>
                )}

                {/* Upload de arquivo */}
                <div className="space-y-3">
                  <p className="text-sm font-bold text-stitch-on-surface-variant">Envie uma imagem do seu dispositivo</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="logo-upload"
                  />
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full h-16 rounded-2xl border-2 border-dashed border-stitch-outline-variant/30 hover:border-stitch-primary/50 hover:bg-stitch-primary/5 transition-all gap-3 font-bold text-stitch-on-surface-variant"
                  >
                    {uploading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-stitch-primary/30 border-t-stitch-primary rounded-full animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-xl">cloud_upload</span>
                        Escolher Imagem
                      </>
                    )}
                  </Button>
                  <p className="text-[11px] text-stitch-on-surface-variant text-center">PNG, JPG ou SVG. Máximo 5MB.</p>
                </div>

                {/* OU URL manual */}
                <div className="flex items-center gap-3 my-2">
                  <div className="flex-1 h-px bg-stitch-outline-variant/20" />
                  <span className="text-xs font-bold text-stitch-on-surface-variant uppercase">ou cole uma URL</span>
                  <div className="flex-1 h-px bg-stitch-outline-variant/20" />
                </div>

                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-stitch-primary opacity-50">link</span>
                  <Input
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://suaempresa.com/logo.png"
                    className="h-14 pl-12 rounded-2xl border border-stitch-outline-variant/20 bg-stitch-surface-container text-stitch-on-surface font-bold"
                  />
                </div>

                <div className="flex items-center gap-3 p-4 bg-stitch-primary/5 rounded-2xl border border-stitch-primary/10">
                   <span className="material-symbols-outlined text-stitch-primary">info</span>
                   <p className="text-[11px] text-stitch-primary font-bold italic leading-tight">Dica: Use logos em PNG com fundo transparente para um visual mais elegante.</p>
                </div>
             </div>
          </Card>
        </div>

        {/* Right Column - Preview */}
        <div className="lg:col-span-3 space-y-8">
          <Card className="rounded-[3rem] p-10 bg-stitch-surface-container-highest dark:bg-[#0f1113] border border-stitch-outline-variant/20 shadow-2xl relative overflow-hidden h-full">
            <div className="relative z-10 h-full flex flex-col">
              <div className="mb-10 text-center">
                <Badge className="bg-stitch-on-surface/5 text-stitch-on-surface-variant border-stitch-outline-variant/20 px-4 py-1 rounded-full mb-3 font-bold tracking-[0.2em] text-[8px] uppercase">Página Pública do Cliente</Badge>
                <h3 className="text-2xl font-black font-headline text-stitch-on-surface tracking-tight">Visualize o Resultado</h3>
              </div>

              <div className="flex-1 flex flex-col justify-center space-y-10">
                {/* Simulated Header */}
                <div className="p-5 rounded-[2rem] bg-stitch-on-surface/5 border border-stitch-outline-variant/20 flex items-center justify-between backdrop-blur-md">
                   <div className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-white text-xl shadow-lg overflow-hidden" style={{ backgroundColor: primaryColor }}>
                     {logoUrl ? <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" /> : "A"}
                   </div>
                   <div className="flex gap-4">
                     <div className="w-20 h-2 rounded-full bg-stitch-on-surface/20" />
                     <div className="w-12 h-2 rounded-full bg-stitch-on-surface/10" />
                   </div>
                </div>

                {/* Simulated Content */}
                <div className="space-y-6">
                   <div className="p-6 rounded-[2rem] bg-stitch-on-surface/5 border border-stitch-outline-variant/10 flex items-center justify-between group">
                      <div className="flex items-center gap-4">
                         <div className="w-14 h-14 rounded-2xl bg-stitch-on-surface/10 flex items-center justify-center">
                           <span className="material-symbols-outlined text-stitch-on-surface-variant">content_cut</span>
                         </div>
                         <div>
                            <div className="w-24 h-3 rounded-full mb-2 bg-stitch-on-surface/30" />
                            <div className="w-16 h-2 rounded-full bg-stitch-on-surface/10" />
                         </div>
                      </div>
                      <div className="w-10 h-10 rounded-full border-2 border-dashed border-stitch-on-surface/20 flex items-center justify-center" style={{ color: primaryColor }}>
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
                           <span className="text-[10px] font-black uppercase tracking-widest text-stitch-on-surface-variant">Aberto</span>
                         </div>
                         <div className="flex items-center gap-2">
                           <div className="w-2 h-2 rounded-full" style={{ backgroundColor: secondaryColor }} />
                           <span className="text-[10px] font-black uppercase tracking-widest text-stitch-on-surface-variant">Suporte 24h</span>
                         </div>
                      </div>
                   </div>
                </div>
              </div>

              {/* Link para portal real */}
              {slug && (
                <div className="mt-10 text-center">
                  <Link
                    to={`/p/${slug}`}
                    target="_blank"
                    className="inline-flex items-center gap-2 text-sm font-bold text-stitch-primary hover:underline transition-all"
                  >
                    <span className="material-symbols-outlined text-base">open_in_new</span>
                    Abrir Portal do Cliente em Nova Aba
                  </Link>
                </div>
              )}
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
