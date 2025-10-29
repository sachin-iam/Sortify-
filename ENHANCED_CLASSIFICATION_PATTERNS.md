# Enhanced Email Classification Patterns

## Overview
This document details the comprehensive patterns, keywords, and sender information extracted from real email examples to achieve 95%+ classification accuracy.

## Categories & Patterns

### 1. Placement
**Description:** Job placement opportunities, recruitment drives, and career-related communications

**Sender Patterns:**
- **Email:** `noreply@infylearn.com`, placement officers
- **Domains:** `infylearn.com`, `naukri.com`, `linkedin.com`
- **Names:** "SU Placement", "Placement Officer", "Sharda Informatics", "Mr. Manoj Marothia"

**Subject Keywords:**
- placement, job, apply, interview, deadline, recruitment, career, opportunity
- resume shortlisting, pre-placement training, agent ai challenge, talent hiring
- assessment, shortlisted students

**Body Keywords & Phrases:**
- "placement opportunity", "resume shortlisting", "quality assurance (QA)"
- "network people services", "application for position", "next stage"
- "pre-placement training", "mandatory attendance", "agent ai challenge"
- "accenture", "tcs", "infosys", "wipro", "josh technology"
- "shortlisted students", "talent hiring"

**Real Examples:**
- From: "SU Placement" <noreply@infylearn.com>
- Subject: "SU Placement | Reminder: Upcoming Resume Shortlisting for Quality Assurance (QA) at Network People Services Technologies Ltd."
- From: "Mr. Manoj Marothia"
- Subject: "Placement Opportunity | Agent AI Challenge is live!"

**Confidence Threshold:** 0.85

---

### 2. NPTEL
**Description:** NPTEL course registrations, lectures, and online learning content

**Sender Patterns:**
- **Email:** `onlinecourses@nptel.iitm.ac.in`
- **Domains:** `nptel.iitm.ac.in`, `nptel.ac.in`
- **Names:** "NPTEL", "NPTEL Team", "NPTEL Newsletter"

**Subject Keywords:**
- nptel, course, lecture, registration, exam, certificate
- nptel newsletter, star badges, scmpro, supply chain, iit madras

**Body Keywords & Phrases:**
- "nptel team", "star badges", "lifelong learning"
- "scmpro", "joint certification", "cii", "iit madras"
- "supply chain career", "best wishes from nptel team"
- "professor who never stopped learning"
- "advance your supply chain career", "joint certification by cii"

**Real Examples:**
- From: "NPTEL" <onlinecourses@nptel.iitm.ac.in>
- Subject: "NPTEL Newsletter: Oct 2025: Vol 6: Week 4!"
- Subject: "NPTEL Newsletter: Advance Your Supply Chain Career with SCMPro – Joint Certification by CII & IIT Madras"

**Confidence Threshold:** 0.90

---

### 3. HOD (Head of Department)
**Description:** Communications from Head of Department including administrative notices and official announcements

**Sender Patterns:**
- **Email:** `hod.cse@sharda.ac.in`
- **Domains:** `sharda.ac.in`, `ug.sharda.ac.in`
- **Names:** "HOD CSE", "HoD", "Dr. Sudeep Varshney"

**Subject Keywords:**
- hod, department, notice, announcement, mandatory, circular, important
- request to reschedule, evaluation date, re:

**Body Keywords & Phrases:**
- "mark all students absent", "reschedule evaluation"
- "hod office", "meet me in person", "respected hod sir"
- "dr. sudeep varshney", "phd", "iit dhanbad"
- "head of department", "administrative notice"
- "mandatory attendance", "all students", "dear students"

**Real Examples:**
- From: "HOD CSE" <hod.cse@sharda.ac.in>
- Subject: "Re: Request to Reschedule Evaluation Date"
- Body: "Dear Dr. Kanika, Mark all such students absent."
- Body: "Meet me in person tomorrow at 10.39 am in HoD office, with the tickets you have booked."

**Confidence Threshold:** 0.90

---

### 4. E-Zone
**Description:** Student portal E-Zone related communications including login credentials, password resets, and portal updates

**Sender Patterns:**
- **Email:** `ezone@shardauniversity.com`
- **Domains:** `shardauniversity.com`, `ezone.sharda.ac.in`
- **Names:** "E-Zone Online Portal", "E-Zone"

**Subject Keywords:**
- ezone, e-zone, portal, login, password, otp, access, account
- one time password, e-zone login

**Body Keywords & Phrases:**
- "sharda e-zone", "one time password", "dear user"
- "welcome to sharda e-zone", "valid for today", "accessing sharda e-zone"
- "your one-time password", "valid for today only"
- "visit website", OTP numbers (e.g., "224025", "548735")

**Real Examples:**
- From: "E-Zone Online Portal" <ezone@shardauniversity.com>
- Subject: "E-Zone Login - One Time Password (OTP)"
- Body: "Your One-Time Password (OTP) for accessing Sharda E-Zone is 224025. This OTP is valid for today (Wednesday, October 29, 2025) only."

**Confidence Threshold:** 0.95

---

### 5. Promotions
**Description:** Marketing emails, promotional content, deals, offers, advertisements, and health camps

**Sender Patterns:**
- **Email:** `ug.group@ug.sharda.ac.in` (with "'Promotions' via" prefix)
- **Names:** "'Promotions' via UG Student Group", "Promotions via UG Student Group"

**Subject Keywords:**
- offer, discount, deal, sale, promotion, exclusive, limited, special
- free screening camp, welcoming dr, breast health

**Body Keywords & Phrases:**
- "free breast health screening camp", "shardacare", "healthcity"
- "breast cancer awareness month", "promoting women's health"
- "early diagnosis", "prevention", "welcoming dr"
- "consultant", "obstetrics", "gynaecology"
- "delighted to welcome", "extensive experience", "hosting"

