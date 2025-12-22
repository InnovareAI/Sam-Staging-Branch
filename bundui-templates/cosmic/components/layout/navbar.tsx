"use client";

import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ChevronRightIcon, Menu } from "lucide-react";

import { productList, routeList } from "@/@data/navbar";

import Icon from "@/components/icon";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@/components/ui/sheet";
import Logo from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ToggleTheme } from "@/components/layout/toogle-theme";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle
} from "@/components/ui/navigation-menu";

export const Navbar = () => {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <header className="sticky top-2 z-40 lg:top-5">
      <div className="container">
        <div className="bg-background/70 flex items-center justify-between rounded-2xl border p-3 backdrop-blur-sm">
          <Logo />
          {/* <!-- Mobile --> */}
          <div className="flex items-center lg:hidden">
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Menu onClick={() => setIsOpen(!isOpen)} className="cursor-pointer lg:hidden" />
              </SheetTrigger>

              <SheetContent
                side="left"
                className="bg-card border-secondary flex flex-col justify-between rounded-tr-2xl rounded-br-2xl">
                <div>
                  <SheetHeader className="mb-4 ml-4">
                    <SheetTitle className="flex items-center">
                      <Logo />
                    </SheetTitle>
                  </SheetHeader>

                  <div className="flex flex-col gap-2">
                    {routeList.map(({ href, label }) => (
                      <Button
                        key={href}
                        onClick={() => setIsOpen(false)}
                        asChild
                        variant="ghost"
                        className="justify-start text-base">
                        <Link href={href}>{label}</Link>
                      </Button>
                    ))}
                  </div>
                </div>

                <SheetFooter className="flex-col items-start justify-start sm:flex-col">
                  <Separator className="mb-2" />
                  <ToggleTheme />
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </div>

          {/* <!-- Desktop --> */}
          <NavigationMenu className="mx-auto hidden lg:block">
            <NavigationMenuList className="space-x-0">
              <NavigationMenuItem>
                <NavigationMenuTrigger className="bg-transparent">Products</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <div className="w-72 gap-4">
                    <ul className="flex flex-col">
                      {productList.map(({ title, description, icon }) => (
                        <li key={title}>
                          <Link
                            href="/"
                            className="hover:bg-muted flex items-center gap-6 rounded-md p-4 text-sm">
                            <div className="bg-primary/20 ring-primary/10 mb-4 flex size-8 items-center justify-center rounded-full p-2 ring-8">
                              <Icon name={icon} className="text-primary size-5 shrink-0" />
                            </div>
                            <div>
                              <p className="text-foreground mb-1 leading-none font-semibold">
                                {title}
                              </p>
                              <p className="text-muted-foreground line-clamp-2">{description}</p>
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </NavigationMenuContent>
              </NavigationMenuItem>

              <NavigationMenuItem>
                {routeList.map(({ href, label }) => (
                  <NavigationMenuLink
                    key={href}
                    asChild
                    className={cn(navigationMenuTriggerStyle(), "hover:bg-muted! bg-transparent!")}>
                    <Link href={href}>{label}</Link>
                  </NavigationMenuLink>
                ))}
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>

          <div className="hidden items-center lg:flex">
            <ToggleTheme />

            <div className="flex gap-2">
              <Button size="lg" variant="ghost">
                Log in
              </Button>
              <Button size="lg">
                Get Started
                <ChevronRightIcon />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
