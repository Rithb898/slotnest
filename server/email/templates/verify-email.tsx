import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

export function VerifyEmail({ url, name }: { url: string; name?: string }) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Verify your SlotNest email address</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Verify your email</Heading>
          <Text style={text}>
            {name ? `Hi ${name}, ` : ""}welcome to SlotNest. Confirm your email
            address to finish setting up your account.
          </Text>
          <Section style={{ textAlign: "center", margin: "32px 0" }}>
            <Button href={url} style={button}>
              Verify email
            </Button>
          </Section>
          <Text style={muted}>
            If the button doesn&apos;t work, copy and paste this link into your
            browser:
          </Text>
          <Text style={link}>{url}</Text>
          <Text style={muted}>
            If you didn&apos;t create a SlotNest account, you can ignore this
            email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default VerifyEmail;

const main = { backgroundColor: "#f4f4f5", fontFamily: "sans-serif" };
const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "32px",
  maxWidth: "480px",
  borderRadius: "8px",
};
const heading = { fontSize: "22px", fontWeight: "bold", color: "#18181b" };
const text = { fontSize: "15px", lineHeight: "24px", color: "#3f3f46" };
const muted = { fontSize: "13px", lineHeight: "20px", color: "#71717a" };
const link = { fontSize: "13px", color: "#2563eb", wordBreak: "break-all" as const };
const button = {
  backgroundColor: "#18181b",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: "bold",
  padding: "12px 24px",
  borderRadius: "6px",
  textDecoration: "none",
};
