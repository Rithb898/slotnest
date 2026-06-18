"use server";

import { redirect } from "next/navigation";
import { APIError } from "better-auth";
import { auth } from ".";

export async function signInWithEmail(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  try {
    await auth.api.signInEmail({
      body: {
        email,
        password,
      },
    });
  } catch (error) {
    return {
      error: error instanceof APIError ? error.message : "Sign in failed",
    };
  }

  redirect("/today");
}

export async function signUpWithEmail(formData: FormData) {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!name || !email || !password) {
    return { error: "All fields are required" };
  }

  try {
    await auth.api.signUpEmail({
      body: {
        name,
        email,
        password,
      },
    });
  } catch (error) {
    return {
      error: error instanceof APIError ? error.message : "Sign up failed",
    };
  }

  redirect("/today");
}

export async function requestPasswordReset(formData: FormData) {
  const email = formData.get("email") as string;

  if (!email) {
    return { error: "Email is required" };
  }

  try {
    await auth.api.requestPasswordReset({
      body: {
        email,
        redirectTo: `${process.env.BETTER_AUTH_URL || ""}/reset-password`,
      },
    });
  } catch (error) {
    return {
      error: error instanceof APIError ? error.message : "Password reset failed",
    };
  }

  return { success: true };
}

export async function resetPassword(formData: FormData) {
  const password = formData.get("password") as string;
  const token = formData.get("token") as string;

  if (!password || !token) {
    return { error: "Password and token are required" };
  }

  try {
    await auth.api.resetPassword({
      body: {
        newPassword: password,
        token,
      },
    });
  } catch (error) {
    return {
      error: error instanceof APIError ? error.message : "Password reset failed",
    };
  }

  redirect("/sign-in");
}
