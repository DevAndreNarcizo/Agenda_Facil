import type { UseFormReturn } from "react-hook-form";
import { PanelDialog } from "@/components/panel/panel-dialog";
import { Field, PanelButton } from "@/components/panel/primitives";

interface AddEmployeeFormValues {
  fullName: string;
  email: string;
  password: string;
}

interface EmployeeFormProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  form: UseFormReturn<AddEmployeeFormValues>;
  onSubmit: (data: AddEmployeeFormValues) => void;
  creating: boolean;
}

/**
 * Modal "Convidar profissional": cria a conta de acesso do membro da equipe (validação zod).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function EmployeeForm({ isOpen, onOpenChange, form, onSubmit, creating }: EmployeeFormProps) {
  const { register, handleSubmit, formState: { errors } } = form;

  return (
    <PanelDialog
      open={isOpen}
      onOpenChange={onOpenChange}
      width={480}
      title="Convidar profissional"
      description="O profissional entra com este e-mail e senha e vê a própria agenda."
      footer={
        <>
          <div className="flex-1" />
          <PanelButton variant="ghost" size="md" onClick={() => onOpenChange(false)}>Cancelar</PanelButton>
          <PanelButton variant="primary" size="md" type="submit" form="employee-form" disabled={creating}>
            {creating ? "Criando acesso…" : "Criar acesso"}
          </PanelButton>
        </>
      }
    >
      <form id="employee-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Field label="Nome completo" htmlFor="fullName" error={errors.fullName?.message}>
          <input id="fullName" className="af-input" autoFocus placeholder="Ex.: Maria Oliveira" {...register("fullName")} />
        </Field>
        <Field label="E-mail profissional" htmlFor="email" error={errors.email?.message}>
          <input id="email" type="email" className="af-input" placeholder="maria@empresa.com" {...register("email")} />
        </Field>
        <Field label="Senha de acesso" htmlFor="password" error={errors.password?.message} hint="Mínimo de 6 caracteres. O profissional pode trocá-la depois.">
          <input id="password" type="password" className="af-input" autoComplete="new-password" {...register("password")} />
        </Field>
      </form>
    </PanelDialog>
  );
}
