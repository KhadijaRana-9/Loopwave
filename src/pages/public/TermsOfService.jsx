import { Link } from 'react-router-dom'
import LegalPage, { Confirm, List, Owner, Section } from '@/components/legal/LegalPage'

const SECTIONS = [
  { id: 'agreement', title: 'Agreement and eligibility' },
  { id: 'service', title: 'The service' },
  { id: 'accounts', title: 'Accounts and security' },
  { id: 'your-data', title: 'Your data and your responsibilities' },
  { id: 'whatsapp', title: 'WhatsApp and Meta' },
  { id: 'acceptable-use', title: 'Acceptable use' },
  { id: 'plans-billing', title: 'Plans, trials and billing' },
  { id: 'ai', title: 'AI features' },
  { id: 'ip', title: 'Intellectual property' },
  { id: 'privacy', title: 'Privacy' },
  { id: 'availability', title: 'Availability and support' },
  { id: 'termination', title: 'Suspension and termination' },
  { id: 'disclaimers', title: 'Disclaimers' },
  { id: 'liability', title: 'Limitation of liability' },
  { id: 'indemnity', title: 'Indemnification' },
  { id: 'law', title: 'Governing law' },
  { id: 'changes', title: 'Changes to these terms' },
  { id: 'contact', title: 'Contact' },
]

