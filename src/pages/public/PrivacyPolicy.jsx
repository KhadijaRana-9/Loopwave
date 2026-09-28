import { Link } from 'react-router-dom'
import LegalPage, { Confirm, List, Owner, Section } from '@/components/legal/LegalPage'

const SECTIONS = [
  { id: 'who-we-are', title: 'Who we are and what this covers' },
  { id: 'information', title: 'Information we collect' },
  { id: 'use', title: 'How we use information' },
  { id: 'whatsapp-meta', title: 'WhatsApp and Meta' },
  { id: 'sharing', title: 'Who we share information with' },
  { id: 'transfers', title: 'International processing' },
  { id: 'retention', title: 'How long we keep information' },
  { id: 'security', title: 'Security' },
  { id: 'rights', title: 'Your rights and choices' },
  { id: 'cookies', title: 'Cookies and similar technologies' },
  { id: 'children', title: 'Children' },
  { id: 'changes', title: 'Changes to this policy' },
  { id: 'contact', title: 'Contact us' },
]

export default function PrivacyPolicy() {
  return (
    <LegalPage
      title="Privacy Policy"
      sections={SECTIONS}
      summary="Loopwave is a WhatsApp marketing, shared-inbox and customer-conversation platform for businesses. This policy explains what personal information we handle, why, who we share it with, and the choices you have."
    >
      <Section id="who-we-are" title="Who we are and what this covers">
        <p>
          Loopwave is operated by <Owner field="legalEntityName" label="legal entity name" />, <Owner field="registeredAddress" label="registered address" />
          {' '}("Loopwave", "we", "us"). This policy applies to our website, the Loopwave web application and the related services.
        </p>
        <p>We handle two kinds of information, and our role is different for each:</p>
        <List>
          <li>
            <strong>Account information</strong> about the people who sign up for Loopwave and their workspaces. For this we are the
            <em> controller</em> (we decide why and how it is used).
          </li>
          <li>
            <strong>Customer data</strong> that our business customers put into Loopwave — their contacts, WhatsApp conversations, campaigns
            and templates. For this the business customer is the controller and Loopwave acts as its <em>processor / service provider</em>,
            handling the data on its instructions. If you are a contact of a business that uses Loopwave, that business is your first point
            of contact for questions about your data (see "Your rights and choices").
          </li>
        </List>
      </Section>

      <Section id="information" title="Information we collect">
        <p>
          <strong>Account and workspace.</strong> Your name, work email address, a hashed password (we never store your password in readable
          form), your workspace name, your role and team-member invitations, and notification preferences.
        </p>
        <p>
          <strong>Customer data.</strong> Contacts your workspace stores (name, phone number, email, company, tags, custom fields, lead status
          and WhatsApp opt-in status), WhatsApp conversations and messages sent and received through your connected number (text and
          any media), campaigns, message templates, forms and chatbot or automation settings.
        </p>
        <p>
          <strong>WhatsApp connection data.</strong> When you connect a WhatsApp Business Account we store its WhatsApp Business Account ID,
          business ID, the phone-number ID, display number, verified name, quality rating and messaging tier reported by Meta, and an access
          token that Meta issues for your account. The token is stored encrypted.
        </p>
        <p>
          <strong>Billing.</strong> Your plan and subscription status. If card payments are enabled, payment details are handled by our payment
          provider; we keep a customer/subscription reference, not your full card number.
        </p>
        <p>
          <strong>Usage and technical data.</strong> Sign-in and session records, IP address, browser and device information, feature and
          message-volume usage counters for plan limits, error and audit logs, and copies of the event notifications Meta sends to us
          (webhook records), which can contain the message text, phone numbers and profile names in those events.
        </p>
      </Section>

      <Section id="use" title="How we use information">
        <List>
          <li>To provide, operate and secure the service — sending and receiving WhatsApp messages, showing your inbox, running campaigns, and syncing templates.</li>
          <li>To create and manage your account, authenticate you, and send service messages such as invitations, password and security notices.</li>
          <li>To enforce plan limits, bill for the service and prevent abuse, spam and fraud.</li>
          <li>To provide optional AI features, only when they are enabled for your workspace (see "Who we share information with").</li>
          <li>To monitor reliability, debug problems and improve the service.</li>
          <li>To comply with legal obligations and respond to lawful requests.</li>
        </List>
        <p>We do not sell personal information and we do not use Customer data to advertise to anyone.</p>
      </Section>

      <Section id="whatsapp-meta" title="WhatsApp and Meta">
        <p>
          Loopwave sends and receives WhatsApp messages through the official WhatsApp Business Platform (Cloud API) provided by Meta
          Platforms. You connect your own WhatsApp Business Account to Loopwave through Meta's Embedded Signup; you choose which account and
          phone number to share, and Meta shows you the permissions requested.
        </p>
        <List>
          <li>Messages you send and receive pass through Meta's systems and are also subject to Meta's own terms and privacy policies. Meta acts as an independent controller of the data it processes.</li>
          <li>We request only the WhatsApp permissions needed to send and receive messages and to manage message templates for your account.</li>
          <li>Our website loads Meta's JavaScript SDK so the Embedded Signup window can open. When it loads, Meta may receive technical information such as your IP address and browser details.</li>
          <li>You are responsible for having a valid legal basis, including any required opt-in consent, before messaging your contacts, and for following the WhatsApp Business Messaging Policy.</li>
        </List>
      </Section>

      <Section id="sharing" title="Who we share information with">
        <p>We share information only with the following kinds of recipients, and only as needed to run the service:</p>
        <List>
          <li><strong>Meta Platforms</strong> — to deliver WhatsApp messages and manage your WhatsApp Business Account, as described above.</li>
          <li><strong>Infrastructure providers</strong> — web hosting (Vercel), application and worker hosting (Railway), and database hosting (Neon), which store and process data on our behalf.</li>
          <li><strong>Optional service providers, used only when the feature is enabled:</strong> a payment processor (Stripe) for subscriptions; an email delivery provider (Resend) for service emails; an S3-compatible object-storage provider for media files; and an AI provider (OpenAI) for AI-assisted replies and message drafting, to which the conversation or prompt text needed for that request is sent.</li>
          <li><strong>Your workspace</strong> — other members of your workspace can see the Customer data and activity permitted by their role.</li>
          <li><strong>Authorities and advisers</strong> — where required by law, to protect rights and safety, or in a corporate transaction such as a merger, with appropriate safeguards.</li>
        </List>
        <p>These providers are bound to protect the data and to use it only to provide their services to us.</p>
      </Section>

      <Section id="transfers" title="International processing">
        <p>
          Our providers may store and process information in the United States and other countries, which may have different data-protection
          laws from where you live. Where required, we rely on appropriate safeguards for these transfers, such as contractual protections.
        </p>
      </Section>

      <Section id="retention" title="How long we keep information">
        <List>
          <li>
            <strong>Account and workspace data</strong> is kept while your account is active. After you ask us to close it, we delete it
            within <Confirm>30 days</Confirm>, except where we must keep it by law.
          </li>
          <li>
            <strong>Customer data</strong> is kept until you delete it or your workspace is deleted, and is then removed on the same schedule.
            You can delete contacts and other records yourself at any time in the app.
          </li>
          <li>
            <strong>WhatsApp connection data.</strong> When you disconnect a number, Loopwave stops sending and receiving through it.
            The stored connection details, including the encrypted token, are removed when your workspace is deleted, or earlier if you ask
            us to (see the <Link to="/data-deletion" className="text-brand-600 hover:underline">Data Deletion</Link> page).
          </li>
          <li>
            <strong>Webhook and technical logs</strong>, which may contain message content and phone numbers, are kept for up to{' '}
            <Confirm>30 days</Confirm> for reliability and debugging.
          </li>
          <li><strong>Billing records</strong> are kept for as long as tax and accounting law requires.</li>
          <li>Deleted data can remain in encrypted backups for up to <Confirm>35 days</Confirm> before it is overwritten.</li>
        </List>
      </Section>

      <Section id="security" title="Security">
        <p>We use safeguards designed to protect information, including:</p>
        <List>
          <li>Encryption in transit (HTTPS) and encryption of WhatsApp access tokens at rest.</li>
          <li>Passwords stored only as salted hashes; session cookies that scripts on the page cannot read.</li>
          <li>Separation of each workspace's data from other workspaces, and role-based access inside a workspace.</li>
          <li>Verification of the signature on every event notification we receive from Meta, and rate limiting on sensitive endpoints.</li>
        </List>
        <p>No system is perfectly secure. If we become aware of a breach affecting your personal information we will notify you as required by law.</p>
      </Section>

      <Section id="rights" title="Your rights and choices">
        <p>
          Depending on where you live, you may have the right to access, correct, delete, restrict or object to the use of your personal
          information, to receive a portable copy, and to withdraw consent. To exercise these rights over your <strong>account information</strong>,
          email <Owner field="privacyEmail" label="privacy contact email" /> from the address on your account.
        </p>
        <p>
          If you are a <strong>contact of a business that uses Loopwave</strong> (for example you received a WhatsApp message from it), that
          business decides how your data is used, so please contact it first. You can also email us the business name and your number and we
          will assist, or forward your request to the business. To stop receiving messages from a business, reply STOP or use the opt-out
          option it provides.
        </p>
        <p>
          To delete your data see <Link to="/data-deletion" className="text-brand-600 hover:underline">Data Deletion</Link>. You may also have the
          right to complain to your local data-protection authority.
        </p>
      </Section>

      <Section id="cookies" title="Cookies and similar technologies">
        <p>
          We use strictly necessary cookies to keep you signed in and secure your session. We do not currently use advertising or
          third-party analytics cookies. As noted above, Meta's JavaScript SDK is loaded on our pages for WhatsApp Embedded Signup, and
          Meta may set its own cookies or identifiers under its own policies. If we add analytics or advertising tools we will update this
          policy and, where required, ask for your consent.
        </p>
      </Section>

      <Section id="children" title="Children">
        <p>Loopwave is a business service and is not directed at children under 18. We do not knowingly collect personal information from them.</p>
      </Section>

      <Section id="changes" title="Changes to this policy">
        <p>We may update this policy. We will change the "Last updated" date above and, for material changes, notify workspace owners by email or in the app.</p>
      </Section>

      <Section id="contact" title="Contact us">
        <p>
          Privacy questions and requests: <Owner field="privacyEmail" label="privacy contact email" />
          <br />
          General enquiries: <Owner field="contactEmail" label="general contact email" />
          <br />
          Postal address: <Owner field="registeredAddress" label="registered address" />
        </p>
        <p>
          Data protection officer (if appointed): <Owner field="dataProtectionOfficer" label="DPO name and contact, or remove this line if none" />
        </p>
      </Section>
    </LegalPage>
  )
}
