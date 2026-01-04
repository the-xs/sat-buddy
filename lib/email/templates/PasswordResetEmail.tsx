import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Button,
  Hr,
} from "@react-email/components";

interface PasswordResetEmailProps {
  resetLink: string;
  userName?: string;
}

export const PasswordResetEmail = ({
  resetLink,
  userName,
}: PasswordResetEmailProps) => (
  <Html>
    <Head />
    <Body style={main}>
      <Container style={container}>
        <Section style={section}>
          <Text style={logo}>SAT Buddy</Text>
          <Text style={heading}>Reset Your Password</Text>
          <Text style={text}>Hi {userName || "there"},</Text>
          <Text style={text}>
            We received a request to reset your password. Click the button below
            to create a new password.
          </Text>
          <Button style={button} href={resetLink}>
            Reset Password
          </Button>
          <Hr style={hr} />
          <Text style={smallText}>
            This link will expire in 1 hour. If you did not request this, please
            ignore this email.
          </Text>
          <Text style={smallText}>
            Or copy and paste this URL into your browser:{" "}
            <span style={linkText}>{resetLink}</span>
          </Text>
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
  marginBottom: "24px",
};

const hr = {
  borderColor: "rgba(255, 255, 255, 0.1)",
  margin: "24px 0",
};

const smallText = {
  fontSize: "14px",
  color: "#565f89",
  marginBottom: "8px",
};

const linkText = {
  color: "#7aa2f7",
  wordBreak: "break-all" as const,
};

export default PasswordResetEmail;