export default function TermsOfService() {
  return (
    <LegalPage
      title="Terms of Service"
      sections={SECTIONS}
      summary="These terms govern your use of Loopwave. By creating a workspace or using the service you agree to them. Please read them together with our Privacy Policy."
    >
      <Section id="agreement" title="Agreement and eligibility">
        <p>
          These Terms are an agreement between you and <Owner field="legalEntityName" label="legal entity name" /> ("Loopwave", "we", "us").
          If you use Loopwave on behalf of a business, you confirm that you have authority to bind that business, and "you" includes it.
          You must be at least 18 and able to form a binding contract.
        </p>
      </Section>

      <Section id="service" title="The service">
        <p>
          Loopwave provides tools for businesses to connect their WhatsApp Business Account, manage contacts, run a shared team inbox,
          send template and campaign messages, and automate conversations. Features depend on your plan and may change over time.
        </p>
      </Section>

      <Section id="accounts" title="Accounts and security">
        <List>
          <li>Give accurate information and keep it up to date.</li>
          <li>Keep your credentials confidential. You are responsible for activity under your account and by the team members you invite, and should tell us promptly of any unauthorised use.</li>
          <li>Assign roles to team members according to the access they need.</li>
        </List>
      </Section>

      <Section id="your-data" title="Your data and your responsibilities">
        <p>
          You keep ownership of the contacts, messages and other content you put into Loopwave ("Customer Data"). You give us the limited
          right to host, process and transmit it to provide the service to you. For Customer Data that is personal information about your
          contacts, you are the controller and we are your processor, as described in our <Link to="/privacy" className="text-brand-600 hover:underline">Privacy Policy</Link>.
        </p>
        <p>You are responsible for:</p>
        <List>
          <li>Having a lawful basis, and where required the recorded opt-in consent of each recipient, before you message them, and honouring opt-outs promptly.</li>
          <li>The content you send, and for complying with all laws that apply to your messaging, marketing and industry.</li>
          <li>The accuracy and legality of the contact data you upload or collect.</li>
        </List>
        <p>Loopwave records opt-in and opt-out status to help you comply, but does not make the legal decision for you.</p>
      </Section>

      <Section id="whatsapp" title="WhatsApp and Meta">
        <List>
          <li>Loopwave uses the WhatsApp Business Platform provided by Meta. Your use of WhatsApp through Loopwave is also subject to Meta's terms and policies, including the WhatsApp Business Terms of Service, the WhatsApp Business Messaging Policy and the WhatsApp Commerce Policy. You are responsible for reading and following them.</li>
          <li>You connect your own WhatsApp Business Account. Message templates must be approved by Meta before they can be sent, and Meta decides whether to approve, pause or reject them.</li>
          <li>Meta charges for template messages directly to your WhatsApp Business Account under its own pricing. Those charges are separate from, and not included in, your Loopwave plan.</li>
          <li>Meta may change its platform, pricing, limits or policies, or restrict or suspend a phone number or account (for example for low quality ratings or policy violations). We are not responsible for Meta's decisions or for any interruption or loss that results.</li>
          <li>Loopwave is not affiliated with, endorsed by or sponsored by Meta or WhatsApp.</li>
        </List>
      </Section>

      <Section id="acceptable-use" title="Acceptable use">
        <p>You must not use Loopwave to:</p>
        <List>
          <li>Send unsolicited or bulk messages, spam, or messages to people who have not opted in where opt-in is required, or ignore opt-out requests.</li>
          <li>Send unlawful, deceptive, harassing, hateful, sexually exploitative or otherwise harmful content, or promote goods and services that WhatsApp's policies prohibit.</li>
          <li>Infringe intellectual property or privacy rights, or collect personal data unlawfully.</li>
          <li>Probe, disrupt or overload the service, bypass plan limits or security controls, reverse engineer it, or access another workspace's data.</li>
          <li>Resell or provide the service to third parties except as we expressly allow in writing.</li>
        </List>
        <p>We may investigate suspected violations and remove content or suspend access where we reasonably believe these rules are broken.</p>
      </Section>

      <Section id="plans-billing" title="Plans, trials and billing">
        <List>
          <li>Loopwave is offered on plans with different limits. A free trial may be offered; when it ends you need a paid plan to continue using paid features.</li>
          <li>Paid plans are billed in advance for the period shown, are subject to applicable taxes, and renew automatically until cancelled.</li>
          <li>You can cancel at any time; cancellation takes effect at the end of the current billing period. Fees already paid are non-refundable except where the law requires or as stated at purchase: <Confirm>no refunds for partial periods</Confirm>.</li>
          <li>We may change prices with reasonable advance notice; changes apply from your next renewal.</li>
        </List>
      </Section>

      <Section id="ai" title="AI features">
        <p>
          Where enabled, AI features generate suggested replies, drafts or summaries using a third-party AI provider. AI output can be
          inaccurate, incomplete or inappropriate. You are responsible for reviewing it before it is sent to anyone and for how you use it.
          Do not rely on AI output for legal, medical or financial advice.
        </p>
      </Section>

      <Section id="ip" title="Intellectual property">
        <p>
          Loopwave, including its software, design and branding, is owned by us and our licensors. We grant you a limited, non-exclusive,
          non-transferable right to use the service during your subscription. If you send us feedback, you allow us to use it without
          restriction or payment.
        </p>
      </Section>

      <Section id="privacy" title="Privacy">
        <p>
          Our <Link to="/privacy" className="text-brand-600 hover:underline">Privacy Policy</Link> explains how we handle personal information, and the{' '}
          <Link to="/data-deletion" className="text-brand-600 hover:underline">Data Deletion</Link> page explains how to have data removed.
        </p>
      </Section>

      <Section id="availability" title="Availability and support">
        <p>
          We work to keep Loopwave available but do not guarantee uninterrupted or error-free operation. The service depends on third parties,
          including Meta and our infrastructure providers, that we do not control. We may perform maintenance and will try to give notice of
          planned downtime. Support is provided through <Owner field="contactEmail" label="support/contact email" />.
        </p>
      </Section>

      <Section id="termination" title="Suspension and termination">
        <p>
          You may stop using Loopwave and close your workspace at any time. We may suspend or terminate access immediately if you breach these
          Terms, if required by law or by Meta, if your account poses a security risk, or for non-payment. On termination your right to use
          the service ends. You can request deletion of your data as described on the Data Deletion page.
        </p>
      </Section>

      <Section id="disclaimers" title="Disclaimers">
        <p>
          To the fullest extent permitted by law, the service is provided "as is" and "as available", without warranties of any kind, whether
          express or implied, including merchantability, fitness for a particular purpose, non-infringement, and that message delivery,
          template approval or third-party services will be uninterrupted, timely or error-free.
        </p>
      </Section>

      <Section id="liability" title="Limitation of liability">
        <p>
          To the fullest extent permitted by law, we are not liable for indirect, incidental, special, consequential or punitive damages, or
          for lost profits, revenue, data or goodwill. Our total liability arising out of these Terms or the service is limited to the fees you
          paid us in the <Confirm>12 months</Confirm> before the event giving rise to the claim. Nothing in these Terms excludes liability that cannot be
          excluded by law.
        </p>
      </Section>

      <Section id="indemnity" title="Indemnification">
        <p>
          You will defend and indemnify us against claims, losses and expenses (including reasonable legal fees) arising from your Customer
          Data, your messaging, or your breach of these Terms or applicable law, including any claim that you messaged someone without the
          consent the law requires.
        </p>
      </Section>

      <Section id="law" title="Governing law">
        <p>
          These Terms are governed by <Owner field="jurisdiction" label="governing law and courts, e.g. the laws of [country/state]" />, and its courts have
          exclusive jurisdiction, except where mandatory consumer law says otherwise.
        </p>
      </Section>

      <Section id="changes" title="Changes to these terms">
        <p>
          We may update these Terms. We will change the "Last updated" date and, for material changes, give notice by email or in the app.
          Continued use after the change takes effect means you accept the updated Terms.
        </p>
      </Section>

      <Section id="contact" title="Contact">
        <p>
          <Owner field="legalEntityName" label="legal entity name" />, <Owner field="registeredAddress" label="registered address" />
          <br />
          <Owner field="contactEmail" label="contact email" />
        </p>
      </Section>
    </LegalPage>
  )
}
