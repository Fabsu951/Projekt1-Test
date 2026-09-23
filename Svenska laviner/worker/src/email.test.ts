import { describe, expect, it } from "vitest";
import { emailConfigured, resetEmail, verificationEmail } from "./email";

describe("email", () => {
  it("is only configured with both an API key and a sender", () => {
    expect(emailConfigured({})).toBe(false);
    expect(emailConfigured({ RESEND_API_KEY: "k" })).toBe(false);
    expect(emailConfigured({ RESEND_API_KEY: "k", EMAIL_FROM: "a@b.se" })).toBe(true);
  });

  it("puts the link in both the text and HTML versions", () => {
    const link = "https://fjallvarning.pages.dev/verifiera?token=abc";
    const mail = verificationEmail("a@b.se", "Åkare", link);
    expect(mail.text).toContain(link);
    expect(mail.html).toContain(link);
  });

  it("escapes user-controlled names in the HTML", () => {
    const mail = resetEmail("a@b.se", '<img src=x onerror="alert(1)">', "https://x/y");
    expect(mail.html).not.toContain("<img");
    expect(mail.html).toContain("&lt;img");
  });
});
