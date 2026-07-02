import { useListGroceryItems, getListGroceryItemsQueryKey, useUpdateGroceryItem, useClearCheckedGroceryItems, useCreateGroceryItem } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Loader2, Trash2, Plus } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

export default function Grocery() {
  const { data: items, isLoading } = useListGroceryItems({ query: { queryKey: getListGroceryItemsQueryKey() } });
  const [newItem, setNewItem] = useState("");
  
  const queryClient = useQueryClient();
  const updateItem = useUpdateGroceryItem();
  const createItem = useCreateGroceryItem();
  const clearChecked = useClearCheckedGroceryItems();

  const handleToggle = (id: number, checked: boolean) => {
    updateItem.mutate({ id, data: { checked } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListGroceryItemsQueryKey() })
    });
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.trim()) return;
    createItem.mutate({ data: { name: newItem.trim() } }, {
      onSuccess: () => {
        setNewItem("");
        queryClient.invalidateQueries({ queryKey: getListGroceryItemsQueryKey() });
      }
    });
  };

  const handleClear = () => {
    clearChecked.mutate(undefined, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListGroceryItemsQueryKey() })
    });
  };

  if (isLoading) {
    return <div className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-secondary" /></div>;
  }

  const activeItems = items?.filter(i => !i.checked) || [];
  const checkedItems = items?.filter(i => i.checked) || [];

  return (
    <div className="flex-1 flex flex-col p-4 gap-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between mt-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Grocery List</h1>
          <p className="text-sm text-muted-foreground">{activeItems.length} items to buy</p>
        </div>
        {checkedItems.length > 0 && (
          <Button variant="ghost" size="sm" onClick={handleClear} className="text-destructive hover:text-destructive">
            <Trash2 className="w-4 h-4 mr-2" /> Clear Done
          </Button>
        )}
      </div>

      <form onSubmit={handleAdd} className="flex gap-2">
        <Input 
          placeholder="Add item..." 
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          className="flex-1 bg-card border-card-border"
        />
        <Button type="submit" variant="secondary" size="icon" disabled={!newItem.trim()}>
          <Plus className="w-5 h-5" />
        </Button>
      </form>

      <div className="flex flex-col gap-4 mt-4">
        {activeItems.length > 0 && (
          <Card className="overflow-hidden">
            <div className="divide-y divide-border">
              {activeItems.map(item => (
                <div key={item.id} className="p-3 px-4 flex items-center gap-3 bg-card hover:bg-muted/50 transition-colors">
                  <Checkbox 
                    id={`item-${item.id}`} 
                    checked={item.checked}
                    onCheckedChange={(checked) => handleToggle(item.id, checked as boolean)}
                    className="w-5 h-5 border-secondary text-secondary data-[state=checked]:bg-secondary data-[state=checked]:border-secondary"
                  />
                  <label htmlFor={`item-${item.id}`} className="flex-1 font-medium text-sm leading-none cursor-pointer">
                    {item.name}
                  </label>
                </div>
              ))}
            </div>
          </Card>
        )}

        {checkedItems.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2 px-1">Done</h3>
            <Card className="overflow-hidden opacity-75">
              <div className="divide-y divide-border">
                {checkedItems.map(item => (
                  <div key={item.id} className="p-3 px-4 flex items-center gap-3 bg-muted/30">
                    <Checkbox 
                      id={`item-${item.id}`} 
                      checked={item.checked}
                      onCheckedChange={(checked) => handleToggle(item.id, checked as boolean)}
                      className="w-5 h-5 border-muted-foreground"
                    />
                    <label htmlFor={`item-${item.id}`} className="flex-1 text-sm leading-none cursor-pointer line-through text-muted-foreground">
                      {item.name}
                    </label>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
