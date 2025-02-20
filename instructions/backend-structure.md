## Neuvia Backend Structure Document

This document describes the backend architecture of the Neuvia application, primarily leveraging Supabase for database, authentication, storage, and serverless functions.

### 1. Overall Architecture

The backend is built using a combination of:

*   **Supabase:**  A suite of open-source tools that provide a PostgreSQL database, authentication, real-time subscriptions, and storage.  It acts as the primary backend-as-a-service (BaaS).
*   **Next.js API Routes and Server Actions:**  These are used for server-side logic that interacts with Supabase, and potentially external APIs (like LLM providers).  They bridge the gap between the frontend and the Supabase services.
* **Postgres Row Level Security (RLS)** - Used to restrict access to authorized users.
* **Postgres Functions** Used to support RLS and provide server side logic where necessary.

### 2. Supabase Components

#### 2.1. Database (PostgreSQL)

*   **Schema:** The database schema is defined in `supabase/migrations`. The primary schema is `public`.
*   **Tables:**  The core tables are defined in `supabase/migrations/20250220061747_initial_medical_schema.sql` and include:
    *   `profiles`:  Extends the `auth.users` table to store additional user information (full name, username, avatar URL, medical role, etc.).  Tightly coupled with Supabase Auth.
    *   `patients`: Stores patient demographic and medical information. Includes an `patient_embedding` column (vector type) for semantic search capabilities, and `created_by` and `last_modified_by` columns linked to the `profiles` table.
    *   `patient_documents`: Stores metadata about uploaded documents (file path, type, size, checksum, processing status, etc.).  Includes `document_embedding` for semantic search and is linked to the `patients` table.
    *   `document_chunks`: Stores individual chunks of text extracted from documents.  This is crucial for the RAG pipeline. Includes a `chunk_embedding` vector.  Linked to `patient_documents`.
    *   `departments`: Represents different departments within a medical organization.
    * `inqueries`: Stores contact form submissions.
    *   `user_departments`:  A junction table linking users (profiles) to departments, and defining their access level within that department.
    *   `resource_permissions`:  Defines role-based access control (RBAC) rules for different resource types (e.g., "patients", "documents").
    *  `countries`: A pre-populated table of countries.
    *  `audit_logs`: Stores a log of user actions for auditing and security purposes.
*   **Enums:** Several custom enums are defined:
    * `continents`
    *   `medical_role`: Defines user roles (admin, doctor, nurse, staff, researcher).
    *   `access_level`:  Defines permission levels (none, read, write, admin).
    * `document_category`: Categorizes documents (clinical, lab, imaging, prescription, administrative).
    *   `patient_status`:  Indicates patient status (active, inactive, archived, deceased).
*   **RLS Policies:**  Row Level Security (RLS) policies are defined *extensively* to control data access based on user roles and department affiliations. These policies are defined directly within the SQL migration file.  They are crucial for security and HIPAA compliance.
*   **Indexes:**  Various indexes are created to optimize query performance, including `gin` indexes for text search and `btree` indexes for common lookups.  Vector indexes (`ivfflat`) are defined for similarity searches on embeddings.
* **Functions**: Several functions are defined:
    *  `handle_updated_at()`: Automatically updates the updated_at timestamp.
    * `validate_document_type()`: Validates document_type data.
    *   `check_resource_access()`: Checks if a user has the required access level for a given resource type.
    *  `check_document_category_access()`: Checks user authorization, by document type
    * `validate_jsonb_fields()`: Validates that JSONB fields have the appropriate structure.
    *   `match_patient_documents()`: Performs similarity searches on document chunks.

#### 2.2. Authentication (Supabase Auth)

*   **Providers:** Email/password login and OAuth providers (Google, GitHub, and potentially others) are supported.
*   **User Data:** User data is stored in the `auth.users` table (managed by Supabase Auth) and extended in the `public.profiles` table.
*   **Server-Side Authentication:**  The `createClient` function in `utils/supabase-server.ts` and `utils/supa-server-actions.tsx` is used to create a Supabase client instance on the server, using cookies for authentication.
*   **Client-Side Authentication:** The `useSupabaseBrowser` hook (in `utils/supabase-browser.ts`) provides a Supabase client instance for client-side interactions.
* **Actions:** `app/auth/actions/index.tsx` and `app/auth-server-action/actions/actions.tsx` contain functions to sign up, sign in, and sign out users.

