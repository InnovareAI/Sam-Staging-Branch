"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Clock, Mail, Phone } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import SectionContainer from "@/components/layout/section-container";
import SectionHeader from "@/components/layout/section-header";

const formSchema = z.object({
  firstName: z.string().trim().min(1).max(20),
  lastName: z.string().trim().min(1).max(20),
  email: z.string().email(),
  subject: z.string().trim().min(1),
  message: z.string().trim().min(2).max(255)
});

export const ContactSection = () => {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      subject: "",
      message: ""
    }
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    const { firstName, lastName, email, subject, message } = values;
    window.location.href = `mailto:leomirandadev@gmail.com?subject=${subject}&body=Hello I am ${firstName} ${lastName}, my Email is ${email}. %0D%0A${message}`;
  }

  return (
    <SectionContainer id="contact">
      <SectionHeader
        subTitle="Contact"
        title="Get Connect With Us access"
        description=" Stay in touch with us for updates, support, and valuable insights.
          We’re here to help you every step of the way!"
      />
      <section className="mx-auto grid max-w-screen-lg grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <div className="flex flex-col gap-6 *:rounded-lg *:border *:p-6">
            <div className="bg-muted">
              <div className="mb-4 flex items-center gap-3">
                <Building2 className="size-4" />
                <div className="font-bold">Location:</div>
              </div>
              <div className="text-muted-foreground">123 Maple Lane, Springfield, IL 62704</div>
            </div>

            <div className="bg-muted">
              <div className="mb-4 flex items-center gap-3">
                <Phone className="size-4" />
                <div className="font-bold">Call us:</div>
              </div>
              <div className="text-muted-foreground">+1 (555) 987-6543</div>
            </div>

            <div className="bg-muted">
              <div className="mb-4 flex items-center gap-3">
                <Mail className="size-4" />
                <div className="font-bold">Email us:</div>
              </div>
              <div className="text-muted-foreground">contact@ourcompany.com</div>
            </div>

            <div className="bg-muted">
              <div className="mb-4 flex items-center gap-3">
                <Clock className="size-4" />
                <div className="font-bold">Business Hours:</div>
              </div>
              <div className="text-muted-foreground">Tuesday to Saturday, 9 AM - 5 PM</div>
            </div>
          </div>
        </div>

        <Card className="bg-muted">
          <CardHeader>
            <CardTitle>Send Message</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid w-full gap-6">
                <div className="flex flex-col gap-6 md:flex-row!">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem className="w-full gap-4">
                        <FormLabel className="font-semibold">Firstname</FormLabel>
                        <FormControl>
                          <Input placeholder="Leopoldo" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem className="w-full gap-4">
                        <FormLabel className="font-semibold">Lastname</FormLabel>
                        <FormControl>
                          <Input placeholder="Miranda" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem className="gap-4">
                        <FormLabel className="font-semibold">Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="contact@bundui.com" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <FormField
                    control={form.control}
                    name="subject"
                    render={({ field }) => (
                      <FormItem className="gap-4">
                        <FormLabel className="font-semibold">Subject</FormLabel>
                        <Select onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select a subject" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Web Development">Web Development</SelectItem>
                            <SelectItem value="Mobile Development">Mobile Development</SelectItem>
                            <SelectItem value="Figma Design">Figma Design</SelectItem>
                            <SelectItem value="REST API">REST API</SelectItem>
                            <SelectItem value="FullStack Project">FullStack Project</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem className="gap-4">
                        <FormLabel className="font-semibold">Message</FormLabel>
                        <FormControl>
                          <Textarea
                            rows={5}
                            placeholder="Your message..."
                            className="resize-none"
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <Button size="lg">Send message</Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </section>
    </SectionContainer>
  );
};
