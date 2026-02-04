import { describe, it, expect } from "vitest";
import { render } from "@react-email/render";
import { LoginVerificationEmail } from "../../src/templates/login-verification.js";

describe("LoginVerificationEmail", () => {
  it("renders correctly", async () => {
    const html = await render(
      LoginVerificationEmail({
        userName: "John Doe",
        verificationUrl: "https://example.com/verify?token=abc123",
        expiresInMinutes: 60,
      })
    );

    expect(html).toMatchSnapshot();
  });

  it("includes user name in output", async () => {
    const html = await render(
      LoginVerificationEmail({
        userName: "Jane Smith",
        verificationUrl: "https://example.com/verify",
        expiresInMinutes: 30,
      })
    );

    expect(html).toContain("Jane Smith");
  });

  it("includes verification URL", async () => {
    const html = await render(
      LoginVerificationEmail({
        userName: "User",
        verificationUrl: "https://custom-domain.com/verify?token=xyz",
        expiresInMinutes: 60,
      })
    );

    expect(html).toContain("https://custom-domain.com/verify?token=xyz");
  });

  it("includes expiration time", async () => {
    const html = await render(
      LoginVerificationEmail({
        userName: "User",
        verificationUrl: "https://example.com/verify",
        expiresInMinutes: 120,
      })
    );

    // React may inject HTML comments around interpolated values
    expect(html).toContain("120");
    expect(html).toContain("minutes");
  });
});
