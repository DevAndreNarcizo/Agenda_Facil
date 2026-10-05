import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { describeAuthError, formatBrPhone, phoneDigits, toE164Br } from "@/lib/auth-form";
import { useAuthProviders } from "@/hooks/use-auth-providers";
import { AuthAlert, AuthField, AuthLayout, AuthLink, AuthSubmit } from "./auth-ui";

const RESEND_COOLDOWN_SECONDS = 60;

const phoneSchema = z.object({
  phone: z.string().refine((value) => phoneDigits(value).length >= 10, "Informe DDD + número."),
});

const codeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Digite os 6 números do código."),
});

/**
 * Login sem senha por código enviado no WhatsApp (Supabase Auth, phone OTP no canal WhatsApp via Twilio).
 * Conta nova criada por aqui não tem empresa: o ProtectedRoute leva ao onboarding.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export default function WhatsAppLoginPage() {
  const providers = useAuthProviders();
  const navigate = useNavigate();
  const [phone, setPhone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const phoneForm = useForm<z.infer<typeof phoneSchema>>({ resolver: zodResolver(phoneSchema), defaultValues: { phone: "" } });
  const codeForm = useForm<z.infer<typeof codeSchema>>({ resolver: zodResolver(codeSchema), defaultValues: { code: "" } });

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  /**
   * Pede ao Supabase o envio do código pelo WhatsApp e inicia a contagem para reenvio.
   *
   * @author André Narcizo - andre.narcizo@sysout.com.br
   */
  const sendCode = async (rawPhone: string): Promise<boolean> => {
    setError(null);
    const { error: otpError } = await supabase.auth.signInWithOtp({
      phone: toE164Br(rawPhone),
      options: { channel: "whatsapp" },
    });
    if (otpError) {
      setError(describeAuthError(otpError, "Não foi possível enviar o código. Tente novamente."));
      return false;
    }
    setCooldown(RESEND_COOLDOWN_SECONDS);
    return true;
  };

  /**
   * Confirma o código de 6 dígitos e abre o painel.
   *
   * @author André Narcizo - andre.narcizo@sysout.com.br
   */
  const verifyCode = async ({ code }: z.infer<typeof codeSchema>): Promise<void> => {
    if (!phone) return;
    setError(null);
    const { error: verifyError } = await supabase.auth.verifyOtp({ phone: toE164Br(phone), token: code, type: "sms" });
    if (verifyError) {
      setError(describeAuthError(verifyError, "Não foi possível confirmar o código."));
      return;
    }
    navigate("/dashboard", { replace: true });
  };

  // Acesso direto à URL com o provedor desligado volta para o login comum.
  if (providers.ready && !providers.whatsapp) {
    return <Navigate to="/login" replace />;
  }

  if (!phone) {
    return (
      <AuthLayout lead="Entre com um código enviado para o seu WhatsApp, sem senha.">
        <form
          noValidate
          className="flex flex-col gap-3.5"
          onSubmit={phoneForm.handleSubmit(async ({ phone: value }) => {
            if (await sendCode(value)) setPhone(value);
          })}
        >
          <AuthField
            id="phone"
            label="WhatsApp"
            icon="call"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="(11) 90000-0000"
            hint="Informe DDD + número."
            error={phoneForm.formState.errors.phone?.message}
            {...phoneForm.register("phone", {
              onChange: (event: React.ChangeEvent<HTMLInputElement>) => phoneForm.setValue("phone", formatBrPhone(event.target.value)),
            })}
          />
          {error && <AuthAlert>{error}</AuthAlert>}
          <AuthSubmit loading={phoneForm.formState.isSubmitting} loadingLabel="Enviando…" className="mt-1">
            Enviar código
          </AuthSubmit>
        </form>
        <AuthLink to="/login" className="self-center">Entrar com e-mail e senha</AuthLink>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout lead={<>Enviamos um código de 6 números para <strong className="font-semibold text-af-ink">{phone}</strong> no WhatsApp.</>}>
      <form noValidate className="flex flex-col gap-3.5" onSubmit={codeForm.handleSubmit(verifyCode)}>
        <AuthField
          id="code"
          label="Código"
          icon="pin"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="000000"
          className="tracking-[0.3em]"
          error={codeForm.formState.errors.code?.message}
          {...codeForm.register("code", {
            onChange: (event: React.ChangeEvent<HTMLInputElement>) => codeForm.setValue("code", event.target.value.replace(/\D/g, "").slice(0, 6)),
          })}
        />
        {error && <AuthAlert>{error}</AuthAlert>}
        <AuthSubmit loading={codeForm.formState.isSubmitting} loadingLabel="Confirmando…" className="mt-1">
          Entrar
        </AuthSubmit>
      </form>
      <div className="flex items-center justify-between text-[13px]">
        <button type="button" className="font-medium text-af-ink2 hover:text-af-ink" onClick={() => { setPhone(null); setError(null); codeForm.reset(); }}>
          Trocar número
        </button>
        <button
          type="button"
          disabled={cooldown > 0}
          onClick={() => void sendCode(phone)}
          className="font-medium text-af-accent hover:underline disabled:cursor-not-allowed disabled:text-af-ink3 disabled:no-underline"
        >
          {cooldown > 0 ? `Reenviar em ${cooldown}s` : "Reenviar código"}
        </button>
      </div>
    </AuthLayout>
  );
}
