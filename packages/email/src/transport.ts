import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type { SmtpConfig } from "./types.js";

/**
 * Creates a nodemailer transport from SMTP configuration.
 */
export function createTransport(config: SmtpConfig): Transporter {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port ?? 587,
    secure: config.secure ?? false,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });
}
