"use server";

import { redirect } from "next/navigation";
import { auth } from ".";

export async function signInWithEmail(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  const result = await auth.api.signInEmail({
    email,
    password,
    skipCookieError: true,
  });

  if (result.error) {
    return { error: result.error.message || "Sign in failed" };
  }

  redirect("/");
}

export async function signUpWithEmail(formData: FormData) {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!name || !email || !password) {
    return { error: "All fields are required" };
  }

  const result = await auth.api.signUpEmail({
    name,
    email,
    password,
    skipCookieError: true,
  });

  if (result.error) {
    return { error: result.error.message || "Sign up failed" };
  }

  redirect("/");
}

export async function requestPasswordReset(formData: FormData) {
  const email = formData.get("email") as string;

  if (!email) {
    return { error: "Email is required" };
  }

  await auth.api.forgetPassword({
    email,
    redirectURL: `${process.env.BETTER_AUTH_URL || ""}/reset-password`,
  });

  return { success: true };
}

export async function resetPassword(formData: FormData) {
  const password = formData.get("password") as string;
  const token = formData.get("token") as string;

  if (!password || !token) {
    return { error: "Password and token are required" };
  }

  const result = await auth.api.resetPassword({
    newPassword: password,
    token,
  });

  if (result.error) {
    return { error: result.error.message || "Password reset failed" };
  }

  redirect("/sign-in");
}