**Real Examples:**
- From: "'Promotions' via UG Student Group" <ug.group@ug.sharda.ac.in>
- Subject: "Free Breast Health Screening Camp | Shardacare - Healthcity | 28th October 2025"
- Subject: "Welcoming Dr. Lipi Sharma | Consultant - Obstetrics & Gynaecology at ShardaCare – Healthcity"

**Confidence Threshold:** 0.85

---

### 6. Whats happening
**Description:** Campus events, announcements, what's happening updates, and community activities

**Sender Patterns:**
- **Email:** `ug.group@ug.sharda.ac.in`, `batch2022-2023@ug.sharda.ac.in`, `whatshappening@sharda.ac.in`
- **Names:** "'What's Happening' via UG Student Group", "'What's Happening' via Batch 2022-2023"

**Subject Keywords:**
- event, happening, whats, campus, announcement, activity, participate
- nss cell, register volunteers, nurses week, international nurses day
- aetcom, tree plantation, startup, sql mastery, seminar

**Body Keywords & Phrases:**
- "nss cell sharda university", "register nss volunteers", "my bharat portal"
- "nurses week celebration", "international nurses day"
- "aetcom skills", "attitude ethics and communication"
- "tree plantation drive", "celebrate earth"
- "startup fundraise", "business growth fest", "bizgrow"
- "sql mastery summit", "data pool club"
- "seminar on digital forensics", "organizing"

**Real Examples:**
- From: "'What's Happening' via UG Student Group" <ug.group@ug.sharda.ac.in>
- Subject: "NSS Cell at Sharda University, DSW, is going to register 300 NSS Volunteers on the MY BHARAT PORTAL for NSS Students"
- Subject: "SQL Mastery Summit 2023 | SET | 25th August 2023"

**Confidence Threshold:** 0.85

---

### 7. Professor (formerly "Assistant")
**Description:** Communications from professors and faculty including evaluations, assignments, training sessions, and academic guidance

**Sender Patterns:**
- **Titles in Name:** "(SET Assistant Professor)", "(CSE Associate Professor)", "(SSET Assistant Professor)", "Dr."
- **Domains:** `sharda.ac.in`, `ug.sharda.ac.in`
- **Names:** Contains "Assistant Professor", "Associate Professor", "Professor", "Dr."
- **Specific Professors:** Kanika Singla, Anubhava Srivastava, Nishant Gupta, Kapil Kumar

**Subject Keywords:**
- evaluation, project eval, attendance, spreadsheet shared, outcome sheet
- training session, oracle academy, interview scheduled
- shortlisted students, assessment, check attendance, regarding training

**Body Keywords & Phrases:**
- "assistant professor", "associate professor", "set assistant professor", "cse associate professor"
- "check attendance for project eval", "panel members"
- "spreadsheet shared with you", "outcome sheet"
- "training session", "training is compulsory"
- "oracle academy exam", "please start your exam", "link is active"
- "interview scheduled", "shortlisted students for assessment"
- "personal interviews", "dear faculty members and students"
- "prepare the ppt", "discussion with the guide"

**Regex Patterns for Title Extraction:**
- `\(([^)]*(?:Assistant Professor|Associate Professor|Professor|Faculty|Dr\.).*?)\)`
- `(Assistant Professor|Associate Professor|Professor|Dr\.)\s+`
- `\b(Dr\.)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)`

**Real Examples:**
- From: "Kanika Singla (SET Assistant Professor)" <kanika.singla@sharda.ac.in>
- Subject: "Evaluation-3 to be held on 1st Nov || Last internal evaluation of 7th sem || 22-26 batch"
- From: "Dr. Anubhava Srivastava (SSET Assistant Professor)" <anubhava.srivastava@sharda.ac.in>
- Subject: "Re: Regarding the Training session from 06 October to 17 October"
- From: "Kapil Kumar (SET Assistant Professor)" <kapil.kumar1@sharda.ac.in>
- Subject: "Re: Last Chance to Appear for Oracle Academy Exam – 28 Nov 2025 (Tuesday)"

**Confidence Threshold:** 0.85

---

## Implementation Details

### Enhanced Features
1. **Sender Domain Extraction:** Extract domain from email address
2. **Sender Name Extraction:** Extract display name from "Name <email>" format
3. **Professor Title Detection:** Use regex to identify professor titles
4. **Phrase Matching:** Multi-word phrase matching in addition to single keywords
5. **Category Indicators:** Binary flags for category-specific patterns
6. **Subject Line Emphasis:** Separate processing of subject lines with higher weight

### Confidence Scoring
- **Specific Sender Match:** 0.90-0.98 confidence (e.g., exact email match)
- **Domain + Keywords:** 0.75-0.85 confidence
- **Multiple Phrase Matches:** +0.10-0.15 boost
- **Subject Line Match:** 2x weight multiplier

### Priority Levels
1. **High Priority:** E-Zone (0.95), NPTEL (0.90), HOD (0.90)
2. **Normal Priority:** Placement (0.85), Promotions (0.85), Professor (0.85), Whats happening (0.85)
3. **Fallback:** Other

## Files Modified
- `/model_service/categories.json` - Updated with all extracted patterns (v5.0.0)
- `/server/src/services/phase1ClassificationService.js` - Enhanced with phrase matching and specific sender detection
- `/server/src/utils/senderPatternMatcher.js` - Added new utility functions for enhanced pattern matching

## Metadata
- **Version:** 5.0.0
- **Last Updated:** October 29, 2025
- **Total Categories:** 9 (including Other and All)
- **Active Classification Categories:** 7
- **Pattern Source:** Real email examples from production system
- **Target Accuracy:** 95%+

