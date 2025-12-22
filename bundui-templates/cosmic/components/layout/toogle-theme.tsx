import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "../ui/button";

export const ToggleTheme = () => {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      size="icon"
      variant="ghost"
    >
      <div className="flex items-center gap-2 dark:hidden">
        <Moon />
        <span className="block lg:hidden">Dark</span>
      </div>

      <div className="dark:flex items-center gap-2 hidden">
        <Sun/>
        <span className="block lg:hidden">Light</span>
      </div>

      <span className="sr-only">Change theme</span>
    </Button>
  );
};
