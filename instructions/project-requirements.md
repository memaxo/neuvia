# Neuvia Medical Records Analysis System - Product Requirements Document

## App Overview

Neuvia is a web application designed to assist healthcare professionals (doctors, nurses, administrators, and researchers) in efficiently analyzing patient medical records. It leverages Large Language Models (LLMs) and a graph-based Retrieval Augmented Generation (RAG) pipeline to automate document ingestion, summarization, key data extraction, and clinical insight generation. The goal is to reduce manual chart review time, improve diagnostic accuracy, highlight potential risks, and provide evidence-based recommendations. The system prioritizes data security, compliance (HIPAA, GDPR), explainability, and a user-friendly experience.

## User Flow

The primary user flows are:

1.  **Authentication:**

    - User navigates to `/auth`.
    - User chooses a login method (email/password, Google OAuth, GitHub OAuth, or potentially Twitter OAuth).
    - Successful authentication redirects to `/dashboard`.
    - Failed authentication displays an error message on `/auth`.
    - Sign up flow via email/password at `/onboarding`.
    - Sign out functionality available (redirects to `/auth`).

2.  **Dashboard Overview:**

    - User is presented with a dashboard (`/dashboard`).
    - Displays quick stats (total patients, pending uploads, high-risk patients).
    - Shows recent patient activity.
    - Provides a patient overview visualization (Pie Chart and Mini Calendar).
    - Features a prominent "Add Patient" button (linking to `/dashboard/patients/new`).

3.  **Patient Management:**

    - User navigates to `/dashboard/patients`.
    - Sees a list/table of patients 
    - Can search/filter patients by name, ID, etc.

4.  **Add New Patient:**

    - User navigates to `/dashboard/patients/new`.
    - A basic form is present to create a patient profile, that includes fields such as:
      - Full name
      - Date of birth
      - Assigned sex at birth
      - Preferred language
    - Patient id and MRN (medical record number) are created automatically.

5.  **Individual Patient View:**

    - User selects a patient from the directory or after adding a new patient.
    - User is taken to the patient details page (e.g., `/dashboard/patients/[id]`).
    - The page will include:
      - Patient name
      - Avatar
      - Key Information (extracted and summarized from documents)
      - Quick action buttons to upload document, view reports, send a message.
    - Document upload section (drag-and-drop or file selection).
    - The system will automatically displays recent patient activty and upcoming appointments.

6.  **Document Upload and Processing:**

    - User uploads one or more documents (PDF, DOCX, JPG, PNG) via drag-and-drop or file selection.
    - File size and type validation is performed on the client-side.
    - Upload progress is displayed.
    - Upon successful upload, the file is sent to the backend for processing (chunking, embedding, summarization).
    - User sees a "processing" indicator.

7.  **Settings:**

    - User navigates to `/dashboard/settings`.
    - Profile Settings page exists.
    - Team Members page exists, and uses `/dashboard/settings/members/components/MemberTable.tsx`

8.  **Contact Us:**

    - User navigates to `/contact`.
    - User can submit an inquery to Neuvia.

9.  **Blog**
    _ User navigates to `/blog`
    _ User can access a NextMDX markdown page
    .
10. **Terms of Service**

    - User navigates to `/terms`
    - User can access a NextMDX markdown page.

11. **Privacy**
    - User navigates to `/privacy`
    - User can access a NextMDX markdown page.

## Tech Stack & APIs

- **Frontend:** Next.js (React), TypeScript, Tailwind CSS, Shadcn-UI components, Radix UI components.
- **Backend:** Supabase (PostgreSQL database, authentication, storage).
- **LLMs:**
  - "o3-mini" (placeholder - details TBD): For core clinical reasoning and summarization.
  - "Gemini flash" (placeholder - details TBD): For initial document ingestion and large context handling.
- **Vector Database:** (Placeholder, specific choice TBD - e.g., Pinecone, Milvus, or Supabase pgvector).
- **Graph Database:** (Placeholder - details TBD - if needed, separate from vector DB).
- **LangChain/LangGraph:** Orchestration of LLM interactions, chunking, and retrieval.
- **Deployment:** Vercel.
- **APIs:**
  - Supabase Auth: User authentication and management.
  - Supabase Storage: File storage (for uploaded documents).
  - Supabase Database: Data storage.
  - OpenAI API (or equivalent): For LLM interactions (if not self-hosting "o3-mini" and "gemini flash").
  - Resend API: For sending emails.

## Core Features

1.  **User Authentication:** Secure login/signup using Supabase Auth (email/password, OAuth).
2.  **Patient Management:** Basic CRUD operations for patient records (MVP focuses on minimal manual entry).
3.  **Document Upload:** Drag-and-drop and file selection, client-side validation (type, size), progress indicators.
4.  **Automated Document Processing:**
    - **Chunking:** Splitting documents into manageable pieces.
    - **Embedding Generation:** Creating vector representations of text chunks.
    - **Summarization:** Generating concise summaries of individual documents and overall patient records.
    - **Key Data Extraction:** Identifying and extracting critical information (e.g., diagnoses, medications, allergies, lab results).
