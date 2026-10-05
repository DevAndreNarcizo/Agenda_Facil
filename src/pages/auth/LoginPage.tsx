import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { describeAuthError } from "@/lib/auth-form";
import { AuthAlert, AuthField, AuthLayout, AuthLink, AuthModeTabs, AuthSubmit, AuthSwitch } from "./auth-ui";

// Sem tamanho mínimo no login: a regra de 8 caracteres vale para senhas novas,
// e contas antigas (mínimo 6) precisam continuar entrando.
const loginSchema = z.object({
  email: z.string().trim().min(1, "Informe seu e-mail.").email("E-mail inválido."),
  password: z.string().min(1, "Informe sua senha."),
});

type LoginForm = z.infer<typeof loginSchema>;

/**
 * Tela de entrada do painel (e-mail + senha via Supabase Auth), no padrão visual do design system.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  /**
   * Autentica e envia ao painel; o ProtectedRoute redireciona ao onboarding se não houver empresa.
   *
   * @author André Narcizo - andre.narcizo@sysout.com.br
   */
  const onSubmit = async (data: LoginForm): Promise<void> => {
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword(data);
    if (authError) {
      setError(describeAuthError(authError, "Não foi possível entrar. Tente novamente."));
      return;
    }
    navigate("/dashboard", { replace: true });
  };

  return (
    <AuthLayout lead="Entre para gerenciar sua agenda.">
      <AuthModeTabs active="login" />
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3.5">
        <AuthField
          id="email"
          label="E-mail"
          icon="mail"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="voce@negocio.com"
          error={errors.email?.message}
          {...register("email")}
        />
        <AuthField
          id="password"
          label="Senha"
          icon="lock"
          type="password"
          autoComplete="current-password"
          placeholder="Sua senha"
          error={errors.password?.message}
          labelAside={<AuthLink to="/forgot-password">Esqueci a senha</AuthLink>}
          {...register("password")}
        />
        {error && <AuthAlert>{error}</AuthAlert>}
        <AuthSubmit loading={isSubmitting} loadingLabel="Entrando…" className="mt-1">
          Entrar
        </AuthSubmit>
      </form>
      <AuthSwitch text="Ainda não tem conta?" cta="Criar conta" to="/register" />
    </AuthLayout>
  );
}
