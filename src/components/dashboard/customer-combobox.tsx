import * as React from "react"


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
import { useAuth } from "@/hooks/use-auth"

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, profile?.organization_id])

  // Recarregar quando um novo cliente for criado (value mudou mas não está na lista)
  React.useEffect(() => {
    if (value && profile?.organization_id && !customers.find(c => c.id === value)) {
      fetchCustomers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, profile?.organization_id, customers])

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
    } catch {
      // Silently fail - customer list will be empty
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
          className="w-full justify-between h-14 rounded-xl border-stitch-outline-variant/20 bg-stitch-surface-container-low/30 hover:bg-stitch-surface-container-low/50 transition-all font-medium text-stitch-on-surface"
        >
          {value
            ? customers.find((customer) => customer.id === value)?.name || customerName || "Cliente selecionado"
            : "Selecione um cliente..."}
          <span className="material-symbols-outlined ml-2 opacity-50">unfold_more</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-2 rounded-2xl border-stitch-outline-variant/20 shadow-2xl">
        <Command shouldFilter={false} className="rounded-xl overflow-hidden">
          <div className="flex items-center px-3 border-b border-stitch-outline-variant/10">
            <span className="material-symbols-outlined text-stitch-on-surface-variant opacity-40">search</span>
            <CommandInput 
              placeholder="Buscar cliente..." 
              value={query}
              onValueChange={setQuery}
              className="border-none focus:ring-0 h-12"
            />
          </div>
          <CommandList className="max-h-[300px] mt-1 scrollbar-thin">
            {loading && (
              <div className="p-4 flex flex-col items-center gap-2">
                <div className="w-5 h-5 border-2 border-stitch-primary/20 border-t-stitch-primary rounded-full animate-spin" />
                <p className="text-xs font-bold text-stitch-on-surface-variant opacity-40">Buscando...</p>
              </div>
            )}
            <CommandEmpty>
              <div className="p-4 text-center">
                <p className="text-sm font-medium text-stitch-on-surface-variant opacity-60 mb-4">
                  Nenhum cliente encontrado.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full h-10 rounded-lg font-bold gap-2 text-stitch-primary bg-stitch-primary/5 hover:bg-stitch-primary/10 border-none"
                  onClick={() => {
                    onRequestCreate(query)
                    setOpen(false)
                  }}
                >
                  <span className="material-symbols-outlined text-sm font-bold">add</span>
                  Criar "{query}"
                </Button>
              </div>
            </CommandEmpty>
            <CommandGroup className="p-1">
              {filteredCustomers.map((customer) => (
                <CommandItem
                  key={customer.id}
                  value={customer.name}
                  className="rounded-lg h-10 px-3 cursor-pointer aria-selected:bg-stitch-primary/5 aria-selected:text-stitch-primary transition-colors flex items-center"
                  onSelect={() => {
                    onChange(customer.id)
                    onCustomerSelect(customer)
                    setOpen(false)
                  }}
                >
                  <div className="flex-1 flex items-center justify-between">
                    <span className="font-medium">{customer.name}</span>
                    {value === customer.id && (
                      <span className="material-symbols-outlined text-lg">check</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
