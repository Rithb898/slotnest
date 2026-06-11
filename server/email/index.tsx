import type { ReactElement } from "react";
import { Resend } from "resend";
import { env } from "@/lib/config/env";

const resend = new Resend(env.RESEND_API_KEY);

export async function sendEmail({
  to,
  subject,
  react,
}: {
  to: string;
  subject: string;
  react: ReactElement;
}) {
  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject,
    react,
  });

  if (error) {
    console.error("[email] failed to send", error);
    throw new Error(error.message);
  }
}
