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

export function ResetPassword({ url, name }: { url: string; name?: string }) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Reset your SlotNest password</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Reset your password</Heading>
          <Text style={text}>
            {name ? `Hi ${name}, ` : ""}we received a request to reset your
            SlotNest password. Click the button below to choose a new one.
          </Text>
          <Section style={{ textAlign: "center", margin: "32px 0" }}>
            <Button href={url} style={button}>
              Reset password
            </Button>
          </Section>
          <Text style={muted}>
            If the button doesn&apos;t work, copy and paste this link into your
            browser:
          </Text>
          <Text style={link}>{url}</Text>
          <Text style={muted}>
            If you didn&apos;t request a password reset, you can safely ignore
            this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default ResetPassword;

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
const link = {
  fontSize: "13px",
  color: "#2563eb",
  wordBreak: "break-all" as const,
};
const button = {
  backgroundColor: "#18181b",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: "bold",
  padding: "12px 24px",
  borderRadius: "6px",
  textDecoration: "none",
};
