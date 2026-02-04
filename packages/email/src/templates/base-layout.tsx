import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

interface BaseLayoutProps {
  preview: string;
  children: ReactNode;
}

export function BaseLayout({ preview, children }: BaseLayoutProps) {
  return (
    <Html>
      <Head>
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Audiowide&display=swap"
          rel="stylesheet"
        />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Img
              src="https://posium.ai/posium_icon.png"
              width="32"
              height="32"
              alt="Posium"
              style={styles.logo}
            />
            <Text style={styles.logoText}>POSIUM</Text>
          </Section>
          {children}
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              Sent by Posium
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const styles = {
  body: {
    backgroundColor: "#f6f9fc",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
  },
  container: {
    backgroundColor: "#ffffff",
    margin: "0 auto",
    padding: "20px 0 48px",
    marginBottom: "64px",
    maxWidth: "600px",
  },
  header: {
    padding: "24px 48px",
    textAlign: "center" as const,
  },
  logo: {
    display: "inline-block",
    verticalAlign: "middle",
  },
  logoText: {
    display: "inline-block",
    verticalAlign: "middle",
    fontFamily: "Audiowide, Arial, sans-serif",
    fontSize: "24px",
    fontWeight: "400",
    color: "#1f2937",
    margin: "0",
    marginLeft: "8px",
    letterSpacing: "2px",
  },
  footer: {
    marginTop: "32px",
    paddingTop: "16px",
    borderTop: "1px solid #e6ebf1",
  },
  footerText: {
    color: "#8898aa",
    fontSize: "12px",
    lineHeight: "16px",
    textAlign: "center" as const,
    margin: "0",
  },
} as const;
