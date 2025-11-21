import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const registerSchema = z.object({
  fullName: z.string().min(3, "Nome deve ter no mínimo 3 caracteres"),
  orgName: z.string().min(3, "Nome da empresa deve ter no mínimo 3 caracteres"),
  orgSlug: z.string().min(3, "Slug deve ter no mínimo 3 caracteres").regex(/^[a-z0-9-]+$/, "Slug deve conter apenas letras minúsculas, números e hífens"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres"),
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterForm) => {
    setLoading(true);
    setError(null);

    try {
      // 1. Sign up user with metadata
      // The database trigger 'on_auth_user_created' will handle creating the Organization and Profile
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.fullName,
            org_name: data.orgName,
            org_slug: data.orgSlug,
            role: 'admin', // Explicitly set role in metadata for the trigger
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Erro ao criar usuário");

      // No need to manually insert organization or profile anymore.
      // The trigger handles it.

      navigate("/dashboard");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Erro ao criar conta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-3xl text-center bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Crie sua conta
          </CardTitle>
          <CardDescription className="text-center">
            Comece a gerenciar seu negócio hoje mesmo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Seu Nome Completo</Label>
              <Input
                id="fullName"
                placeholder="João Silva"
                {...register("fullName")}
              />
              {errors.fullName && (
                <p className="text-sm text-red-500">{errors.fullName.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="orgName">Nome da Empresa</Label>
              <Input
                id="orgName"
                placeholder="Barbearia do João"
                {...register("orgName")}
              />
              {errors.orgName && (
                <p className="text-sm text-red-500">{errors.orgName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="orgSlug">Link da Agenda (Slug)</Label>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500">agendafacil.com/</span>
                <Input
                  id="orgSlug"
                  placeholder="barbearia-joao"
                  {...register("orgSlug")}
                />
              </div>
              {errors.orgSlug && (
                <p className="text-sm text-red-500">{errors.orgSlug.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-sm text-red-500">{errors.password.message}</p>
              )}
            </div>

            {error && <p className="text-sm text-red-500 text-center">{error}</p>}
            
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Criando conta..." : "Criar Conta"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-muted-foreground">
            Já tem uma conta?{" "}
            <Link to="/login" className="font-medium text-primary hover:text-secondary transition-colors">
              Entrar
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
