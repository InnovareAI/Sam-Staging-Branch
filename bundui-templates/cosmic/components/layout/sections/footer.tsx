import Link from "next/link";
import { DribbbleIcon, FacebookIcon, LinkedinIcon, Twitter } from "lucide-react";

import { Button } from "@/components/ui/button";
import Logo from "@/components/layout/logo";

export const FooterSection = () => {
  return (
    <footer id="footer" className="container space-y-4 pb-4 lg:pb-8">
      <div className="bg-muted rounded-2xl border p-10">
        <div className="grid grid-cols-2 gap-x-12 gap-y-8 md:grid-cols-4 xl:grid-cols-6">
          <div className="col-span-full space-y-4 xl:col-span-2">
            <Logo />
            <p className="text-muted-foreground">
              Meet our AI-powered SaaS solution to lighten your workload, increase efficiency and
              make more accurate decisions.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="mb-2 text-lg font-bold">Contact</h3>
            <div>
              <Link href="#" className="opacity-60 hover:opacity-100">
                Github
              </Link>
            </div>

            <div>
              <Link href="#" className="opacity-60 hover:opacity-100">
                Twitter
              </Link>
            </div>

            <div>
              <Link href="#" className="opacity-60 hover:opacity-100">
                Instagram
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="mb-2 text-lg font-bold">Platforms</h3>
            <div>
              <Link href="#" className="opacity-60 hover:opacity-100">
                iOS
              </Link>
            </div>

            <div>
              <Link href="#" className="opacity-60 hover:opacity-100">
                Android
              </Link>
            </div>

            <div>
              <Link href="#" className="opacity-60 hover:opacity-100">
                Web
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="mb-2 text-lg font-bold">Help</h3>
            <div>
              <Link href="#" className="opacity-60 hover:opacity-100">
                Contact Us
              </Link>
            </div>

            <div>
              <Link href="#" className="opacity-60 hover:opacity-100">
                FAQ
              </Link>
            </div>

            <div>
              <Link href="#" className="opacity-60 hover:opacity-100">
                Feedback
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="mb-2 text-lg font-bold">Socials</h3>
            <div>
              <Link href="#" className="opacity-60 hover:opacity-100">
                Twitch
              </Link>
            </div>

            <div>
              <Link href="#" className="opacity-60 hover:opacity-100">
                Discord
              </Link>
            </div>

            <div>
              <Link href="#" className="opacity-60 hover:opacity-100">
                Dribbble
              </Link>
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row!">
        <div className="text-muted-foreground flex items-center justify-center gap-1 text-sm sm:justify-start">
          <span>&copy; {new Date().getFullYear()}</span>
          <span>|</span>
          <Button variant="link" className="h-auto p-0" asChild>
            <Link target="_blank" href="https://bundui.io/">
              Bundui
            </Link>
          </Button>
          .
        </div>
        <div className="flex items-center justify-center gap-2">
          <Button size="icon" variant="ghost" className="hover:opacity-50" asChild>
            <Link href="#">
              <FacebookIcon />
            </Link>
          </Button>
          <Button size="icon" variant="ghost" className="hover:opacity-50" asChild>
            <Link href="#">
              <Twitter />
            </Link>
          </Button>
          <Button size="icon" variant="ghost" className="hover:opacity-50" asChild>
            <Link href="#">
              <DribbbleIcon />
            </Link>
          </Button>
          <Button size="icon" variant="ghost" className="hover:opacity-50" asChild>
            <Link href="#">
              <LinkedinIcon />
            </Link>
          </Button>
        </div>
      </div>
    </footer>
  );
};
