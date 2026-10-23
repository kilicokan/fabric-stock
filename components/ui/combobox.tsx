import * as React from "react"
import { Input } from "@/components/ui/input"
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Check } from "lucide-react"

interface ProductItem {
  id: number
  modelNo: string
  name: string
}

interface ComboboxProps {
  products: ProductItem[]
  value: string
  onSelect: (value: string) => void
  placeholder?: string
  className?: string
}

export const Combobox = React.forwardRef<
  HTMLInputElement,
  ComboboxProps
>(({ products, value, onSelect, placeholder = "Select...", className }, ref) => {
  const [open, setOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState("")
  const selectedProduct = products.find((product) => product.modelNo === value)

  const filteredProducts = React.useMemo(() => {
    const query = searchValue.toLowerCase()
    return products.filter((product) =>
      product.modelNo.toLowerCase().includes(query) ||
      product.name.toLowerCase().includes(query)
    )
  }, [products, searchValue])

  React.useEffect(() => {
    setSearchValue("")
  }, [open])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={`w-full justify-between ${className || ""}`}
        >
          {selectedProduct ? (
            <>
              {selectedProduct.modelNo} - {selectedProduct.name}
              <Check className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </>
          ) : (
            placeholder
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0 max-h-64 overflow-y-auto">
        <Input
          ref={ref}
          placeholder="Search..."
          className="h-9 border-0 shadow-none"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
        />
        {filteredProducts.length === 0 ? (
          <div className="py-4 px-3 text-sm text-muted-foreground">
            No products found.
          </div>
        ) : (
          filteredProducts.map((product) => (
            <Button
              key={product.id}
              variant="ghost"
              className="h-auto p-3 w-full justify-start text-left hover:bg-accent hover:text-accent-foreground flex items-center"
              onClick={() => {
                onSelect(product.modelNo)
                setOpen(false)
              }}
            >
              <span className="font-mono text-xs opacity-75 mr-2 min-w-[60px]">
                {product.modelNo}
              </span>
              <span className="font-normal">{product.name}</span>
              {selectedProduct?.id === product.id && (
                <Check className="ml-auto h-4 w-4 shrink-0 opacity-100" />
              )}
            </Button>
          ))
        )}
      </PopoverContent>
    </Popover>
  )
})

Combobox.displayName = "Combobox"
