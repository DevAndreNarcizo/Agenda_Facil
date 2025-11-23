import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { Palette, Upload } from 'lucide-react';

export default function ThemeCustomization() {
  const { profile } = useAuth();
  const [primaryColor, setPrimaryColor] = useState('#3b82f6');
  const [secondaryColor, setSecondaryColor] = useState('#8b5cf6');
  const [accentColor, setAccentColor] = useState('#10b981');
  const [logoUrl, setLogoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingTheme, setLoadingTheme] = useState(true);

  useEffect(() => {
    if (!profile?.organization_id) return;

    const fetchTheme = async () => {
      try {
        const { data, error } = await supabase
          .from('organizations')
          .select('primary_color, secondary_color, accent_color, logo_url')
          .eq('id', profile.organization_id)
          .single();

        if (error) throw error;

        if (data) {
          setPrimaryColor(data.primary_color || '#3b82f6');
          setSecondaryColor(data.secondary_color || '#8b5cf6');
          setAccentColor(data.accent_color || '#10b981');
          setLogoUrl(data.logo_url || '');
        }
      } catch (error) {
        console.error('Error fetching theme:', error);
        toast.error('Erro ao carregar tema');
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
        .from('organizations')
        .update({
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          accent_color: accentColor,
          logo_url: logoUrl || null
        })
        .eq('id', profile.organization_id);

      if (error) throw error;

      // Aplicar tema imediatamente
      const root = document.documentElement;
      root.style.setProperty('--primary', primaryColor);
      root.style.setProperty('--secondary', secondaryColor);
      root.style.setProperty('--accent', accentColor);

      toast.success('Tema atualizado com sucesso!');
    } catch (error) {
      console.error('Error updating theme:', error);
      toast.error('Erro ao atualizar tema');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setPrimaryColor('#3b82f6');
    setSecondaryColor('#8b5cf6');
    setAccentColor('#10b981');
    setLogoUrl('');
  };

  if (loadingTheme) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Carregando tema...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-2">
        <Palette className="h-6 w-6" />
        <h2 className="text-2xl font-bold">Personalização de Tema</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cores da Marca</CardTitle>
          <CardDescription>
            Personalize as cores do sistema de acordo com sua identidade visual
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            {/* Cor Primária */}
            <div className="space-y-2">
              <Label htmlFor="primary">Cor Primária</Label>
              <div className="flex gap-2">
                <Input
                  id="primary"
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-16 h-10 cursor-pointer"
                />
                <Input
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  placeholder="#3b82f6"
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Usada em botões principais e destaques
              </p>
            </div>

            {/* Cor Secundária */}
            <div className="space-y-2">
              <Label htmlFor="secondary">Cor Secundária</Label>
              <div className="flex gap-2">
                <Input
                  id="secondary"
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="w-16 h-10 cursor-pointer"
                />
                <Input
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  placeholder="#8b5cf6"
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Usada em elementos secundários
              </p>
            </div>

            {/* Cor de Destaque */}
            <div className="space-y-2">
              <Label htmlFor="accent">Cor de Destaque</Label>
              <div className="flex gap-2">
                <Input
                  id="accent"
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-16 h-10 cursor-pointer"
                />
                <Input
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  placeholder="#10b981"
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Usada para sucesso e confirmações
              </p>
            </div>
          </div>

          {/* Logo URL */}
          <div className="space-y-2">
            <Label htmlFor="logo" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              URL do Logo
            </Label>
            <Input
              id="logo"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://exemplo.com/logo.png"
            />
            <p className="text-xs text-muted-foreground">
              Cole a URL de uma imagem hospedada (PNG, JPG ou SVG)
            </p>
          </div>

          {/* Botões de Ação */}
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar Tema'}
            </Button>
            <Button variant="outline" onClick={handleReset} disabled={loading}>
              Restaurar Padrão
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>
            Visualize como as cores ficarão nos componentes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button style={{ backgroundColor: primaryColor, borderColor: primaryColor }}>
                Botão Primário
              </Button>
              <Button style={{ backgroundColor: secondaryColor, borderColor: secondaryColor }}>
                Botão Secundário
              </Button>
              <Button style={{ backgroundColor: accentColor, borderColor: accentColor }}>
                Botão de Destaque
              </Button>
            </div>

            {logoUrl && (
              <div className="mt-4">
                <p className="text-sm font-medium mb-2">Logo:</p>
                <img 
                  src={logoUrl} 
                  alt="Logo preview" 
                  className="max-h-16 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    toast.error('Erro ao carregar logo. Verifique a URL.');
                  }}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
