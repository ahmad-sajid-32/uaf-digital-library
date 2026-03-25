// apps/web/src/components/legal/library-rules-page.tsx
/**
 * Operational library rules page for the UAF Smart E-Library platform.
 *
 * This screen is narrower and more handbook-like than the broader legal pages.
 * It explains practical library usage rules, circulation expectations,
 * accountability, and conduct requirements while avoiding false precision on
 * fee figures that may change under library administration policy.
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
  department: "Main Library, University of Agriculture Faisalabad",
  serviceName: "UAF Smart E-Library & University Information Assistant",
};

const QUICK_SUMMARY_ITEMS = [
  "Membership is required for borrowing privileges and may require verification documents.",
  "Borrowing limits and renewals depend on user category, item type, and live queue conditions.",
  "Overdue items may lead to fines, restrictions, and blocked circulation actions.",
  "Lost, damaged, or mutilated materials may trigger replacement cost, repair charges, or other penalties.",
  "Misuse of library facilities, computers, or digital resources can result in restricted access or disciplinary action.",
  "Library clearance may still be required before completion of academic or administrative obligations.",
];

const SECTION_NAV_ITEMS = [
  ["overview", "Overview"],
  ["membership-eligibility", "Membership & Eligibility"],
  ["circulation-desk-rules", "Circulation Desk Rules"],
  ["book-bank-rules", "Book Bank Rules"],
  ["loan-periods-renewals", "Loan Periods & Renewals"],
  ["fines-charges", "Fines & Charges"],
  ["lost-damaged-materials", "Lost, Damaged, or Mutilated Materials"],
  ["conduct-inside-library", "Conduct Inside Library Premises"],
  ["computer-internet-digital-use", "Computer, Internet & Digital Use"],
  ["duplicate-cards-clearance", "Duplicate Cards & Clearance"],
  ["enforcement-disciplinary-action", "Enforcement & Disciplinary Action"],
  ["contact-help", "Contact / Help"],
] as const;

function RuleSection({
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
      delayMs={getStaggeredRevealDelay(revealIndex, 50)}
    >
    <section id={id} className="scroll-mt-24 space-y-4">
      <div className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary/80">
          Rule Area
        </p>
        <h3 className="font-display text-2xl font-black tracking-tight text-foreground">
          {title}
        </h3>
      </div>
      <div className="space-y-4 text-sm leading-7 text-muted-foreground [&>ul]:list-disc [&>ul]:space-y-2 [&>ul]:pl-5">
        {children}
      </div>
    </section>
    </ScrollReveal>
  );
}

function NoticeCallout({
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

function SectionGroup({
  title,
  subtitle,
  revealIndex,
  children,
}: {
  title: string;
  subtitle: string;
  revealIndex: number;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <ScrollReveal
      direction={getStaggeredRevealDirection(revealIndex)}
      delayMs={getStaggeredRevealDelay(revealIndex, 65, 60)}
    >
    <Card className="border-border/60 bg-card/95 shadow-md shadow-primary/10">
      <CardHeader className="space-y-2 px-5 pb-3 pt-5 sm:px-7">
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary/80">
          Group
        </p>
        <CardTitle className="font-display text-2xl font-black tracking-tight text-foreground">
          {title}
        </CardTitle>
        <p className="text-sm leading-7 text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent className="space-y-8 px-5 pb-5 sm:px-7">
        {children}
      </CardContent>
    </Card>
    </ScrollReveal>
  );
}

export function LibraryRulesPage(): React.JSX.Element {
  return (
    <div className="w-full self-stretch py-8 sm:py-10 lg:py-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 lg:gap-8">
        <ScrollReveal direction="up" delayMs={30}>
        <Card className="border-border/60 bg-card/95 shadow-md shadow-primary/10">
          <CardHeader className="space-y-5 px-5 py-6 sm:px-7 lg:px-8">
            <div className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-primary/80">
                Operational Handbook
              </p>
              <div className="space-y-3">
                <h1 className="font-display text-4xl font-black tracking-tight text-foreground sm:text-5xl">
                  Library Rules
                </h1>
                <p className="max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
                  Operational rules and conduct guidelines for using the UAF
                  Smart E-Library and related library services.
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
                Department: {PAGE_META.department}
              </span>
              <span className="rounded-full border border-border/60 bg-muted/60 px-3 py-1.5">
                Service: {PAGE_META.serviceName}
              </span>
            </div>

            <NoticeCallout title="Important Notice">
              These rules summarize library usage requirements and may be
              updated by the library administration. Current fines, fees, and
              operational limits may vary depending on policy, member category,
              and item type. Where a current official instruction conflicts with
              an older published amount, the latest library administration
              direction should govern.
            </NoticeCallout>
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
            <ul className="grid gap-3 text-sm leading-7 text-muted-foreground md:grid-cols-2">
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

        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <ScrollReveal direction="left" delayMs={70}>
            <Card className="border-border/60 bg-card/95 shadow-md shadow-primary/10">
              <CardHeader className="px-5 pb-3 pt-5">
                <CardTitle className="font-display text-xl font-black tracking-tight text-foreground">
                  Quick Jumps
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <nav aria-label="Library rules sections">
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

          <div className="space-y-6">
            <ScrollReveal direction="down" delayMs={90}>
            <Card className="border-border/60 bg-card/95 shadow-md shadow-primary/10">
              <CardContent className="space-y-6 px-5 py-6 sm:px-7">
                <RuleSection id="overview" title="1. Overview" revealIndex={0}>
                  <p>
                    These Library Rules explain how library services should be
                    used through the UAF Smart E-Library and related library
                    operations. They are intended to help students, faculty
                    members, staff, librarians, and authorized users understand
                    borrowing processes, conduct expectations, fines,
                    replacement responsibilities, and related operational
                    requirements.
                  </p>
                  <p>
                    This page summarizes library usage rules in a digital and
                    readable form. It should be read together with the Terms of
                    Use and any separate official university or library
                    instructions that apply to a specific service or member
                    category.
                  </p>
                  <p>
                    The digital system supports library workflows, but it does
                    not replace the authority of the library administration. If
                    a formally issued library decision conflicts with a
                    displayed system value, the authorized administrative
                    decision should govern until corrected in the system.
                  </p>
                </RuleSection>
              </CardContent>
            </Card>
            </ScrollReveal>

            <SectionGroup
              title="Access & Borrowing"
              subtitle="Membership, circulation, long-loan access, and renewal rules."
              revealIndex={1}
            >
              <RuleSection
                id="membership-eligibility"
                title="2. Membership & Eligibility"
                revealIndex={2}
              >
                <p>
                  Borrowing privileges are intended for eligible university
                  users. Official UAF materials indicate that students may apply
                  for membership and Book Bank access through prescribed forms,
                  fees, and supporting documentation, while current membership
                  materials also show additional submission requirements such as
                  identity copies, photographs, and academic attestation.
                </p>
                <p>
                  Library membership and borrowing access are available only to
                  eligible university users and other authorized members
                  approved under library policy. Users may be required to
                  complete the prescribed membership process and submit the
                  documents or verification required by library administration.
                </p>
              </RuleSection>

              <RuleSection
                id="circulation-desk-rules"
                title="3. Circulation Desk Rules"
                revealIndex={3}
              >
                <p>
                  Borrowing limits depend on the member category and item type.
                  Certain materials may have shorter loan periods, overnight
                  restrictions, or special-permission requirements. Reference
                  materials, single-copy items, theses, reports, and similar
                  resources may be restricted or issued only under special
                  rules.
                </p>
                <p>
                  The system reflects these differences through role-based
                  policies and item-specific handling rather than one universal
                  borrowing rule for all users.
                </p>
              </RuleSection>

              <RuleSection
                id="book-bank-rules"
                title="4. Book Bank Rules"
                revealIndex={4}
              >
                <p>
                  The Book Bank operates under a separate long-loan model for
                  eligible students. Book Bank items may be issued for an
                  extended period depending on course requirements and library
                  policy, and rental or service charges may apply where the
                  library administration enforces them.
                </p>
                <p>
                  Users should not assume Book Bank items follow the same issue
                  period, fee structure, or renewal behavior as general
                  circulation items.
                </p>
              </RuleSection>

              <RuleSection
                id="loan-periods-renewals"
                title="5. Loan Periods & Renewals"
                revealIndex={5}
              >
                <p>
                  Loan periods depend on user category and, in some cases, the
                  type of item being issued. Renewal may be allowed only where
                  the item is eligible, the borrowing policy permits it, and no
                  active queue or reservation condition blocks renewal.
                </p>
                <p>
                  When an item is returned and another eligible user is waiting,
                  the system may reserve or reassign availability according to
                  queue rules. Timed holds may expire automatically when the
                  claim window passes.
                </p>
              </RuleSection>
            </SectionGroup>

            <SectionGroup
              title="Charges & Responsibility"
              subtitle="Financial responsibility, penalties, replacements, and clearance obligations."
              revealIndex={6}
            >
              <RuleSection
                id="fines-charges"
                title="6. Fines & Charges"
                revealIndex={7}
              >
                <p>
                  Overdue materials may result in delay fines, service charges,
                  or other penalties according to current library policy. Fine
                  amounts may vary depending on user category, item type, and
                  applicable administrative rules.
                </p>
                <p>
                  Where the system calculates fines automatically, the amount
                  shown in the system should be treated as the operational fine
                  record unless it is formally adjusted by authorized staff.
                  Fine reductions, capped penalties, or exceptional handling may
                  still depend on library policy.
                </p>
                <NoticeCallout title="Charges May Vary">
                  Current official UAF sources do not fully agree on every fee
                  figure. Do not treat older published rupee amounts as
                  permanent truth. The latest library instruction should govern
                  when charges, membership fees, or operational rates are
                  updated.
                </NoticeCallout>
              </RuleSection>

              <RuleSection
                id="lost-damaged-materials"
                title="7. Lost, Damaged, or Mutilated Materials"
                revealIndex={8}
              >
                <p>
                  Users are responsible for all materials issued to them. If a
                  library item is lost, damaged, mutilated, or returned in
                  unacceptable condition, the borrower may be required to:
                </p>
                <ul>
                  <li>replace the item,</li>
                  <li>pay the assessed current value,</li>
                  <li>pay repair, binding, or handling charges,</li>
                  <li>
                    or comply with another permitted administrative remedy.
                  </li>
                </ul>
                <p>
                  The library may decide whether replacement, assessed cost
                  recovery, binding charges, or another permitted remedy
                  applies.
                </p>
                <NoticeCallout title="Material Accountability">
                  Borrowers remain responsible for issued materials until the
                  library records them as properly returned, replaced, or
                  otherwise cleared under authorized procedure.
                </NoticeCallout>
              </RuleSection>

              <RuleSection
                id="duplicate-cards-clearance"
                title="8. Duplicate Cards & Clearance"
                revealIndex={9}
              >
                <p>
                  Library cards and membership records must be handled
                  carefully. If a card is lost, damaged, or needs replacement,
                  the library may issue a duplicate upon payment of the
                  prescribed charge.
                </p>
                <p>
                  Users may also be required to obtain library clearance before
                  completion of academic or administrative processes where
                  outstanding books, fines, Book Bank obligations, or related
                  responsibilities exist.
                </p>
              </RuleSection>
            </SectionGroup>

            <SectionGroup
              title="Conduct & Facilities"
              subtitle="Behavior inside library spaces, digital-resource discipline, and enforcement."
              revealIndex={10}
            >
              <RuleSection
                id="conduct-inside-library"
                title="9. Conduct Inside Library Premises"
                revealIndex={11}
              >
                <p>
                  Users must maintain a respectful and study-focused environment
                  inside library spaces. Noise, disruptive behavior,
                  unauthorized phone use where restricted, misuse of facilities,
                  and conduct that interferes with other users or staff may lead
                  to fines, service restrictions, or disciplinary action under
                  university and library policy.
                </p>
              </RuleSection>

              <RuleSection
                id="computer-internet-digital-use"
                title="10. Computer, Internet & Digital Use"
                revealIndex={12}
              >
                <p>
                  Library computers, internet access, the online catalog,
                  digital resources, and connected study or research services
                  must be used only for legitimate academic, educational, and
                  library purposes.
                </p>
                <p>
                  Printing, scanning, or computer-lab usage charges may apply
                  where the library administration has prescribed them. Misuse
                  of internet or digital resources may result in penalties,
                  restricted access, or referral for further action.
                </p>
              </RuleSection>

              <RuleSection
                id="enforcement-disciplinary-action"
                title="11. Enforcement & Disciplinary Action"
                revealIndex={13}
              >
                <p>Failure to comply with library rules may result in:</p>
                <ul>
                  <li>fines or charges,</li>
                  <li>temporary suspension of borrowing privileges,</li>
                  <li>cancellation of membership privileges,</li>
                  <li>withholding of clearance,</li>
                  <li>
                    or referral for disciplinary action under university
                    procedures.
                  </li>
                </ul>
                <p>
                  Users remain responsible for returning materials on time even
                  where automated reminders are unavailable, delayed, or missed.
                </p>
                <NoticeCallout title="Disciplinary Consequences">
                  Serious misuse of library property, digital resources,
                  circulation controls, or institutional facilities may trigger
                  stronger administrative action than an ordinary overdue fine.
                </NoticeCallout>
              </RuleSection>
            </SectionGroup>

            <ScrollReveal direction="up-right" delayMs={120}>
            <Card className="border-border/60 bg-card/95 shadow-md shadow-primary/10">
              <CardContent className="space-y-6 px-5 py-6 sm:px-7">
                <RuleSection
                  id="contact-help"
                  title="12. Contact / Help"
                  revealIndex={14}
                >
                  <p>
                    For borrowing questions, fines, membership issues, duplicate
                    cards, clearance, or rule clarification, the current
                    operational contact exposed in the guest experience is:
                  </p>
                  <div className="rounded-2xl border border-border/60 bg-muted/40 p-4 text-sm leading-7 text-muted-foreground">
                    <p>
                      <span className="font-semibold text-foreground">
                        Library Contact / Support:
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
                        Department:
                      </span>{" "}
                      Main Library, University of Agriculture Faisalabad
                    </p>
                  </div>
                </RuleSection>
              </CardContent>
            </Card>
            </ScrollReveal>
          </div>
        </div>

        <ScrollReveal direction="up-left" delayMs={130}>
        <Card className="border-border/60 bg-card/95 shadow-md shadow-primary/10">
          <CardContent className="flex flex-col gap-3 px-5 py-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-7">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary/80">
                Legal Navigation
              </p>
              <p className="text-sm text-muted-foreground">
                Move between the handbook and legal screens without losing the
                current guest flow.
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
                <Link href="/terms-of-use">Terms of Use</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
        </ScrollReveal>
      </div>
    </div>
  );
}
