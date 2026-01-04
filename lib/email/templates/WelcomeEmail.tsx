import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Button,
} from "@react-email/components";

interface WelcomeEmailProps {
  userName?: string;
  loginUrl: string;
}

export const WelcomeEmail = ({ userName, loginUrl }: WelcomeEmailProps) => (
  <Html>
    <Head />
    <Body style={main}>
      <Container style={container}>
        <Section style={section}>
          <Text style={logo}>SAT Buddy</Text>
          <Text style={heading}>Welcome to SAT Buddy!</Text>
          <Text style={text}>Hi {userName || "there"},</Text>
          <Text style={text}>
            Thank you for signing up! You're now ready to start your SAT prep
            journey with personalized practice tests and AI-powered learning.
          </Text>
          <Text style={text}>Here's what you can do:</Text>
          <ul style={list}>
            <li style={listItem}>Take full-length SAT practice tests</li>
            <li style={listItem}>Practice with AI-generated questions</li>
            <li style={listItem}>Track your progress and analytics</li>
          </ul>
          <Button style={button} href={loginUrl}>
            Start Practicing
          </Button>
        </Section>
      </Container>
    </Body>
  </Html>
);

const main = {
  backgroundColor: "#1a1b26",
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  padding: "40px 0",
};

const container = {
  margin: "0 auto",
  padding: "0 20px",
  maxWidth: "560px",
};

const section = {
  backgroundColor: "rgba(255, 255, 255, 0.05)",
  borderRadius: "16px",
  padding: "32px",
  border: "1px solid rgba(255, 255, 255, 0.1)",
};

const logo = {
  fontSize: "24px",
  fontWeight: "700" as const,
  color: "#7aa2f7",
  marginBottom: "24px",
  textAlign: "center" as const,
};

const heading = {
  fontSize: "24px",
  fontWeight: "700" as const,
  color: "#c0caf5",
  marginBottom: "16px",
  textAlign: "center" as const,
};

const text = {
  fontSize: "16px",
  lineHeight: "24px",
  color: "#a9b1d6",
  marginBottom: "16px",
};

const list = {
  paddingLeft: "20px",
  marginBottom: "24px",
};

const listItem = {
  fontSize: "16px",
  lineHeight: "28px",
  color: "#a9b1d6",
};

const button = {
  backgroundColor: "#7aa2f7",
  borderRadius: "8px",
  color: "#1a1b26",
  fontSize: "16px",
  fontWeight: "600" as const,
  padding: "12px 24px",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "block",
};

export default WelcomeEmail;
