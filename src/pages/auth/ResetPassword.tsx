import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { PASSWORD_MIN_LENGTH, describeAuthError, getPasswordStrength } from "@/lib/auth-form";
import { AuthAlert, AuthField, AuthLayout, AuthLink, AuthNotice, AuthSubmit, PasswordStrengthMeter } from "./auth-ui";

const resetSchema = z
  .object({
    password: z.string().min(PASSWORD_MIN_LENGTH, `Mínimo de ${PASSWORD_MIN_LENGTH} caracteres.`),
    confirmation: z.string().min(1, "Repita a nova senha."),
  })
  .refine((data) => data.password === data.confirmation, { path: ["confirmation"], message: "As senhas não coincidem." });

type ResetForm = z.infer<typeof resetSchema>;

type SessionState = "checking" | "valid" | "invalid";

/**
 * Define uma nova senha durante a sessão de recuperação criada pelo link do Supabase Auth.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export default function ResetPassword() {
  const [sessionState, setSessionState] = useState<SessionState>("checking");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ResetForm>({ resolver: zodResolver(resetSchema), defaultValues: { password: "", confirmation: "" } });

  const password = useWatch({ control, name: "password" });

  useEffect(() => {
    let active = true;
    // O redirecionamento do e-mail cria a sessão de recuperação antes de a página montar.
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (active) setSessionState(!sessionError && data.session ? "valid" : "invalid");
    });
    return () => {
      active = false;
    };
  }, []);

  /**
   * Grava a nova senha e encerra a sessão temporária, exigindo login com a senha nova.
   *
   * @author André Narcizo - andre.narcizo@sysout.com.br
   */
  const onSubmit = async ({ password }: ResetForm): Promise<void> => {
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(describeAuthError(updateError, "Não foi possível redefinir a senha. Solicite um novo link."));
      return;
    }
    await supabase.auth.signOut();
    toast.success("Senha redefinida. Entre com a nova senha.");
    navigate("/login", { replace: true });
  };

  if (sessionState === "checking") {
    return (
      <AuthLayout lead="Validando o link de recuperação…">
        <div className="flex justify-center py-6" role="status" aria-label="Validando">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-af-line2 border-t-af-accent" />
        </div>
      </AuthLayout>
    );
  }

  if (sessionState === "invalid") {
    return (
      <AuthLayout lead="Recuperação de senha">
        <AuthNotice icon="link_off" tone="bad" title="Link inválido ou expirado" action={<AuthLink to="/forgot-password" className="block text-center">Solicitar novo link</AuthLink>}>
          Os links de recuperação valem por pouco tempo e só podem ser usados uma vez.
        </AuthNotice>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout lead="Escolha uma nova senha para sua conta.">
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3.5">
        <AuthField
          id="password"
          label="Nova senha"
          icon="lock"
          type="password"
          autoComplete="new-password"
          placeholder={`Mínimo ${PASSWORD_MIN_LENGTH} caracteres`}
          error={errors.password?.message}
          {...register("password")}
        />
        <PasswordStrengthMeter strength={getPasswordStrength(password)} />
        <AuthField
          id="confirmation"
          label="Confirmar nova senha"
          icon="lock"
          type="password"
          autoComplete="new-password"
          placeholder="Repita a senha"
          error={errors.confirmation?.message}
          {...register("confirmation")}
        />
        {error && <AuthAlert>{error}</AuthAlert>}
        <AuthSubmit loading={isSubmitting} loadingLabel="Salvando…" className="mt-1">
          Redefinir senha
        </AuthSubmit>
      </form>
    </AuthLayout>
  );
}
