2.0 Pro Experimental. Lacks access to real-time info and some Gemini features.
Okay, here's a detailed App Flow Document, written in a narrative style without bullet points, designed to map out the user journeys for the Neuvia application. This is specifically crafted to guide an AI coding model, providing a clear sequence of interactions and page transitions.

Neuvia Application Flow Document
The user initially arrives at the landing page, which is the root URL (/). This page presents an overview of Neuvia's capabilities, featuring a compelling headline, a brief description of the AI-powered analysis, and prominent "Get Started" and "Sign Up" calls to action. There's also a "Login" link for existing users. The landing page includes feature highlights, security assurances (SOC 2 Type II, HIPAA Compliant, 256-bit Encryption), and a footer. A cookie consent button is present for managing user preferences.

If the user is already logged in, accessing the root URL (/) automatically redirects them to the dashboard (/dashboard).

If a user clicks "Login" or navigates directly to /auth, they are presented with the authentication page. This page offers options to log in using email/password, Google, or GitHub. Successful login redirects the user to the dashboard (/dashboard). If the user fails to log in, an error message is displayed, and they remain on the /auth page. The /auth/callback route is used for handling the OAuth flow, exchanging a code for a session.

If a user is not logged in, and chooses sign-up, it directs the user to /onboarding.

From the landing page, users can also access static pages like /terms (Terms of Service), /privacy (Privacy Policy), and /blog (for a NextMDX blog page).

The dashboard (/dashboard) is the central hub for authenticated users. It displays quick stats, recent patient activity, and a patient overview visualization. A prominent "Add Patient" button is a floating action button, linking to /dashboard/patients/new. A sidebar provides navigation to other sections of the dashboard.

The sidebar on /dashboard allows navigation to different sections:
Settings --> /dashboard/settings
Profile --> /dashboard/profile
Patients -->/dashboard/patients
Analysis --> /dashboard/analysis
Reports --> /dashboard/reports
Activity--> /dashboard/activity

The "Add Patient" page (/dashboard/patients/new) presents a form for creating a new patient record. The form includes fields such as full name, date of birth, assigned sex at birth, and preferred language. Submitting the form creates a new patient and likely redirects to the patient's detail page.

The "Patients" page (/dashboard/patients) displays a list of patients (currently a placeholder in the MVP). A search bar allows filtering the patient list. Clicking on a patient in the list navigates to the individual patient's detail page (e.g., /dashboard/patients/[id], where [id] is the patient's unique identifier).

The individual patient detail page (e.g., /dashboard/patients/[id]) shows the patient's information and provides an interface for uploading documents. Uploaded documents trigger the processing pipeline (chunking, embedding, summarization). The page displays summaries, key findings, and any generated clinical insights.

The "Settings" page (/dashboard/settings) offers options to manage user profiles, team members, notification preferences, security settings, and data management. Selecting "Team Members" navigates to /dashboard/settings/members, where users can view, add, edit, or delete team members if they have admin permissions. The user can click add member, which opens a modal using shadcn dialog. The "Profile" section within settings allows the user to update their account information, including their name, username, website, and avatar. It utilizes components such as Avatar and AccountForm.

The "Contact" page (/contact) allows the user to submit inquiries. They input their name, email, and message, and submit the form. The submission triggers a server action (updateInqueries) and displays a success message.

The /api/send/route.ts is a simple API route used to demonstrate email integration using resend.

The /api/sid/callback/route.tsx handles the OAuth2 provider code exchange.

The /auth-server-action/page.tsx handles user actions using Server Actions. The nested actions folder contains the files /auth-server-action/actions/actions.tsx and /auth-server-action/actions/index.ts which contains the login and logout functions.

The "Countries" page (/countries/[id]/page.tsx) dynamically displays details for a specific country based on the provided ID. It fetches and shows the country's name using getCountryById. A corresponding client component is provided for CSR at /ssrcountries/[id]/country.tsx

There's an Error page (/error/page.tsx).

There's a Private page (/private/page.tsx), which requires a signed-in user and redirects to the home if no one is signed-in

There is a signout page (/signout/page.tsx).

There's a Next.js Playground at (/playground/page.tsx), and linked MDX pages at (/mdx/page.mdx).

The application uses consistent layout structures, with app/layout.tsx defining the root layout, and specialized layouts such as app/dashboard/layout.tsx for the dashboard section and mdx layout for blog, privacy, terms.

This flow covers all the pages and components provided in the file listing, and the user paths.
