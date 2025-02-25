# Verification, Patients, and Reports Implementation

This document provides a detailed explanation of how patient data, document verification, and report generation are implemented in the Neuvia app.

## Table of Contents

1. [Patient Management](#patient-management)
2. [Document Verification Flow](#document-verification-flow)
3. [Report Generation](#report-generation)
4. [Direct Verification-to-Report Flow](#direct-verification-to-report-flow)
5. [Integration Points](#integration-points)

## Patient Management

### Patient Data Model

Patients are a core entity in the Neuvia app, representing individuals whose medical documents we process. Each patient has:

- A unique patient ID (UUID)
- Demographic information (name, date of birth, contact details)
- Medical history references
- Department assignments
- Document associations

Patient data is stored in the Supabase `patients` table and is accessed through server-side functions and client-side hooks.

### Patient-Document Relationship

- Each document is associated with exactly one patient
- Patients can have multiple documents
- Reports are generated for patients based on their documents
- All workflows (extraction, verification, research, report generation) require a patient association

## Document Verification Flow

The document verification system is designed to ensure accuracy and reliability of extracted medical information before it's used in reports.

### Extraction Phase

1. Documents are uploaded and processed by the `DocumentProcessingService`
2. The `DataExtractor` extracts raw text and structures it into sections
3. A workflow is created to track the document's progress
4. Extraction produces an `ExtractedDocument` that contains raw text, metadata, and structured data

### Verification Phase

1. The `VerificationConnector` component initializes the verification UI
2. `VerificationItems` are generated from the extracted data
3. Users verify individual items, mark them as correct, or provide corrections
4. The verification UI displays:
   - Original text for reference
   - Extracted data by section
   - Controls to approve or correct data

### Verification Data Flow

```
┌─────────────┐     ┌─────────────────┐     ┌───────────────────┐
│ Extracted   │     │ Verification     │     │ Verified          │
│ Document    │────▶│ Items           │────▶│ Document          │
└─────────────┘     └─────────────────┘     └───────────────────┘
                          ▲
                          │
                    ┌─────┴─────┐
                    │ User      │
                    │ Input     │
                    └───────────┘
```

### Key Components

1. **VerificationUI**: The main component for the verification interface
   - Displays extracted data by section
   - Provides verification controls
   - Manages the verification state

2. **VerificationConnector**: Handles the workflow integration
   - Loads document data from the workflow
   - Saves verification results back to the workflow
   - Manages navigation to next steps

3. **DocumentProcessingService**: Provides methods for verification
   - `startVerification(workflowId, document)`: Initiates verification
   - `saveVerificationResults(workflowId, items, status, document)`: Commits results

## Report Generation

Reports are comprehensive medical documents generated based on verified data, with optional research for additional context.

### Report Types

Neuvia supports multiple report types:
- Diagnostic reports
- Progress reports
- Analytics reports

### Report Data Model

Each report contains:
- Patient information
- Source document references
- Clinical content (structured by sections)
- Metadata (model information, confidence scores, etc.)
- Differential diagnoses (where applicable)

### Report Generation Flow

1. **Generation Process**
   - Reports are generated from verified documents
   - Optional research can enrich the report content
   - The `DocumentProcessingService.generateReport()` method handles creation

2. **Report Formatting**
   - Reports can be formatted as HTML, Markdown, or PDF
   - Each format includes appropriate styling and structure
   - Document references are included with proper citations

3. **Report Storage**
   - Reports are stored in the database associated with patients
   - Reports maintain references back to source documents
   - Reports include metadata about generation (timestamp, model, confidence)

## Direct Verification-to-Report Flow

We recently implemented a direct verification-to-report flow that allows skipping the research phase.

### Implementation

The direct flow is implemented with:

1. A new UI option in the verification completion screen
2. The `generateReportFromVerification()` method in the `DocumentProcessingService`
3. Integration in the workflow to transition directly from verification to report generation

### User Flow

```
┌─────────────┐     ┌─────────────────┐     ┌───────────────────┐
│ Document    │     │ Verification     │     │ Report Generation │
│ Upload      │────▶│ Phase           │────▶│ (Direct)          │
└─────────────┘     └─────────────────┘     └───────────────────┘
```

### Technical Implementation

The direct verification-to-report flow:
1. Uses the `workflowId` to track the document through the process
2. Creates document references automatically from verified documents
3. Generates a report using just the verified data without additional research
4. Provides progress updates through toast notifications
5. Navigates the user to the reports page upon completion

## Integration Points

### Workflow Integration

The verification, patients, and reports systems connect through the workflow system:

1. **Workflow States Table**: Tracks document progression through stages
2. **Workflow IDs**: Unique identifiers that tie together the processing phases
3. **Metadata**: Stored with each workflow record to maintain context

### UI Integration

The user interface provides seamless transitions between systems:

1. **Document Upload**: Patient selection → document upload → extraction
2. **Verification UI**: Document review → item verification → report options
3. **Reports View**: Report listing → detail view → download options

### Data Flow

Data moves through the system as follows:

```
┌─────────────┐     ┌─────────────────┐     ┌───────────────────┐     ┌───────────────┐
│ Extraction  │     │ Verification     │     │ Research          │     │ Report        │
│ (Raw Text)  │────▶│ (Structured     │────▶│ (Additional       │────▶│ (Formatted    │
│             │     │  Data)           │     │  Context)         │     │  Document)    │
└─────────────┘     └─────────────────┘     └───────────────────┘     └───────────────┘
                           │
                           │
                           ▼
                    ┌─────────────────┐
                    │ Direct Report   │
                    │ Generation      │
                    └─────────────────┘
```

For direct verification-to-report flow, we skip the research phase and generate reports immediately after verification.

---

This document provides an overview of the current implementation. For more detailed information about specific components, refer to the codebase and other documentation in the `instructions` folder. 