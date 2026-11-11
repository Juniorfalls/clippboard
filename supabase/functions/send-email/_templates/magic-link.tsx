import React from "npm:react@18.3.1";
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "npm:@react-email/components@0.0.22";

type MagicLinkEmailProps = {
  token: string;
};

export function MagicLinkEmail({ token }: MagicLinkEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your Clippboard login code is {token}</Preview>

      <Body
        style={{
          margin: 0,
          padding: "40px 16px",
          backgroundColor: "#F9F7F4",
          fontFamily:
            'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          WebkitFontSmoothing: "antialiased",
        }}
      >
        <Container
          style={{
            width: "100%",
            maxWidth: "600px",
            margin: "0 auto",
            padding: "40px",
            backgroundColor: "#FFFFFF",
            border: "1px solid #E5E7EB",
            borderRadius: "12px",
            boxShadow: "0 8px 24px rgba(28, 28, 28, 0.06)",
          }}
        >
          <Section style={{ margin: "0 0 32px", textAlign: "center" }}>
            <Img
              src="https://clippboard-lilac.vercel.app/logo.png"
              width="120"
              alt="Clippboard"
              style={{
                display: "block",
                margin: "0 auto",
                maxWidth: "100%",
                height: "auto",
              }}
            />
          </Section>

          <Heading
            style={{
              margin: 0,
              color: "#1C1C1C",
              fontSize: "28px",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              lineHeight: "1.2",
            }}
          >
            Your Login Code
          </Heading>

          <Text
            style={{
              margin: "12px 0 0",
              color: "#666666",
              fontSize: "16px",
              lineHeight: "1.6",
            }}
          >
            Enter this 6-digit code to sign in. It expires in 10 minutes.
          </Text>

          <Section
            style={{
              margin: "24px 0 0",
              padding: "24px",
              backgroundColor: "#F9F7F4",
              borderRadius: "8px",
              textAlign: "center",
            }}
          >
            <Text
              style={{
                margin: 0,
                color: "#3B82F6",
                fontSize: "36px",
                fontWeight: 700,
                letterSpacing: "8px",
                lineHeight: "1.2",
              }}
            >
              {token}
            </Text>
          </Section>

          <Hr
            style={{
              margin: "32px 0 20px",
              borderColor: "#E5E7EB",
            }}
          />

          <Text
            style={{
              margin: 0,
              color: "#999999",
              fontSize: "12px",
              lineHeight: "1.6",
              textAlign: "center",
            }}
          >
            If you didn&apos;t request this code, you can safely ignore this
            email.
          </Text>

          <Text
            style={{
              margin: "8px 0 0",
              color: "#999999",
              fontSize: "12px",
              lineHeight: "1.6",
              textAlign: "center",
            }}
          >
            © 2026 Clippboard. All rights reserved.
          </Text>

          <Text
            style={{
              margin: "12px 0 0",
              color: "#999999",
              fontSize: "12px",
              lineHeight: "1.6",
              textAlign: "center",
            }}
          >
            <Link
              href="https://clippboard-lilac.vercel.app/privacy"
              style={{ color: "#3B82F6", textDecoration: "underline" }}
            >
              Privacy Policy
            </Link>
            <span style={{ color: "#CCCCCC" }}> · </span>
            <Link
              href="https://clippboard-lilac.vercel.app/terms"
              style={{ color: "#3B82F6", textDecoration: "underline" }}
            >
              Terms of Service
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
