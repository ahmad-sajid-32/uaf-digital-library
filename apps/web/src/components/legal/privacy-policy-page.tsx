// apps/web/src/components/legal/privacy-policy-page.tsx
/**
 * Institutional privacy notice page for the UAF Smart E-Library platform.
 *
 * This screen is intentionally written as a legal/transparency surface for a
 * university-operated service, not as marketing copy. It mirrors the guest
 * experience styling while switching the layout from a centered auth card to a
 * wide, readable policy document with section navigation and bounded callouts.
 */

"use client";

import Link from "next/link";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getStaggeredRevealDelay,
  getStaggeredRevealDirection,
  ScrollReveal,
} from "@/components/ui/scroll-reveal";

const PAGE_META = {
  effectiveDate: "March 25, 2026",
  lastUpdated: "March 25, 2026",
  serviceName: "UAF Smart E-Library & University Information Assistant",
};

const QUICK_SUMMARY_ITEMS = [
  "The service is intended for students, librarians, administrators, and other authorized institutional users.",
  "Core information includes account details, role assignments, library transactions, queue entries, fines, and operational logs.",
  "Information is used to run authenticated library workflows, document retrieval, AI assistance, security checks, and administrative reporting.",
  "Access is role-controlled through institution-managed identity, database-enforced authorization, and monitored operational boundaries.",
  "The AI assistant is designed to answer from official uploaded documents only and should not be treated as a general-purpose advisor.",
  "Privacy and account concerns should be directed to the published support contact before production launch.",
];

const SECTION_NAV_ITEMS = [
  ["overview", "Overview"],
  ["information-we-collect", "Information We Collect"],
  ["how-we-use-information", "How We Use Information"],
  ["role-based-access", "Role-Based Access"],
  ["ai-assistant-document-processing", "AI Assistant & Document Processing"],
  ["cookies-sessions-technical-data", "Cookies / Sessions / Technical Data"],
  ["sharing-of-information", "Sharing of Information"],
  ["data-retention", "Data Retention"],
  ["security", "Security"],
  ["user-rights-requests", "User Rights & Requests"],
  ["international-hosting-transfers", "International Hosting / Transfers"],
  ["children-student-use", "Children / Student Use"],
  ["policy-updates", "Policy Updates"],
  ["contact", "Contact"],
] as const;

function PrivacySection({
  id,
  title,
  revealIndex,
  children,
}: {
  id: string;
  title: string;
  revealIndex: number;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <ScrollReveal
      direction={getStaggeredRevealDirection(revealIndex)}
      delayMs={getStaggeredRevealDelay(revealIndex, 55)}
    >
    <section
      id={id}
      className="scroll-mt-24 space-y-4 border-b border-border/50 pb-8 last:border-b-0 last:pb-0"
    >
      <div className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary/80">
          Section
        </p>
        <h2 className="font-display text-2xl font-black tracking-tight text-foreground">
          {title}
        </h2>
      </div>
      <div className="space-y-4 text-sm leading-7 text-muted-foreground [&>ul]:space-y-2 [&>ul]:pl-5 [&>ul]:list-disc">
        {children}
      </div>
    </section>
    </ScrollReveal>
  );
}

function ImportantCallout({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="rounded-2xl border border-primary/25 bg-primary/10 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">
        {title}
      </p>
      <div className="mt-2 text-sm leading-7 text-foreground/85">{children}</div>
    </div>
  );
}

