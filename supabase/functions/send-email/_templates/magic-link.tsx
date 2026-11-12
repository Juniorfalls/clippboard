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

const SITE_URL = "https://clippboard-lilac.vercel.app";

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
            margin: "40px auto",
            padding: "48px 40px",
            backgroundColor: "#FFFFFF",
            border: "1px solid #E5E7EB",
            borderRadius: "16px",
            boxShadow: "0 12px 32px rgba(28, 28, 28, 0.08)",
          }}
        >
          <Section
            style={{
              margin: 0,
              textAlign: "center",
              lineHeight: "32px",
            }}
          >
            <Img
              src={`${SITE_URL}/icon.png`}
              width="32"
              height="32"
              alt="Clippboard"
              style={{
                display: "inline-block",
                width: "32px",
                height: "32px",
                verticalAlign: "middle",
                border: 0,
              }}
            />
            <span
              style={{
                display: "inline-block",
                fontSize: "24px",
                fontWeight: "bold",
                color: "#1C1C1C",
                marginLeft: "8px",
                verticalAlign: "middle",
                lineHeight: "32px",
              }}
            >
              Clippboard
            </span>
          </Section>

          <Heading
            style={{
              margin: "32px 0 0",
              color: "#1C1C1C",
              fontSize: "28px",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              lineHeight: "1.2",
              textAlign: "center",
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
              textAlign: "center",
            }}
          >
            Enter this 6-digit code to sign in. It expires in 10 minutes.
          </Text>

          <Section
            style={{
              margin: "32px 0",
              padding: "24px",
              backgroundColor: "#F0F4FF",
              borderRadius: "12px",
              textAlign: "center",
            }}
          >
            <Text
              style={{
                margin: 0,
                color: "#3B82F6",
                fontSize: "42px",
                fontWeight: "bold",
                fontFamily: "monospace",
                letterSpacing: "12px",
                lineHeight: "1.25",
              }}
            >
              {token}
            </Text>
          </Section>

          <Hr
            style={{
              margin: "40px 0 24px",
              borderColor: "#E5E7EB",
            }}
          />

          <Text
            style={{
              margin: 0,
              color: "#999999",
              fontSize: "13px",
              lineHeight: "1.6",
              textAlign: "center",
            }}
          >
            If you didn&apos;t request this code, you can safely ignore this
            email.
          </Text>

          <Text
            style={{
              margin: "16px 0 0",
              color: "#3B82F6",
              fontSize: "13px",
              lineHeight: "1.6",
              textAlign: "center",
            }}
          >
            <Link
              href={`${SITE_URL}/privacy`}
              style={{ color: "#3B82F6", textDecoration: "none" }}
            >
              Privacy Policy
            </Link>
            <span style={{ color: "#999999" }}> • </span>
            <Link
              href={`${SITE_URL}/terms`}
              style={{ color: "#3B82F6", textDecoration: "none" }}
            >
              Terms of Service
            </Link>
          </Text>

          <Text
            style={{
              margin: "16px 0 0",
              color: "#999999",
              fontSize: "12px",
              lineHeight: "1.6",
              textAlign: "center",
            }}
          >
            © 2026 Clippboard. All rights reserved.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