5.  **Clinical Insights Generation:** LLM-powered reasoning to identify potential risks, suggest diagnoses, and provide explanations.
6.  **Graph-Based RAG:** Utilizing a graph database to connect related concepts and improve retrieval accuracy.
7.  **User Interface (Dashboard):**
    - Patient list/search.
    - Individual patient view.
    - Document upload and management.
    - Display of summaries, key findings, and alerts.
    - Explanation of LLM reasoning.
    - User settings and profile management.
8.  **Audit Logging:** Tracking user actions and data modifications.
9.  **Basic user management and RBAC**

## In-Scope (MVP)

- User authentication (email/password, Google, Github).
- Basic patient record creation (minimal manual data entry).
- Document upload (PDF, DOCX, JPG, PNG).
- Automated document processing (chunking, embedding, summarization).
- Display of document summaries and key findings.
- Basic LLM-powered clinical insight generation (risk alerts).
- Explainable AI (displaying reasoning behind LLM suggestions).
- Dashboard UI for accessing core features.
- Basic user roles (admin, clinician).
- Contact form.
- Basic pages: contact, blog, terms, privacy, onboarding, error.
- Logout functionality.
- Basic sitemap support.

## Out-of-Scope (MVP)

- Complex user roles and permissions (beyond admin/clinician).
- Integration with external Electronic Health Record (EHR) systems.
- Advanced reporting and analytics features.
- Real-time collaboration tools.
- Customizable dashboards.
- Mobile app.
- Direct communication features (e.g., messaging between clinicians).
- Detailed billing/payment integration.
- Automated code generation features

## Non-Functional Requirements

- **Security:**
  - HIPAA and GDPR compliance.
  - Data encryption at rest and in transit.
  - Secure authentication and authorization.
  - Regular security audits.
  - Use of environment variables for secrets (API keys, etc.).
- **Performance:**
  - Fast document upload and processing times.
  - Responsive user interface.
  - Scalable architecture to handle increasing data volume and user load.
- **Usability:**
  - Intuitive and user-friendly interface.
  - Minimal manual data entry.
  - Clear and concise presentation of information.
- **Reliability:**
  - High availability and uptime.
  - Robust error handling and recovery mechanisms.
- **Maintainability:**
  - Well-documented codebase.
  - Modular architecture for easy updates and feature additions.
  - Use of established libraries and frameworks (Next.js, Supabase, LangChain).
- **Accessibility:**
  - Compliance with WCAG, section 508, and all US standards for accesibility.
- **Browser and OS Support:**
  - Support for modern web browsers (Chrome, Firefox, Safari, Edge).
  - PWA design with consideration for desktop, mobile and tablet support.
  - Support for Windows, MacOS, and Linux.

## Constraints & Assumptions

- **Assumptions:**
  - Clinicians will have access to a modern web browser.
  - Initial MVP will focus on processing English-language documents.
  - "o3-mini" and "Gemini flash" LLMs (or suitable replacements) will be available and performant.
  - Supabase will be used for the database and user authentication.
  - Vercel will be used for deployment.
- **Constraints:**
  - Limited budget for initial development.
  - Tight timeline for MVP launch.
  - Dependency on third-party services (Supabase, LLM providers).

## Known Issues & Potential Pitfalls

- **LLM Hallucinations:** LLMs can generate incorrect or misleading information. Mitigation strategies include:
  - Using RAG to ground the LLM in factual data.
  - Providing clear disclaimers and confidence scores.
  - Allowing clinicians to flag and correct inaccuracies.
  - Providing sources, and a clear audit trail
- **Data Privacy:** Handling PHI requires strict adherence to regulations.
- **Scalability of Vector/Graph Databases:** Performance may degrade with a very large number of documents and complex relationships. Careful database selection and optimization will be crucial.
- **LLM API Costs:** Frequent LLM calls can be expensive. Optimization of prompts and caching strategies are necessary.
- **Prompt Engineering Complexity:** Developing effective prompts for clinical reasoning is an iterative process and may require specialized expertise.
- **Cold Starts of Supabase/Vercel Functions:** These can introduce latency. Mitigations include keeping functions warm or using edge functions.
- **Dependence on external APIs:** If OpenAI, Resend, or other external APIs are unavailable, functionality will be impacted.

This PRD provides a solid foundation for the AI coding model, outlining the application's structure, functionality, and critical considerations. It's designed to be explicit and leave little room for ambiguity, guiding the AI in generating accurate and functional code.
