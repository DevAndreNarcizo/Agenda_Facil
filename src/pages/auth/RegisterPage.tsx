import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { PASSWORD_MIN_LENGTH, describeAuthError, formatBrPhone, getPasswordStrength, phoneDigits, slugify } from "@/lib/auth-form";
import {
  AuthAlert,
  AuthCheckbox,
  AuthField,
  AuthLayout,
  AuthLink,
  AuthModeTabs,
  AuthNotice,
  AuthSubmit,
  AuthSwitch,
  LegalLink,
  PasswordStrengthMeter,
  SegmentChips,
  SocialAuth,
} from "./auth-ui";

const registerSchema = z.object({
  fullName: z.string().trim().min(3, "Informe seu nome."),
  orgName: z.string().trim().min(3, "Informe o nome do negócio."),
  orgSlug: z
    .string()
    .trim()
    .min(3, "Use ao menos 3 caracteres.")
    .max(80, "Use no máximo 80 caracteres.")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use letras minúsculas, números e hífens."),
  phone: z.string().refine((value) => phoneDigits(value).length >= 10, "Informe DDD + número."),
  segment: z.enum(["estetica", "beleza", "cabelo", "pet"], { message: "Escolha o segmento do negócio." }),
  email: z.string().trim().min(1, "Informe seu e-mail.").email("E-mail inválido."),
  password: z.string().min(PASSWORD_MIN_LENGTH, `Mínimo de ${PASSWORD_MIN_LENGTH} caracteres.`),
  terms: z.boolean().refine((accepted) => accepted, "Aceite os termos para continuar."),
});

type RegisterForm = z.infer<typeof registerSchema>;

/**
 * Cadastro do dono do negócio. O trigger `handle_new_user` cria a organização a partir de
 * `org_name`/`org_slug` dos metadados e o perfil como owner, então o painel abre já configurável.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export default function RegisterPage() {
  const [error, setError] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<string | null>(null);
  // Enquanto o usuário não editar o link à mão, ele acompanha o nome do negócio.
  const [slugEdited, setSlugEdited] = useState(false);
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    setValue,
    control,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: "", orgName: "", orgSlug: "", phone: "", email: "", password: "", terms: false },
  });

  const slug = useWatch({ control, name: "orgSlug" });
  const segment = useWatch({ control, name: "segment" });
  const strength = getPasswordStrength(useWatch({ control, name: "password" }));

  /**
   * Cria a conta. Com confirmação de e-mail ativa o Supabase não devolve sessão:
   * nesse caso mostramos o aviso em vez de mandar para uma rota protegida.
   *
   * @author André Narcizo - andre.narcizo@sysout.com.br
   */
  const onSubmit = async (data: RegisterForm): Promise<void> => {
    setError(null);
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        // O trigger handle_new_user valida e grava esses campos; organization_id/role nunca vêm daqui.
        data: {
          full_name: data.fullName,
          org_name: data.orgName,
          org_slug: data.orgSlug,
          phone: phoneDigits(data.phone),
          segment: data.segment,
        },
      },
    });
    if (authError || !authData.user) {
      setError(describeAuthError(authError, "Não foi possível criar a conta. Tente novamente."));
      return;
    }
    if (!authData.session) {
      setPendingConfirmation(data.email);
      return;
    }
    navigate("/dashboard", { replace: true });
  };

  if (pendingConfirmation) {
    return (
      <AuthLayout lead="Falta só confirmar seu e-mail.">
        <AuthNotice icon="mark_email_unread" title="Verifique sua caixa de entrada" action={<AuthLink to="/login" className="block text-center">Voltar para o login</AuthLink>}>
          Enviamos um link de confirmação para <strong className="font-semibold text-af-ink">{pendingConfirmation}</strong>. Abra-o para ativar a conta e entrar no painel.
        </AuthNotice>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout lead="Crie sua conta e comece com 14 dias grátis do plano Pro.">
      <AuthModeTabs active="register" />
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3.5">
        <AuthField
          id="fullName"
          label="Seu nome"
          icon="person"
          autoComplete="name"
          placeholder="Como você se chama"
          error={errors.fullName?.message}
          {...register("fullName")}
        />
        <AuthField
          id="orgName"
          label="Nome do negócio"
          icon="storefront"
          autoComplete="organization"
          placeholder="Ex.: Studio Bella"
          hint="Aparece na sua página de reserva."
          error={errors.orgName?.message}
          {...register("orgName", {
            onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
              if (!slugEdited) setValue("orgSlug", slugify(event.target.value), { shouldValidate: Boolean(errors.orgSlug) });
            },
          })}
        />
        <AuthField
          id="orgSlug"
          label="Link de reserva"
          icon="link"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="studio-bella"
          hint={<>Seus clientes agendam em <span className="font-medium text-af-ink2">{window.location.host}/reservar/{slug || "seu-negocio"}</span></>}
          error={errors.orgSlug?.message}
          {...register("orgSlug", {
            setValueAs: (value: string) => value.toLowerCase(),
            onChange: () => setSlugEdited(true),
          })}
        />
        <AuthField
          id="phone"
          label="WhatsApp"
          icon="call"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="(11) 90000-0000"
          hint="Informe DDD + número."
          error={errors.phone?.message}
          {...register("phone", {
            onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
              setValue("phone", formatBrPhone(event.target.value));
            },
          })}
        />
        <SegmentChips
          value={segment}
          error={errors.segment?.message}
          onChange={(value) => {
            setValue("segment", value);
            if (errors.segment) void trigger("segment");
          }}
        />
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
          autoComplete="new-password"
          placeholder={`Mínimo ${PASSWORD_MIN_LENGTH} caracteres`}
          error={errors.password?.message}
          {...register("password")}
        />
        <PasswordStrengthMeter strength={strength} />
        <AuthCheckbox
          id="terms"
          error={errors.terms?.message}
          label={<>Li e aceito os <LegalLink to="/termos">Termos de uso</LegalLink> e a <LegalLink to="/privacidade">Política de privacidade</LegalLink>.</>}
          {...register("terms")}
        />
        {error && <AuthAlert>{error}</AuthAlert>}
        <AuthSubmit loading={isSubmitting} loadingLabel="Criando conta…" className="mt-1">
          Criar conta grátis
        </AuthSubmit>
      </form>
      <SocialAuth onError={setError} />
      <AuthSwitch text="Já tem conta?" cta="Entrar" to="/login" />
    </AuthLayout>
  );
}
