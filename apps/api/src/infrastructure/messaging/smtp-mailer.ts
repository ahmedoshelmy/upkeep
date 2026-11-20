import { type Transporter, createTransport } from 'nodemailer'
import type { Mailer } from '../../application/ports'
import type { Notification } from '../../application/records'

/** Mail is optional: without MAIL_SMTP_URL nothing is sent. In compose it points at a local Mailpit inbox. */
export class SmtpMailer implements Mailer {
  private readonly transport: Transporter | null

  constructor(
    smtpUrl: string | null,
    private readonly from: string,
    private readonly to: string,
  ) {
    this.transport = smtpUrl ? createTransport(smtpUrl) : null
  }

  async send(n: Notification): Promise<void> {
    if (!this.transport) return
    await this.transport.sendMail({
      from: this.from,
      to: this.to,
      subject: `Upkeep: ${n.message}`,
      text: `${n.message}\n\nOpen Upkeep to mark it done or snooze it.`,
    })
  }
}
