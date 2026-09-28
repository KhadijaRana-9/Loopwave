import { Link } from 'react-router-dom'
import LegalPage, { Confirm, List, Owner, Section } from '@/components/legal/LegalPage'

const SECTIONS = [
  { id: 'in-app', title: 'Delete data yourself in Loopwave' },
  { id: 'request', title: 'Request deletion of your account and workspace' },
  { id: 'what-happens', title: 'What we delete and what we keep' },
  { id: 'contacts', title: 'If you are a contact of a business using Loopwave' },
  { id: 'meta', title: 'If you connected WhatsApp or Facebook / Meta' },
  { id: 'contact', title: 'Questions' },
]

export default function DataDeletion() {
  return (
    <LegalPage
      title="Data Deletion"
      sections={SECTIONS}
      summary="This page explains how to delete the data Loopwave holds about you, your workspace, or your customers. It is also the data-deletion instructions page for our Meta app."
    >
      <Section id="in-app" title="Delete data yourself in Loopwave">
        <p>Signed-in workspace members with the right permissions can remove data directly:</p>
        <List>
          <li><strong>Contacts</strong> — delete one or many contacts from the Contacts page. This also removes their conversations and messages.</li>
          <li><strong>Message templates</strong> — delete a template from the Templates page. If it was submitted to Meta, we also ask Meta to delete it.</li>
          <li><strong>Team members</strong> — remove a member from the Team page to revoke their access.</li>
          <li><strong>WhatsApp numbers</strong> — "Disconnect" on the WhatsApp page immediately stops Loopwave from sending and receiving through that number. Disconnecting alone does not erase the stored connection details; to have those removed, send a deletion request as described below.</li>
        </List>
      </Section>

      <Section id="request" title="Request deletion of your account and workspace">
        <p>
          Account and workspace deletion is handled by our team. Email <Owner field="privacyEmail" label="privacy contact email" /> from the email
          address on your account with the subject <strong>"Delete my Loopwave account"</strong>, and tell us your workspace name. We will:
        </p>
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>Confirm the request came from the account owner, which may involve a verification email, so that nobody can delete your data on your behalf without your consent.</li>
          <li>Delete your account and workspace within <Confirm>30 days</Confirm> of verification, and confirm to you by email when it is done.</li>
        </ol>
        <p>If you only want a specific person, contact or conversation removed, tell us which and we will remove just that.</p>
      </Section>

      <Section id="what-happens" title="What we delete and what we keep">
        <p><strong>Deleted:</strong> your workspace, its users and memberships, contacts, conversations and messages, campaigns and templates, forms, chatbot and automation settings, uploaded media, and the stored WhatsApp connection details including the encrypted access token.</p>
        <p><strong>Kept for a limited time:</strong></p>
        <List>
          <li>Technical webhook and error logs, which can contain message content and phone numbers, for up to <Confirm>30 days</Confirm>.</li>
          <li>Encrypted backups, which are overwritten on a rolling basis within <Confirm>35 days</Confirm>.</li>
          <li>Billing and tax records, for as long as the law requires.</li>
          <li>Information we must keep to comply with legal obligations, resolve disputes or prevent fraud and abuse.</li>
        </List>
        <p>
          Messages that were already delivered to WhatsApp users, and data held by Meta, are outside Loopwave's control — see the section below on
          Meta.
        </p>
      </Section>

      <Section id="contacts" title="If you are a contact of a business using Loopwave">
        <p>
          If a business messaged you on WhatsApp through Loopwave, that business decides how your data is used and is best placed to delete it, so
          please ask the business first. You can also email <Owner field="privacyEmail" label="privacy contact email" /> with the name of the
          business and the phone number you were messaged on, and we will help or pass your request on to the business. To stop further messages,
          reply STOP or use the opt-out the business provides.
        </p>
      </Section>

      <Section id="meta" title="If you connected WhatsApp or Facebook / Meta">
        <p>Loopwave receives from Meta only the WhatsApp Business Account information you authorised when you connected. To withdraw that access:</p>
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>In your Meta Business settings (or Facebook settings, under business integrations), find Loopwave among the connected apps and remove it. Loopwave can then no longer use the access token it was issued.</li>
          <li>Email us using the steps above so we also delete the connection details and other data we hold.</li>
        </ol>
        <p>
          Data that Meta holds about you is governed by Meta's own policies and can be managed through Meta's privacy tools. See our{' '}
          <Link to="/privacy" className="text-brand-600 hover:underline">Privacy Policy</Link> for how we handle information.
        </p>
      </Section>

      <Section id="contact" title="Questions">
        <p>
          <Owner field="privacyEmail" label="privacy contact email" />
          <br />
          <Owner field="legalEntityName" label="legal entity name" />, <Owner field="registeredAddress" label="registered address" />
        </p>
      </Section>
    </LegalPage>
  )
}
