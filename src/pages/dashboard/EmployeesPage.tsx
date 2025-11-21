import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus } from "lucide-react";

// Schema for adding an employee
const addEmployeeSchema = z.object({
  fullName: z.string().min(3, "Nome deve ter no mínimo 3 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres"),
});

type AddEmployeeForm = z.infer<typeof addEmployeeSchema>;

type Employee = {
  id: string;
  full_name: string;
  role: string;
  created_at: string;
};

export default function EmployeesPage() {
  const { profile } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddEmployeeForm>({
    resolver: zodResolver(addEmployeeSchema),
  });

  useEffect(() => {
    if (profile?.organization_id) {
      fetchEmployees();
    }
  }, [profile?.organization_id]);

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("organization_id", profile?.organization_id)
        .eq("role", "employee")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setEmployees(data || []);
    } catch (err) {
      console.error("Error fetching employees:", err);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: AddEmployeeForm) => {
    if (!profile?.organization_id) return;
    setCreating(true);
    setError(null);

    try {
      // Create a temporary client to avoid signing out the admin
      const tempSupabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
        {
          auth: {
            persistSession: false, // Don't persist session
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        }
      );

      // 1. Create Auth User
      const { data: authData, error: authError } = await tempSupabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.fullName,
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Erro ao criar usuário");

      // 2. Create Profile (Admin does this via main client which has RLS permission)
      // Note: The 'signUp' above creates the user in Auth, but we need to create the profile.
      // Our RLS policy "Admins can insert employee profiles" allows this.
      const { error: profileError } = await supabase
        .from("profiles")
        .insert({
          id: authData.user.id,
          organization_id: profile.organization_id,
          full_name: data.fullName,
          role: "employee",
        });

      if (profileError) {
        // If profile creation fails, we might want to delete the auth user?
        // For now just throw
        throw profileError;
      }

      reset();
      fetchEmployees();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Erro ao adicionar funcionário");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Funcionários</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Add Employee Form */}
        <Card>
          <CardHeader>
            <CardTitle>Adicionar Funcionário</CardTitle>
            <CardDescription>
              Cadastre um novo funcionário para sua empresa.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome Completo</Label>
                <Input
                  id="fullName"
                  placeholder="Maria Oliveira"
                  {...register("fullName")}
                />
                {errors.fullName && (
                  <p className="text-sm text-red-500">{errors.fullName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="maria@empresa.com"
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

              {error && <p className="text-sm text-red-500">{error}</p>}

              <Button type="submit" className="w-full" disabled={creating}>
                {creating ? (
                  "Adicionando..."
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" /> Adicionar Funcionário
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Employees List */}
        <Card>
          <CardHeader>
            <CardTitle>Lista de Funcionários</CardTitle>
            <CardDescription>
              Gerencie os funcionários cadastrados.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p>Carregando...</p>
            ) : employees.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                Nenhum funcionário cadastrado.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Data de Cadastro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell className="font-medium">
                        {employee.full_name}
                      </TableCell>
                      <TableCell>
                        {new Date(employee.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
