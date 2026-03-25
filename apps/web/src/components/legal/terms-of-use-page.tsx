// apps/web/src/components/legal/terms-of-use-page.tsx
/**
 * Institutional terms-of-use screen for the UAF Smart E-Library platform.
 *
 * The page is written as a university-operated service conditions notice, not
 * as a generic SaaS terms page. It mirrors the privacy page layout so legal
 * navigation remains consistent across the guest experience.
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
  "This is a university-operated academic service for library operations and verified university information access.",
  "Use is limited to authorized users and any public-facing features that are intentionally exposed by the institution.",
  "Accounts are institution-managed. There is no public signup model in the current service architecture.",
  "Borrowing, queues, fines, damaged-material obligations, and related library responsibilities continue to apply.",
  "The AI assistant is limited to official uploaded documents and should not be treated as unrestricted advice.",
  "Misuse, policy breach, or operational abuse may result in access restriction, suspension, or other institutional action.",
  "This page operates alongside the Privacy Policy, Library Rules, and any stricter university or library requirements.",
];

const SECTION_NAV_ITEMS = [
  ["overview", "Overview"],
  ["eligibility-and-access", "Eligibility and Access"],
  ["institutional-accounts", "Institutional Accounts"],
  ["role-based-use", "Role-Based Use"],
  ["library-services-and-transactions", "Library Services and Transactions"],
  ["fines-damage-and-lost-materials", "Fines, Damage, and Lost Materials"],
  ["digital-resources-and-documents", "Digital Resources and Documents"],
  ["ai-assistant-use", "AI Assistant Use"],
  ["acceptable-use", "Acceptable Use"],
  ["prohibited-conduct", "Prohibited Conduct"],
  ["availability-and-changes", "Availability and Changes"],
  ["suspension-and-termination", "Suspension and Termination"],
  ["intellectual-property", "Intellectual Property"],
  ["disclaimer-of-service-limits", "Disclaimer of Service Limits"],
  ["changes-to-these-terms", "Changes to These Terms"],
  ["contact", "Contact"],
] as const;

function TermsSection({
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
      <div className="space-y-4 text-sm leading-7 text-muted-foreground [&>ul]:list-disc [&>ul]:space-y-2 [&>ul]:pl-5">
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
      <div className="mt-2 text-sm leading-7 text-foreground/85">
        {children}
      </div>
    </div>
  );
}

export function TermsOfUsePage(): React.JSX.Element {
  return (
    <div className="w-full self-stretch py-8 sm:py-10 lg:py-12">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 lg:gap-8">
        <ScrollReveal direction="up" delayMs={30}>
        <Card className="border-border/60 bg-card/95 shadow-md shadow-primary/10">
          <CardHeader className="space-y-5 px-5 py-6 sm:px-7 lg:px-8">
            <div className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-primary/80">
                Institutional Service Conditions
              </p>
              <div className="space-y-3">
                <h1 className="font-display text-4xl font-black tracking-tight text-foreground sm:text-5xl">
                  Terms of Use
                </h1>
                <p className="max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
                  Rules and conditions for using the UAF Smart E-Library &
                  University Information Assistant within an academic,
                  institution-managed environment.
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
              In Summary
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
                <nav aria-label="Terms of use sections">
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
              <TermsSection id="overview" title="1. Overview" revealIndex={0}>
                <p>
                  These Terms of Use govern access to and use of the UAF Smart
                  E-Library & University Information Assistant. The platform is
                  intended to support library services and access to verified
                  university information within an academic and institutional
                  environment at the University of Agriculture Faisalabad.
                </p>
                <p>
                  The service includes book catalog access, availability
                  tracking, borrowing and return workflows, queue management,
                  fine-related records, administrative controls, digital
                  resource handling, and an AI assistant that responds using
                  official uploaded university documents only.
                </p>
                <p>
                  By accessing or using the service, users agree to follow these
                  Terms of Use, the applicable Privacy Policy, and any separate
                  library rules, university rules, or operational policies that
                  apply to their role or use of the system.
                </p>
              </TermsSection>

              <TermsSection
                id="eligibility-and-access"
                title="2. Eligibility and Access"
                revealIndex={1}
              >
                <p>
                  This service is intended for authorized academic and
                  institutional use. Access may be available to students,
                  librarians, administrators, authorized university staff, and
                  users of any public-facing features that are intentionally
                  exposed by the platform.
                </p>
                <p>
                  The system is not designed as an open public-signup platform.
                  The current auth model is institution-controlled, which means
                  account creation and activation are governed by authorized
                  operators rather than public self-registration.
                </p>
              </TermsSection>

              <TermsSection
                id="institutional-accounts"
                title="3. Institutional Accounts"
                revealIndex={2}
              >
                <p>
                  User accounts are institution-managed service accounts.
                  Depending on the workflow, accounts may be created, invited,
                  activated, updated, suspended, or removed by authorized
                  university administrators or system operators.
                </p>
                <ul>
                  <li>Keep credentials secure.</li>
                  <li>
                    Do not share passwords or active sessions with others.
                  </li>
                  <li>
                    Update the password when required by the service or
                    institution.
                  </li>
                  <li>Report suspected unauthorized access promptly.</li>
                  <li>
                    Do not impersonate another person or misuse another account.
                  </li>
                </ul>
                <ImportantCallout title="Institutional Account Ownership">
                  Accounts in this service are issued for institutional use.
                  Access can be restricted, reset, suspended, or removed by
                  authorized operators when platform security, eligibility, or
                  policy compliance requires it.
                </ImportantCallout>
              </TermsSection>

              <TermsSection
                id="role-based-use"
                title="4. Role-Based Use"
                revealIndex={3}
              >
                <p>
                  The platform uses role-based access and database-enforced
                  authorization controls. Identity is handled through Supabase
                  Auth, while authorization is enforced through PostgreSQL
                  row-level security and related access controls.
                </p>
                <ul>
                  <li>
                    Students may use student-appropriate features and their own
                    records.
                  </li>
                  <li>
                    Librarians may manage approved operational library
                    functions.
                  </li>
                  <li>
                    Administrators may manage broader system functions, users,
                    documents, and monitoring surfaces.
                  </li>
                </ul>
                <p>
                  Users may access only the functions and data permitted for
                  their assigned role.
                </p>
              </TermsSection>

              <TermsSection
                id="library-services-and-transactions"
                title="5. Library Services and Transactions"
                revealIndex={4}
              >
                <p>
                  The platform supports library-related functions such as
                  viewing books and availability, requesting or receiving book
                  issuance, renewals where allowed, returns, queue
                  participation, due-date tracking, and fine tracking.
                </p>
                <p>
                  Borrowing, return, queue, and fine workflows are
                  platform-governed operations. Users must not attempt to
                  manipulate system state, interfere with transaction handling,
                  or misuse the platform to obtain books, extend access, or
                  avoid platform rules.
                </p>
              </TermsSection>

              <TermsSection
                id="fines-damage-and-lost-materials"
                title="6. Fines, Damage, and Lost Materials"
                revealIndex={5}
              >
                <p>
                  Users are responsible for library materials issued to them
                  through the service, including responsibility for overdue
                  returns, damaged items, or lost materials, subject to
                  applicable library and university rules.
                </p>
                <p>
                  Fines are configurable, may depend on book configuration and
                  role policy, and may be recalculated where due dates are
                  adjusted through authorized workflows. Lost or damaged
                  materials may also trigger replacement-value and prescribed
                  penalty obligations under applicable library practice.
                </p>
                <ImportantCallout title="Material Responsibility">
                  These Terms do not replace official library penalties,
                  recovery procedures, clearance requirements, or university
                  administrative actions that may apply outside the software
                  itself. Outstanding obligations do not disappear because a
                  screen is closed.
                </ImportantCallout>
              </TermsSection>

              <TermsSection
                id="digital-resources-and-documents"
                title="7. Digital Resources and Documents"
                revealIndex={6}
              >
                <p>
                  The service may include digital books, institutional
                  documents, or other academic resources. Authorized users such
                  as librarians and administrators may manage books, digital
                  resources, and verified university documents within the scope
                  of their role.
                </p>
                <ul>
                  <li>
                    Do not upload unauthorized, unlawful, or malicious content.
                  </li>
                  <li>
                    Do not alter official documents outside authorized
                    workflows.
                  </li>
                  <li>
                    Do not distribute restricted academic or institutional
                    content without permission.
                  </li>
                  <li>
                    Do not use the platform to store unrelated personal or
                    unauthorized files.
                  </li>
                </ul>
                <p>
                  Institutional documents remain subject to university
                  ownership, policy, and administrative control.
                </p>
              </TermsSection>

              <TermsSection
                id="ai-assistant-use"
                title="8. AI Assistant Use"
                revealIndex={7}
              >
                <p>
                  The AI assistant is designed to respond using official
                  uploaded university documents only. It is not intended to
                  serve as a general-purpose chatbot, a substitute for official
                  authority, or a source of invented answers.
                </p>
                <ul>
                  <li>
                    Responses are limited by the official documents uploaded
                    into the system.
                  </li>
                  <li>
                    If no verified source is found, the system may refuse to
                    answer and return the fallback response.
                  </li>
                  <li>
                    Users remain responsible for confirming important academic,
                    administrative, legal, financial, or regulatory matters with
                    the appropriate university office when required.
                  </li>
                </ul>
                <ImportantCallout title="AI Limitation">
                  The AI assistant is a document-grounded academic support
                  feature. It is not a replacement for formal institutional
                  decision-making, administrative approval, or official
                  published notices.
                </ImportantCallout>
              </TermsSection>

              <TermsSection
                id="acceptable-use"
                title="9. Acceptable Use"
                revealIndex={8}
              >
                <p>
                  Users may use the service only for legitimate educational,
                  library, administrative, and institutionally permitted
                  purposes.
                </p>
                <ul>
                  <li>Viewing permitted catalog information.</li>
                  <li>Using one’s own account.</li>
                  <li>
                    Managing books, records, or documents within authorized role
                    scope.
                  </li>
                  <li>
                    Using the AI assistant for appropriate academic-support
                    questions.
                  </li>
                  <li>
                    Maintaining respectful and lawful use of the platform.
                  </li>
                </ul>
              </TermsSection>

              <TermsSection
                id="prohibited-conduct"
                title="10. Prohibited Conduct"
                revealIndex={9}
              >
                <ul>
                  <li>
                    Attempting unauthorized access to accounts, records, or
                    admin functions.
                  </li>
                  <li>
                    Bypassing authentication, authorization, queue controls, or
                    fine logic.
                  </li>
                  <li>
                    Interfering with system security, logging, or data
                    integrity.
                  </li>
                  <li>Uploading malware or harmful content.</li>
                  <li>
                    Misusing automated tools, bots, or scraping methods in a way
                    that harms service integrity.
                  </li>
                  <li>Submitting false institutional data.</li>
                  <li>
                    Using the AI assistant to generate abusive, unlawful, or
                    operationally disruptive content.
                  </li>
                  <li>
                    Copying, downloading, or redistributing restricted materials
                    beyond permitted use.
                  </li>
                  <li>
                    Reverse engineering, probing, or attacking service
                    infrastructure.
                  </li>
                </ul>
                <p>
                  Because the platform is operationally sensitive, misuse that
                  targets queue behavior, fines, document handling, or state
                  integrity is especially serious.
                </p>
              </TermsSection>

              <TermsSection
                id="availability-and-changes"
                title="11. Availability and Changes"
                revealIndex={10}
              >
                <p>
                  The service may be changed, updated, restricted, interrupted,
                  or improved from time to time. Features may be added,
                  modified, removed, or temporarily disabled due to development
                  changes, maintenance, testing, security work, academic cycles,
                  infrastructure issues, or institutional requirements.
                </p>
                <p>
                  The platform is intended for real deployment, but that does
                  not mean every feature is guaranteed to be available at all
                  times.
                </p>
              </TermsSection>

              <TermsSection
                id="suspension-and-termination"
                title="12. Suspension and Termination"
                revealIndex={11}
              >
                <p>
                  The university or authorized operators may suspend, restrict,
                  or terminate access where appropriate, including for reasons
                  such as policy breach, security risk, misuse, loss of
                  eligibility, administrative deactivation, or protection of
                  service integrity.
                </p>
                <ul>
                  <li>Violation of these Terms.</li>
                  <li>Suspected misuse or security risk.</li>
                  <li>Breach of library or university rules.</li>
                  <li>Administrative deactivation.</li>
                  <li>End of institutional eligibility.</li>
                </ul>
                <ImportantCallout title="Enforcement Notice">
                  Suspension of access does not automatically erase outstanding
                  obligations such as fines, return duties, audit records, or
                  institutional accountability requirements.
                </ImportantCallout>
              </TermsSection>

              <TermsSection
                id="intellectual-property"
                title="13. Intellectual Property"
                revealIndex={12}
              >
                <p>
                  The platform itself, its structure, branding, software
                  components, and institutional materials may be protected by
                  applicable intellectual property, institutional ownership,
                  academic policy, or licensing restrictions.
                </p>
                <p>
                  University documents, library resources, and related materials
                  available through the system are not automatically transferred
                  to the user. Access is granted only for the purposes allowed
                  by the university, library policy, and applicable academic or
                  licensing rules.
                </p>
              </TermsSection>

              <TermsSection
                id="disclaimer-of-service-limits"
                title="14. Disclaimer of Service Limits"
                revealIndex={13}
              >
                <p>
                  The service is provided to support academic and library
                  operations, but no system can guarantee uninterrupted
                  availability, complete absence of error, or perfect response
                  outcomes.
                </p>
                <ul>
                  <li>Catalog status may change as operations occur.</li>
                  <li>
                    Queue and borrowing eligibility depend on live system state.
                  </li>
                  <li>
                    AI responses depend on the official documents available in
                    the system.
                  </li>
                  <li>
                    Technical outages, data issues, or maintenance windows may
                    affect access temporarily.
                  </li>
                </ul>
                <p>
                  Nothing in these Terms should be read as a promise that the
                  service is always available, always complete, or always
                  suitable for every purpose.
                </p>
              </TermsSection>

              <TermsSection
                id="changes-to-these-terms"
                title="15. Changes to These Terms"
                revealIndex={14}
              >
                <p>
                  These Terms may be revised from time to time to reflect
                  changes in system behavior, deployment, operational controls,
                  institutional policy, legal obligations, or university
                  requirements.
                </p>
                <p>
                  When material updates are made, the page should show the
                  revised “Last Updated” date and, where appropriate, users may
                  be notified through the application or other official
                  communication channels.
                </p>
              </TermsSection>

              <TermsSection id="contact" title="16. Contact" revealIndex={15}>
                <p>
                  For questions about these Terms of Use, access issues, account
                  restrictions, or service-related concerns, the current
                  operational contact exposed in the guest experience is:
                </p>
                <div className="rounded-2xl border border-border/60 bg-muted/40 p-4 text-sm leading-7 text-muted-foreground">
                  <p>
                    <span className="font-semibold text-foreground">
                      Service / Support Contact:
                    </span>{" "}
                    Student Assistance
                  </p>
                  <p>
                    <span className="font-semibold text-foreground">
                      Email:
                    </span>{" "}
                    ahmadsajid41324@gmail.com
                  </p>
                  <p>
                    <span className="font-semibold text-foreground">
                      University:
                    </span>{" "}
                    University of Agriculture Faisalabad
                  </p>
                </div>
              </TermsSection>
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
                Move between the legal surfaces without dropping back into the
                authentication flow unless that is intentional.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild className="rounded-xl">
                <Link href="/login">Back to Login</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-xl">
                <Link href="/privacy-policy">Privacy Policy</Link>
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
