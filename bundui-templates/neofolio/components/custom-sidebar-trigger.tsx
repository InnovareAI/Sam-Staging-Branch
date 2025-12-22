import { useSidebar } from "@/components/ui/sidebar";
import { MenuIcon } from "lucide-react";
import { Button } from "./ui/button";

export function CustomSidebarTrigger() {
  const { toggleSidebar } = useSidebar();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleSidebar}
      className="flex md:hidden items-center gap-2 absolute top-3 end-3"
    >
      <MenuIcon />
    </Button>
  );
}
