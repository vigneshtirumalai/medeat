import { format } from "date-fns";
import { useGetRecipeSuggestions, getGetRecipeSuggestionsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Clock, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Recipes() {
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const { data: recipes, isLoading } = useGetRecipeSuggestions({ date: todayStr }, { query: { queryKey: getGetRecipeSuggestionsQueryKey({ date: todayStr }) } });

  if (isLoading) {
    return <div className="flex-1 flex items-center justify-center flex-col gap-4">
      <Loader2 className="w-8 h-8 animate-spin text-secondary" />
      <p className="text-sm text-muted-foreground animate-pulse">AI is crafting recipes for your goals...</p>
    </div>;
  }

  return (
    <div className="flex-1 flex flex-col p-4 gap-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between mt-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">AI Recipes</h1>
          <p className="text-sm text-muted-foreground">Tailored to your diet & allergies</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-secondary" />
        </div>
      </div>

      <div className="grid gap-5 pb-4">
        {recipes?.map((recipe, idx) => (
          <Card key={idx} className="overflow-hidden shadow-sm hover:shadow transition-shadow">
            <CardContent className="p-0">
              <div className="p-5 pb-4">
                <h3 className="font-bold text-xl leading-tight mb-2 text-foreground">{recipe.title}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{recipe.description}</p>

                <div className="flex flex-wrap gap-2 mb-4">
                  <Badge variant="secondary" className="flex items-center gap-1.5 bg-secondary/15 text-secondary-foreground border-transparent px-2.5 py-1">
                    <Clock className="w-3.5 h-3.5" />
                    {recipe.cookTimeMinutes} min
                  </Badge>
                  <Badge variant="outline" className="font-bold border-secondary/30 px-2.5 py-1 text-secondary-foreground">
                    {recipe.calories} kcal
                  </Badge>
                  {recipe.allergenFlags.map(flag => (
                    <Badge key={flag} variant="destructive" className="bg-destructive/10 text-destructive border-transparent px-2.5 py-1">
                      {flag}
                    </Badge>
                  ))}
                </div>

                <div className="flex justify-between items-center text-xs font-medium text-muted-foreground bg-muted/50 p-3 rounded-lg">
                  <span className="flex flex-col items-center">Protein <span className="font-bold text-foreground mt-0.5 text-sm">{recipe.proteinG}g</span></span>
                  <div className="w-px h-6 bg-border" />
                  <span className="flex flex-col items-center">Carbs <span className="font-bold text-foreground mt-0.5 text-sm">{recipe.carbsG}g</span></span>
                  <div className="w-px h-6 bg-border" />
                  <span className="flex flex-col items-center">Fat <span className="font-bold text-foreground mt-0.5 text-sm">{recipe.fatG}g</span></span>
                </div>
              </div>

              <div className="border-t p-4">
                <span className="text-xs font-semibold text-muted-foreground px-2 py-1 bg-background rounded-md border shadow-sm">
                  {recipe.ingredients.length} ingredients
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
