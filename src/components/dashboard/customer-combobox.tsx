import * as React from "react"
import { Check, ChevronsUpDown, Plus } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/context/AuthContext"

export type Customer = {
  id: string
  name: string
  phone: string | null
}

interface CustomerComboboxProps {
  value: string
  onChange: (value: string) => void
  onCustomerSelect: (customer: Customer | null) => void
  onRequestCreate: (name: string) => void
  customerName?: string // Nome do cliente selecionado
}

export function CustomerCombobox({
  value,
  onChange,
  onCustomerSelect,
  onRequestCreate,
  customerName,
}: CustomerComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [customers, setCustomers] = React.useState<Customer[]>([])
  const [loading, setLoading] = React.useState(false)
  const { profile } = useAuth()

  React.useEffect(() => {
    if (open && profile?.organization_id) {
      fetchCustomers()
    }
  }, [open, profile?.organization_id])

  // Recarregar quando um novo cliente for criado (value mudou mas não está na lista)
  React.useEffect(() => {
    if (value && profile?.organization_id && !customers.find(c => c.id === value)) {
      fetchCustomers()
    }
  }, [value, profile?.organization_id])

  const fetchCustomers = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, phone")
        .eq("organization_id", profile?.organization_id)
        .order("name")
      
      if (error) throw error
      setCustomers(data || [])
    } catch (error) {
      console.error("Error fetching customers:", error)
    } finally {
      setLoading(false)
    }
  }

  const filteredCustomers = customers.filter((customer) =>
    customer.name.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {value
            ? customers.find((customer) => customer.id === value)?.name || customerName || "Cliente selecionado"
            : "Selecione um cliente..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Buscar cliente..." 
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {loading && (
              <div className="p-2 text-sm text-muted-foreground text-center">
                Carregando...
              </div>
            )}
            <CommandEmpty>
              <div className="p-2">
                <p className="text-sm text-muted-foreground mb-2">
                  Nenhum cliente encontrado.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    onRequestCreate(query)
                    setOpen(false)
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Criar "{query}"
                </Button>
              </div>
            </CommandEmpty>
            <CommandGroup>
              {filteredCustomers.map((customer) => (
                <CommandItem
                  key={customer.id}
                  value={customer.name}
                  onSelect={() => {
                    onChange(customer.id)
                    onCustomerSelect(customer)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === customer.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {customer.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
