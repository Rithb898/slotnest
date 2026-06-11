"use client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import z from "zod";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { authClient } from "@/server/auth/client";

const formSchema = z
  .object({
    name: z.string().min(2).describe("Enter your full name"),
    email: z.email().describe("Enter your email address"),
    password: z
      .string()
      .min(8)
      .describe("Password must be at least 8 characters long"),
    confirmPassword: z.string().min(8).describe("Confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter();
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
    validators: {
      onSubmit: formSchema,
    },
    onSubmit: async ({ value }) => {
      setPasswordError(null);
      await authClient.signUp.email(
        {
          name: value.name,
          email: value.email,
          password: value.password,
          callbackURL: "/",
        },
        {
          onSuccess: () => {
            toast.success("Account created");
            router.push("/");
          },
          onError: (ctx) => {
            if (ctx.error.code === "PASSWORD_COMPROMISED") {
              setPasswordError(ctx.error.message);
              return;
            }
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
          <CardTitle className="text-xl">Create your account</CardTitle>
          <CardDescription>
            Enter your email below to create your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void form.handleSubmit();
            }}
          >
            <FieldGroup>
              <form.Field name="name">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>Full Name</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="text"
                      placeholder="John Doe"
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
                <Field className="grid grid-cols-2 gap-4">
                  <form.Field name="password">
                    {(field) => (
                      <Field>
                        <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                        <Input
                          id={field.name}
                          name={field.name}
                          type="password"
                          placeholder="••••••••"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => {
                            setPasswordError(null);
                            field.handleChange(e.target.value);
                          }}
                        />
                        {field.state.meta.errors.length > 0 && (
                          <FieldError errors={field.state.meta.errors} />
                        )}
                        {passwordError && (
                          <FieldError errors={[{ message: passwordError }]} />
                        )}
                      </Field>
                    )}
                  </form.Field>
                  <form.Field name="confirmPassword">
                    {(field) => (
                      <Field>
                        <FieldLabel htmlFor={field.name}>
                          Confirm Password
                        </FieldLabel>
                        <Input
                          id={field.name}
                          name={field.name}
                          type="password"
                          placeholder="••••••••"
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
                </Field>
                <FieldDescription>
                  Must be at least 8 characters long.
                </FieldDescription>
              </Field>
              <Field>
                <form.Subscribe selector={(s) => s.isSubmitting}>
                  {(isSubmitting) => (
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? "Creating account…" : "Create Account"}
                    </Button>
                  )}
                </form.Subscribe>
                <FieldDescription className="text-center">
                  Already have an account? <Link href="/sign-in">Sign in</Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        By clicking continue, you agree to our{" "}
        <Link href="#">Terms of Service</Link> and{" "}
        <Link href="#">Privacy Policy</Link>.
      </FieldDescription>
    </div>
  );
}
