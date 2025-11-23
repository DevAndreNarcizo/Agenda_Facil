import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, KeyRound } from "lucide-react";
import { toast } from "sonner";

export default function PortalLogin() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Função para formatar telefone enquanto digita
  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setPhone(formatted);
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Remove formatação para enviar apenas números
      const cleanPhone = phone.replace(/\D/g, '');
      
      // Chama a função RPC para gerar o código
      const { data, error } = await supabase.rpc('request_otp', {
        phone_number: cleanPhone
      });

      if (error) throw error;

      // Tentar enviar via WhatsApp Service
      try {
        const whatsappResponse = await fetch('http://localhost:3001/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: cleanPhone,
            code: data?.simulated_code
          })
        });

        const whatsappData = await whatsappResponse.json();

        if (whatsappData.success) {
          toast.success('Código enviado via WhatsApp!', {
            duration: 5000,
            description: 'Verifique seu WhatsApp'
          });
        } else {
          // Se falhar, mostrar código simulado
          toast.success(`Código gerado: ${data?.simulated_code}`, {
            duration: 10000,
            description: 'WhatsApp offline - use este código para testar'
          });
        }
      } catch (whatsappError) {
        // Se o serviço WhatsApp não estiver disponível, mostrar código simulado
        console.warn('WhatsApp service not available:', whatsappError);
        toast.success(`Código gerado: ${data?.simulated_code}`, {
          duration: 10000,
          description: 'WhatsApp offline - use este código para testar'
        });
      }

      setStep('otp');
    } catch (err: any) {
      console.error('Error sending code:', err);
      toast.error("Erro ao enviar código. Verifique o número e tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const cleanPhone = phone.replace(/\D/g, '');
      
      const { data, error } = await supabase.rpc('verify_otp', {
        phone_number: cleanPhone,
        input_code: code
      });

      if (error) throw error;

      if (!data?.success) {
        toast.error(data?.message || "Código inválido");
        return;
      }

      // Salva dados do cliente no localStorage
      const customer = data.customer;
      localStorage.setItem("portal_customer_id", customer.id);
      localStorage.setItem("portal_customer_name", customer.name);
      localStorage.setItem("portal_organization_id", customer.organization_id);
      
      toast.success("Login realizado com sucesso!");
      navigate("/portal");

    } catch (err: any) {
      console.error('Error verifying code:', err);
      toast.error("Erro ao verificar código. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleBackToPhone = () => {
    setStep('phone');
    setCode('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Portal do Cliente</CardTitle>
          <CardDescription>
            {step === 'phone' 
              ? 'Digite seu celular para receber o código de acesso'
              : 'Digite o código enviado para seu celular'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'phone' ? (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Celular</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="(11) 99999-9999"
                    className="pl-9"
                    value={phone}
                    onChange={handlePhoneChange}
                    maxLength={15}
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Enviando..." : "Enviar Código"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Código de Verificação</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="code"
                    type="text"
                    placeholder="000000"
                    className="pl-9 text-center text-2xl tracking-widest"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    required
                    autoFocus
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Código enviado para {phone}
                </p>
              </div>

              <div className="space-y-2">
                <Button type="submit" className="w-full" disabled={loading || code.length !== 6}>
                  {loading ? "Verificando..." : "Entrar"}
                </Button>
                <Button 
                  type="button" 
                  variant="ghost" 
                  className="w-full" 
                  onClick={handleBackToPhone}
                  disabled={loading}
                >
                  Voltar
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