export function PrivacyPolicyPage(): React.JSX.Element {
  return (
    <div className="w-full self-stretch py-8 sm:py-10 lg:py-12">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 lg:gap-8">
        <ScrollReveal direction="up" delayMs={30}>
        <Card className="border-border/60 bg-card/95 shadow-md shadow-primary/10">
          <CardHeader className="space-y-5 px-5 py-6 sm:px-7 lg:px-8">
            <div className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-primary/80">
                Institutional Service Notice
              </p>
              <div className="space-y-3">
                <h1 className="font-display text-4xl font-black tracking-tight text-foreground sm:text-5xl">
                  Privacy Policy
                </h1>
                <p className="max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
                  This page explains how the UAF Smart E-Library & University
                  Information Assistant collects, uses, stores, protects, and
                  discloses data when the service is used in an academic and
                  operational context.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="rounded-full border border-border/60 bg-muted/60 px-3 py-1.5">
                Effective Date: {PAGE_META.effectiveDate}
              </span>
              <span className="rounded-full border border-border/60 bg-muted/60 px-3 py-1.5">
                Last Updated: {PAGE_META.lastUpdated}
              </span>
              <span className="rounded-full border border-border/60 bg-muted/60 px-3 py-1.5">
                Service: {PAGE_META.serviceName}
              </span>
            </div>
          </CardHeader>
        </Card>
        </ScrollReveal>

        <ScrollReveal direction="right" delayMs={80}>
        <Card className="border-border/60 bg-card/95 shadow-md shadow-primary/10">
          <CardHeader className="px-5 pb-3 pt-5 sm:px-7">
            <CardTitle className="font-display text-2xl font-black tracking-tight text-foreground">
              Quick Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 sm:px-7">
            <ul className="grid gap-3 text-sm leading-7 text-muted-foreground lg:grid-cols-2">
              {QUICK_SUMMARY_ITEMS.map((item, index) => (
                <li key={item} className="list-none">
                  <ScrollReveal
                    direction={getStaggeredRevealDirection(index)}
                    delayMs={getStaggeredRevealDelay(index, 60, 100)}
                    className="h-full"
                  >
                    <div className="rounded-2xl border border-border/60 bg-muted/40 px-4 py-3">
                      {item}
                    </div>
                  </ScrollReveal>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        </ScrollReveal>

        <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <ScrollReveal direction="left" delayMs={70}>
            <Card className="border-border/60 bg-card/95 shadow-md shadow-primary/10">
              <CardHeader className="px-5 pb-3 pt-5">
                <CardTitle className="font-display text-xl font-black tracking-tight text-foreground">
                  On This Page
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <nav aria-label="Privacy policy sections">
                  <ul className="space-y-2.5">
                    {SECTION_NAV_ITEMS.map(([id, label]) => (
                      <li key={id}>
                        <a
                          href={`#${id}`}
                          className="text-sm text-muted-foreground transition-colors hover:text-primary"
                        >
                          {label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
              </CardContent>
            </Card>
            </ScrollReveal>
          </aside>

          <ScrollReveal direction="down" delayMs={90}>
          <Card className="border-border/60 bg-card/95 shadow-md shadow-primary/10">
            <CardContent className="space-y-8 px-5 py-6 sm:px-7 lg:px-8">
              <PrivacySection id="overview" title="1. Overview" revealIndex={0}>
                <p>
                  The UAF Smart E-Library & University Information Assistant is
                  a university-oriented digital platform designed to support
                  library management and access to verified university
                  information. The system allows authorized users to access
                  library services, view book availability, manage borrowing and
                  returns, track fines and queue status, and use an AI assistant
                  that responds using official uploaded university documents
                  only.
                </p>
                <p>
                  This service is intended for real deployment and is built
                  around institution-managed access, role-based boundaries, and
                  database-enforced operational controls. This Privacy Policy
                  explains what information the service processes, why that
                  processing happens, and what limits or rights apply.
                </p>
              </PrivacySection>

              <PrivacySection
                id="information-we-collect"
                title="2. Information We Collect"
                revealIndex={1}
              >
                <p>The service may collect and process the following categories of information:</p>
                <ul>
                  <li>
                    Account and identity data such as full name, university
                    email address, role assignment, internal account identifiers,
                    and profile metadata needed for system access.
                  </li>
                  <li>
                    Library usage data such as searched books, viewed books,
                    borrow and return activity, due dates, queue entries, fines,
                    and related transactional records.
                  </li>
                  <li>
                    Administrative and operational data such as user-management
                    actions, book-management actions, fine review actions,
                    document upload events, and dashboard activity used to run
                    the platform.
                  </li>
                  <li>
                    AI assistant inputs and retrieval metadata such as user
                    questions, matched document excerpts, citations, document
                    source labels, and indexing metadata for uploaded official
                    documents.
                  </li>
                  <li>
                    Technical and session data such as authentication/session
                    state, timestamps, request logs, browser details, device
                    details, error events, and security signals needed to keep
                    the service stable and defensible.
                  </li>
                  <li>
                    Communications and support data if a user contacts support
                    or submits a privacy or account issue.
                  </li>
                </ul>
              </PrivacySection>

              <PrivacySection
                id="how-we-use-information"
                title="3. How We Use Information"
                revealIndex={2}
              >
                <p>Information is used to operate the service, not to manufacture unrelated marketing profiles.</p>
                <ul>
                  <li>Create and manage institution-issued accounts.</li>
                  <li>Authenticate users and maintain secure sessions.</li>
                  <li>Enforce role-based access to books, operations, and records.</li>
                  <li>Run borrowing, returns, queue handling, renewals, and fine tracking.</li>
                  <li>Support administration of books, users, and official documents.</li>
                  <li>Generate AI responses grounded in official uploaded documents.</li>
                  <li>Maintain auditability, diagnostics, security monitoring, and service reliability.</li>
                  <li>Produce operational analytics and dashboard summaries derived from platform activity.</li>
                </ul>
              </PrivacySection>

              <PrivacySection
                id="role-based-access"
                title="4. Role-Based Access"
                revealIndex={3}
              >
                <p>
                  This service is not designed for unrestricted access.
                  Identity is managed through Supabase Auth, while
                  authorization is enforced in PostgreSQL through row-level
                  security and related access controls. FastAPI acts as a thin
                  API layer rather than the source of truth for business access
                  rules.
                </p>
                <ul>
                  <li>Students should only see their own account and library activity.</li>
                  <li>Librarians may manage operational library records within approved scope.</li>
                  <li>Administrators may manage broader platform functions, users, documents, and system-level monitoring.</li>
                </ul>
                <ImportantCallout title="Important Note">
                  Institutional access may include audit logging, administrative
                  review, and role-based visibility needed for service operation,
                  incident response, or compliance with internal university
                  rules. This is a controlled academic system, not a private
                  personal notebook.
                </ImportantCallout>
              </PrivacySection>

              <PrivacySection
                id="ai-assistant-document-processing"
                title="5. AI Assistant & Document Processing"
                revealIndex={4}
              >
                <p>
                  The AI assistant is intended to answer questions using
                  official uploaded university documents only. It is not meant
                  to improvise unsupported answers from general model knowledge
                  when no verified source is available. The system is designed
                  to return a fallback message when relevant official material
                  cannot be retrieved above the configured threshold.
                </p>
                <p>
                  Authorized institutional users may upload official documents
                  for indexing and retrieval. When documents are updated or
                  replaced, the architecture is designed to preserve indexing
                  integrity rather than silently overwrite or mix old and new
                  source material.
                </p>
                <ImportantCallout title="AI Limitation">
                  Users should not submit unnecessary sensitive personal
                  information in general AI assistant questions. The assistant
                  is meant for official document retrieval and cited answers,
                  not for private counseling, unrestricted profiling, or general
                  confidential disclosure.
                </ImportantCallout>
              </PrivacySection>

              <PrivacySection
                id="cookies-sessions-technical-data"
                title="6. Cookies / Sessions / Technical Data"
                revealIndex={5}
              >
                <p>
                  The service may use cookies, local storage, or similar session
                  technologies to maintain authentication state, remember login
                  context, and support recovery or invited-user password setup
                  flows. Authentication and redirect handling rely on Supabase
                  session behavior, while backend services validate tokens and
                  the database enforces access restrictions.
                </p>
                <p>
                  If non-essential analytics or preference tracking is added in
                  the future, this notice and any related consent or preference
                  controls should be updated accordingly instead of pretending no
                  such technologies exist.
                </p>
              </PrivacySection>

              <PrivacySection
                id="sharing-of-information"
                title="7. Sharing of Information"
                revealIndex={6}
              >
                <p>
                  The platform is not described as a free-for-all data-sharing
                  system. Information may be shared only where required for
                  legitimate hosting, authentication, storage, notifications,
                  maintenance, institutional operations, legal compliance, or
                  security response.
                </p>
                <ul>
                  <li>Hosting, storage, and infrastructure providers.</li>
                  <li>Authentication and session providers.</li>
                  <li>Authorized university staff operating the service.</li>
                  <li>Support, maintenance, or notification providers where required.</li>
                  <li>Authorities or regulators where a lawful or formal process requires disclosure.</li>
                </ul>
              </PrivacySection>

              <PrivacySection
                id="data-retention"
                title="8. Data Retention"
                revealIndex={7}
              >
                <p>
                  Information is kept only as long as it is needed for
                  operational, academic, administrative, legal, security, or
                  audit purposes. Different categories have different retention
                  needs.
                </p>
                <ul>
                  <li>Account records may remain while an account is active and for a reasonable period afterward.</li>
                  <li>Borrow, return, queue, and fine records may be retained longer because they form part of library operational history.</li>
                  <li>Official uploaded documents may remain available as long as institutional reference and retrieval require them.</li>
                  <li>Technical logs may be retained for a limited diagnostic and security window.</li>
                </ul>
                <ImportantCallout title="Retention Limit">
                  Account deletion or deactivation does not necessarily erase
                  every operational or audit record immediately. Some information
                  may need to remain where the institution has a valid
                  operational, security, academic, legal, or evidentiary reason
                  to keep it.
                </ImportantCallout>
              </PrivacySection>

              <PrivacySection id="security" title="9. Security" revealIndex={8}>
                <p>
                  The platform uses authenticated access, controlled operational
                  workflows, transactional integrity, protected document
                  processing, and database-enforced authorization boundaries.
                  That design is intended to reduce unauthorized access and
                  inconsistent state, not to promise impossible perfection.
                </p>
                <p>
                  No system can promise absolute security. Users are also
                  expected to protect their credentials, use strong passwords,
                  and report suspicious access or misuse promptly.
                </p>
              </PrivacySection>

              <PrivacySection
                id="user-rights-requests"
                title="10. User Rights & Requests"
                revealIndex={9}
              >
                <p>
                  Users may request access to, correction of, or clarification
                  about personal information held about them, subject to
                  identity verification, technical feasibility, institutional
                  rules, record integrity, and any legal or administrative
                  obligations.
                </p>
                <ul>
                  <li>Correction of inaccurate profile details.</li>
                  <li>Review of certain account-related information.</li>
                  <li>Deletion or deactivation requests where appropriate.</li>
                  <li>Clarification about how account and operational data is used.</li>
                  <li>Help regarding security or privacy concerns.</li>
                </ul>
                <p>
                  Some requests may be limited or denied where records must be
                  retained for operational, legal, academic, or security
                  reasons.
                </p>
              </PrivacySection>

              <PrivacySection
                id="international-hosting-transfers"
                title="11. International Hosting / Transfers"
                revealIndex={10}
              >
                <p>
                  Depending on deployment and third-party providers, data may be
                  processed on infrastructure located outside a user’s physical
                  location or outside Pakistan. This matters because privacy
                  protections may depend on provider architecture, contractual
                  controls, institutional governance, and the specific laws that
                  apply to the deployment context.
                </p>
                <p>
                  Before production launch, this section should be updated with
                  the real hosting regions and provider categories rather than
                  leaving deployment facts vague.
                </p>
              </PrivacySection>

              <PrivacySection
                id="children-student-use"
                title="12. Children / Student Use"
                revealIndex={11}
              >
                <p>
                  This service is designed for use in an academic and
                  institutional environment. Users are expected to use it for
                  legitimate educational, administrative, and library-related
                  purposes. The platform may process student-related data,
                  librarian activity, administrator actions, and official
                  university document interactions as part of those workflows.
                </p>
              </PrivacySection>

              <PrivacySection
                id="policy-updates"
                title="13. Policy Updates"
                revealIndex={12}
              >
                <p>
                  This Privacy Policy may be updated over time to reflect
                  changes in the service, security controls, deployment model,
                  legal obligations, institutional requirements, or platform
                  features.
                </p>
                <p>
                  When material changes are made, the “Last Updated” date should
                  be revised and suitable notice should be provided through the
                  application or related communication channels where
                  appropriate.
                </p>
              </PrivacySection>

              <PrivacySection id="contact" title="14. Contact" revealIndex={13}>
                <p>
                  For privacy-related questions, account concerns, correction
                  requests, or security issues, the current operational contact
                  exposed in the guest experience is:
                </p>
                <div className="rounded-2xl border border-border/60 bg-muted/40 p-4 text-sm leading-7 text-muted-foreground">
                  <p>
                    <span className="font-semibold text-foreground">
                      Privacy / Support Contact:
                    </span>{" "}
                    Student Assistance
                  </p>
                  <p>
                    <span className="font-semibold text-foreground">Email:</span>{" "}
                    ahmadsajid41324@gmail.com
                  </p>
                  <p>
                    <span className="font-semibold text-foreground">
                      University:
                    </span>{" "}
                    University of Agriculture Faisalabad
                  </p>                  
                </div>
              </PrivacySection>
            </CardContent>
          </Card>
          </ScrollReveal>
        </div>

        <ScrollReveal direction="up-right" delayMs={110}>
        <Card className="border-border/60 bg-card/95 shadow-md shadow-primary/10">
          <CardContent className="flex flex-col gap-3 px-5 py-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-7">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary/80">
                Legal Navigation
              </p>
              <p className="text-sm text-muted-foreground">
                Return to authentication or continue to the next legal surfaces
                as they are implemented.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild className="rounded-xl">
                <Link href="/login">Back to Login</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-xl">
                <Link href="/terms-of-use">Terms of Use</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-xl">
                <Link href="/library-rules">Library Rules</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
        </ScrollReveal>
      </div>
    </div>
  );
}
