"use client";
import { cn } from "@/lib/utils";
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
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import z from "zod";
import { useForm } from "@tanstack/react-form";
import { authClient } from "@/server/auth/client";

const formSchema = z
  .object({
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

export function ResetPasswordForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const error = searchParams.get("error");

  const form = useForm({
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
    validators: {
      onSubmit: formSchema,
    },
    onSubmit: async ({ value }) => {
      if (!token) return;
      await authClient.resetPassword(
        {
          newPassword: value.password,
          token,
        },
        {
          onSuccess: () => {
            toast.success("Password reset. You can sign in now.");
            router.push("/sign-in");
          },
          onError: (ctx) => {
            toast.error(ctx.error.message);
          },
        },
      );
    },
  });

  const invalidToken = !token || error === "INVALID_TOKEN";

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Reset your password</CardTitle>
          <CardDescription>
            Choose a new password for your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invalidToken ? (
            <FieldGroup>
              <FieldDescription className="text-center">
                This password reset link is invalid or has expired. Request a
                new one to continue.
              </FieldDescription>
              <Link
                href="/forgot-password"
                className={buttonVariants()}
              >
                Request a new link
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
                <form.Field name="password">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>New Password</FieldLabel>
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
                <Field>
                  <form.Subscribe selector={(s) => s.isSubmitting}>
                    {(isSubmitting) => (
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? "Resetting…" : "Reset password"}
                      </Button>
                    )}
                  </form.Subscribe>
                  <FieldDescription className="text-center">
                    <Link href="/sign-in">Back to sign in</Link>
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
