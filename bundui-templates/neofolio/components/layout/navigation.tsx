"use client";

import Link from "next/link";
import React from "react";

import { usePathname } from "next/navigation";
import {
  BriefcaseBusinessIcon,
  DribbbleIcon,
  ExternalLinkIcon,
  FacebookIcon,
  HomeIcon,
  RssIcon,
  ShoppingCartIcon,
  SquareUserRoundIcon,
  TwitterIcon,
  UserPenIcon
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";

import { NavGroup } from "@/type/navigation";
import { Button } from "@/components/ui/button";

const navLinks: NavGroup[] = [
  {
    title: "",
    url: "#",
    items: [
      {
        title: "Homepage",
        url: "/",
        icon: HomeIcon
      },
      {
        title: "Projects",
        url: "/projects",
        icon: BriefcaseBusinessIcon
      },
      {
        title: "Store",
        url: "/store",
        icon: ShoppingCartIcon
      },
      {
        title: "About",
        url: "/about",
        icon: SquareUserRoundIcon
      },
      {
        title: "Blog",
        url: "/blog",
        icon: RssIcon
      },
      {
        title: "Contact",
        url: "/contact",
        icon: UserPenIcon
      }
    ]
  },
  {
    title: "Social",
    url: "#",
    items: [
      {
        title: "Twitter",
        url: "https://x.com/TobyBelhome",
        icon: TwitterIcon,
        target: "_blank"
      },
      {
        title: "Facebook",
        url: "https://www.facebook.com/",
        icon: FacebookIcon,
        target: "_blank"
      },
      {
        title: "Dribbble",
        url: "https://dribbble.com/TobyBelhome",
        icon: DribbbleIcon,
        target: "_blank"
      }
    ]
  }
];

export default function Navigation() {
  const pathname = usePathname();
  const replacedPathname = pathname.split("/").filter(Boolean)[0];

  return (
    <Sidebar className="border-e-0! p-3">
      <SidebarHeader className="mb-4">
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center space-x-4">
            <Avatar className="size-12">
              <AvatarImage
                className="h-full w-full rounded-full object-cover"
                src="https://plus.unsplash.com/premium_photo-1664536392779-049ba8fde933?q=80&w=1974&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
              />
              <AvatarFallback>PC</AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-1 leading-none">
              <span className="font-semibold">Toby Belhome</span>
              <span className="text-muted-foreground text-sm">Frontend Developer</span>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="space-y-4 px-0">
          {navLinks.map((item, key) => (
            <React.Fragment key={key}>
              {item.title ? (
                <SidebarGroupLabel className="tracking-widest uppercase opacity-70">
                  {item.title}
                </SidebarGroupLabel>
              ) : null}
              <SidebarGroupContent>
                <SidebarMenu>
                  {item?.items &&
                    item.items.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          className="data-[active=true]:bg-background h-auto rounded-2xl px-3 text-base data-[active=true]:!font-semibold"
                          isActive={
                            (item.url === "/" && replacedPathname === undefined) ||
                            item.url.replace("/", "") === replacedPathname
                          }>
                          <Link href={item.url} target={item.target} className="gap-3">
                            {item.icon && <item.icon className="text-muted-foreground size-5!" />}
                            {item.title}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </React.Fragment>
          ))}
          <div className="mt-4">
            <Button className="w-full" asChild>
              <Link
                href="https://shadcnuikit.com/template/neofolio-portfolio-template"
                target="_blank">
                Get Template <ExternalLinkIcon />
              </Link>
            </Button>
          </div>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <ThemeToggle />
      </SidebarFooter>
    </Sidebar>
  );
}
