import React from "npm:react@^19";
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "npm:@react-email/components";

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
        }}
      >
        <Container
          style={{
            width: "100%",
            maxWidth: "480px",
            margin: "0 auto",
            padding: "32px",
            backgroundColor: "#FFFFFF",
            border: "1px solid #E5E7EB",
            borderRadius: "16px",
          }}
        >
          <Text
            style={{
              margin: 0,
              color: "#3B82F6",
              fontSize: "13px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Clippboard
          </Text>

          <Heading
            style={{
              margin: "18px 0 0",
              color: "#1C1C1C",
              fontSize: "28px",
              lineHeight: "1.2",
            }}
          >
            Check your email
          </Heading>

          <Text
            style={{
              margin: "12px 0 0",
              color: "rgba(28, 28, 28, 0.65)",
              fontSize: "16px",
              lineHeight: "1.6",
            }}
          >
            Enter this 6-digit code to sign in to your Clippboard workspace.
          </Text>

          <Section
            style={{
              margin: "24px 0 0",
              padding: "20px 16px",
              textAlign: "center",
              backgroundColor: "#F9F7F4",
              borderRadius: "12px",
            }}
          >
            <Text
              style={{
                margin: 0,
                color: "#1C1C1C",
                fontSize: "36px",
                fontWeight: 700,
                letterSpacing: "0.24em",
                lineHeight: "1.2",
              }}
            >
              {token}
            </Text>
          </Section>

          <Text
            style={{
              margin: "20px 0 0",
              color: "rgba(28, 28, 28, 0.55)",
              fontSize: "13px",
              lineHeight: "1.6",
            }}
          >
            This code expires shortly. If you did not request it, you can safely
            ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