#### 2.3. Storage (Supabase Storage)

*   **Buckets:**  An "avatars" bucket is configured for storing user avatars. Other buckets could be set up to store documents.
*   **File Upload:**  The `FileUploader` component handles client-side file uploads.  The `Avatar` component (in `app/account/avatar.tsx`) provides a specific example of uploading and managing user avatars.
*   **Storage Policies:**  Storage policies (not shown in the provided code, but crucial) would need to be configured in the Supabase dashboard to control access to uploaded files based on user roles and authentication status.

#### 2.4.  Realtime (Potentially)

*   Supabase Realtime could be used for features like live updates to the dashboard or notifications, but it's not explicitly utilized in the provided code.

### 3. Next.js Integration

#### 3.1. API Routes

*   **`/api/send`:** An API route that uses the `resend` library to send emails. This is a basic example and would likely be expanded for more complex email functionality.
*   **`/api/sid/callback`:** This route handles the OAuth callback from Supabase, exchanging the authorization code for a user session.

#### 3.2. Server Actions

*   Server Actions are used extensively for form submissions and data mutations.  They provide a secure way to interact with the Supabase backend from the client. Examples include:
    *   `signUpWithEmailAndPassword`, `loginWithEmailAndPassword`, `logout` (authentication).
    *   `updateInqueries` (contact form submission).
    * Other actions are implied by the RLS policies and functions, but not explicitly defined in separate action files.

#### 3.3. Server Components

* Server components and `use server` actions are used to protect secrets and connect to supabase instances in a variety of scenarios:
    - Authentication (login, signup, logout)
    - User Session Retrieval
    - Database queries and mutations, where direct client access is not appropriate
    - Calls to OpenAI API

#### 3.4. Client Components

* Client components are used for interactive elements and components that require client-side JavaScript. Examples:
  - File upload via Uploadthing
  - Display user avatar

### 4. Data Flow Example (Document Upload)

1.  **User Interaction:** The user drags and drops a file onto the `FileUploader` component in the patient detail page.
2.  **Client-Side Validation:** The `FileUploader` component performs basic validation (file type, size).
3.  **Upload to Supabase Storage:** The file is uploaded to Supabase Storage using the `supabase.storage` API.  The file path is returned.
4.  **Database Update:** A new record is created in the `patient_documents` table, storing the file path, metadata (extracted on the client-side), and other relevant information.  This is likely done via a Server Action.
5.  **Background Processing (Future):**  A Supabase Edge Function (or a serverless function triggered by a database webhook) could be used to:
    *   Fetch the document from Supabase Storage.
    *   Perform chunking and embedding generation.
    *   Use an LLM ("Gemini flash") to analyze the document.
    *   Store the chunks and embeddings in the `document_chunks` table.
    *   Update the `patient_documents` record with processing status and any extracted insights.
6.  **UI Update:** The UI updates to reflect the new document and its processing status. Once processing is complete, the summaries and key findings are displayed.

### 5. Security

*   **Authentication:** Supabase Auth handles user authentication.
*   **Authorization:** Row Level Security (RLS) policies in PostgreSQL control data access based on user roles and department affiliations.
*   **Data Validation:** Zod is used for schema validation on both the client-side (with React Hook Form) and server-side (within Server Actions) to ensure data integrity.
*   **Environment Variables:** Sensitive information (API keys, secrets) should be stored in environment variables (e.g., `process.env.NEXT_PUBLIC_SUPABASE_URL`, `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY`).
* **HTTPS:** Enforced by default when deploying through platforms like Vercel.

### 6.  Deployment

*   **Vercel:** The application is designed to be deployed on Vercel, leveraging its Next.js integration and serverless functions.
