import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { describeAuthError } from "@/lib/auth-form";
import { AuthAlert, AuthField, AuthLayout, AuthLink, AuthNotice, AuthSubmit } from "./auth-ui";

const forgotSchema = z.object({
  email: z.string().trim().min(1, "Informe seu e-mail.").email("E-mail inválido."),
});

type ForgotForm = z.infer<typeof forgotSchema>;

/**
 * Solicita a recuperação de senha pelo fluxo nativo do Supabase Auth.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export default function ForgotPassword() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotForm>({ resolver: zodResolver(forgotSchema) });

  /**
   * Envia o link de recuperação. A resposta é a mesma exista ou não a conta,
   * para não revelar quais e-mails estão cadastrados.
   *
   * @author André Narcizo - andre.narcizo@sysout.com.br
   */
  const onSubmit = async ({ email }: ForgotForm): Promise<void> => {
    setError(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (resetError) {
      setError(describeAuthError(resetError, "Não foi possível enviar o link. Tente novamente."));
      return;
    }
    setSentTo(email);
  };

  if (sentTo) {
    return (
      <AuthLayout lead="Recuperação de senha">
        <AuthNotice icon="mark_email_read" title="Verifique seu e-mail" action={<AuthLink to="/login" className="block text-center">Voltar para o login</AuthLink>}>
          Se <strong className="font-semibold text-af-ink">{sentTo}</strong> estiver cadastrado, você vai receber um link para criar uma nova senha.
        </AuthNotice>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout lead="Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.">
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
        {error && <AuthAlert>{error}</AuthAlert>}
        <AuthSubmit loading={isSubmitting} loadingLabel="Enviando…" className="mt-1">
          Enviar link
        </AuthSubmit>
      </form>
      <AuthLink to="/login" className="self-center">Voltar para o login</AuthLink>
    </AuthLayout>
  );
}
