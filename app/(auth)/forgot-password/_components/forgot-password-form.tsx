"use client";
import { useForm } from "@tanstack/react-form";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import z from "zod";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { authClient } from "@/server/auth/client";

const formSchema = z.object({
  email: z.email().describe("Enter your email address"),
});

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [sent, setSent] = useState(false);

  const form = useForm({
    defaultValues: {
      email: "",
    },
    validators: {
      onSubmit: formSchema,
    },
    onSubmit: async ({ value }) => {
      await authClient.requestPasswordReset(
        {
          email: value.email,
          redirectTo: "/reset-password",
        },
        {
          onSuccess: () => {
            setSent(true);
          },
          onError: (ctx) => {
            toast.error(ctx.error.message);
          },
        },
      );
    },
  });

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Forgot your password?</CardTitle>
          <CardDescription>
            Enter your email and we&apos;ll send you a reset link
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <FieldGroup>
              <FieldDescription className="text-center">
                If an account exists for that email, a password reset link is on
                its way. Check your inbox.
              </FieldDescription>
              <Link
                href="/sign-in"
                className={buttonVariants({ variant: "outline" })}
              >
                Back to sign in
              </Link>
            </FieldGroup>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void form.handleSubmit();
              }}
            >
              <FieldGroup>
                <form.Field name="email">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        type="email"
                        placeholder="example@gmail.com"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                      {field.state.meta.errors.length > 0 && (
                        <FieldError errors={field.state.meta.errors} />
                      )}
                    </Field>
                  )}
                </form.Field>
                <Field>
                  <form.Subscribe selector={(s) => s.isSubmitting}>
                    {(isSubmitting) => (
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? "Sending…" : "Send reset link"}
                      </Button>
                    )}
                  </form.Subscribe>
                  <FieldDescription className="text-center">
                    Remember your password? <Link href="/sign-in">Sign in</Link>
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
