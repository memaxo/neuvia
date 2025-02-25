export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          changes: Json | null
          created_at: string | null
          department_id: string | null
          entity_id: string
          entity_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changes?: Json | null
          created_at?: string | null
          department_id?: string | null
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changes?: Json | null
          created_at?: string | null
          department_id?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      chats: {
        Row: {
          created_at: string | null
          id: string
          title: string
          updated_at: string | null
          user_id: string | null
          visibility: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          title: string
          updated_at?: string | null
          user_id?: string | null
          visibility?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          title?: string
          updated_at?: string | null
          user_id?: string | null
          visibility?: string
        }
        Relationships: []
      }
      countries: {
        Row: {
          continent: Database["public"]["Enums"]["continents"] | null
          id: number
          iso2: string
          iso3: string | null
          local_name: string | null
          name: string | null
        }
        Insert: {
          continent?: Database["public"]["Enums"]["continents"] | null
          id: number
          iso2: string
          iso3?: string | null
          local_name?: string | null
          name?: string | null
        }
        Update: {
          continent?: Database["public"]["Enums"]["continents"] | null
          id?: number
          iso2?: string
          iso3?: string | null
          local_name?: string | null
          name?: string | null
        }
        Relationships: []
      }
      departments: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          metadata: Json | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      document_chunks: {
        Row: {
          chunk_embedding: string | null
          chunk_index: number
          chunk_type: string | null
          content: string
          created_at: string | null
          document_id: string | null
          heading: string | null
          id: string
          importance_score: number | null
          metadata: Json | null
          page_number: number | null
          position_end: number | null
          position_metadata: Json | null
          position_start: number | null
          related_chunks: Json | null
          token_count: number
          updated_at: string | null
        }
        Insert: {
          chunk_embedding?: string | null
          chunk_index: number
          chunk_type?: string | null
          content: string
          created_at?: string | null
          document_id?: string | null
          heading?: string | null
          id?: string
          importance_score?: number | null
          metadata?: Json | null
          page_number?: number | null
          position_end?: number | null
          position_metadata?: Json | null
          position_start?: number | null
          related_chunks?: Json | null
          token_count: number
          updated_at?: string | null
        }
        Update: {
          chunk_embedding?: string | null
          chunk_index?: number
          chunk_type?: string | null
          content?: string
          created_at?: string | null
          document_id?: string | null
          heading?: string | null
          id?: string
          importance_score?: number | null
          metadata?: Json | null
          page_number?: number | null
          position_end?: number | null
          position_metadata?: Json | null
          position_start?: number | null
          related_chunks?: Json | null
          token_count?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "patient_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_embeddings: {
        Row: {
          content: string
          created_at: string
          document_id: number | null
          embedding: string
          id: number
        }
        Insert: {
          content: string
          created_at?: string
          document_id?: number | null
          embedding: string
          id?: never
        }
        Update: {
          content?: string
          created_at?: string
          document_id?: number | null
          embedding?: string
          id?: never
        }
        Relationships: [
          {
            foreignKeyName: "document_embeddings_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          content: string
          created_at: string
          id: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: never
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: never
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      inqueries: {
        Row: {
          created_at: string | null
          email: string | null
          id: number
          message: string
          name: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: never
          message: string
          name?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: never
          message?: string
          name?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          chat_id: string | null
          content: Json
          created_at: string | null
          id: string
          role: string
          updated_at: string | null
        }
        Insert: {
          chat_id?: string | null
          content: Json
          created_at?: string | null
          id?: string
          role: string
          updated_at?: string | null
        }
        Update: {
          chat_id?: string | null
          content?: Json
          created_at?: string | null
          id?: string
          role?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_documents: {
        Row: {
          category: Database["public"]["Enums"]["document_category"]
          checksum: string
          chunk_embeddings: Json | null
          content_summary: string | null
          content_text: string | null
          created_at: string | null
          department: string | null
          document_date: string
          document_embedding: string | null
          document_type: Json
          facility_name: string | null
          file_path: string
          file_size: number
          file_type: string
          id: string
          is_processed: boolean | null
          key_findings: Json | null
          last_modified_by: string | null
          metadata: Json | null
          patient_id: string | null
          processing_error: string | null
          processing_status: string
          provider_name: string | null
          title: string
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          category: Database["public"]["Enums"]["document_category"]
          checksum: string
          chunk_embeddings?: Json | null
          content_summary?: string | null
          content_text?: string | null
          created_at?: string | null
          department?: string | null
          document_date: string
          document_embedding?: string | null
          document_type?: Json
          facility_name?: string | null
          file_path: string
          file_size: number
          file_type: string
          id?: string
          is_processed?: boolean | null
          key_findings?: Json | null
          last_modified_by?: string | null
          metadata?: Json | null
          patient_id?: string | null
          processing_error?: string | null
          processing_status?: string
          provider_name?: string | null
          title: string
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["document_category"]
          checksum?: string
          chunk_embeddings?: Json | null
          content_summary?: string | null
          content_text?: string | null
          created_at?: string | null
          department?: string | null
          document_date?: string
          document_embedding?: string | null
          document_type?: Json
          facility_name?: string | null
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          is_processed?: boolean | null
          key_findings?: Json | null
          last_modified_by?: string | null
          metadata?: Json | null
          patient_id?: string | null
          processing_error?: string | null
          processing_status?: string
          provider_name?: string | null
          title?: string
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_documents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_summaries: {
        Row: {
          created_at: string
          created_by: string
          department_id: string | null
          document_count: number
          generated_at: string
          id: string
          last_modified_by: string
          patient_id: string
          summary: Json
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          department_id?: string | null
          document_count: number
          generated_at?: string
          id?: string
          last_modified_by: string
          patient_id: string
          summary: Json
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          department_id?: string | null
          document_count?: number
          generated_at?: string
          id?: string
          last_modified_by?: string
          patient_id?: string
          summary?: Json
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_summaries_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_summaries_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          allergies: Json | null
          blood_type: string | null
          city: string | null
          clinical_data: Json | null
          conditions: Json | null
          country: string | null
          created_at: string | null
          created_by: string | null
          current_medications: Json | null
          custom_fields: Json | null
          date_of_birth: string
          department_id: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relationship: string | null
          first_name: string
          gender: string | null
          id: string
          immunizations: Json | null
          insurance_id: string | null
          insurance_provider: string | null
          last_modified_by: string | null
          last_name: string
          mrn: string
          patient_embedding: string | null
          phone: string | null
          postal_code: string | null
          preferred_language: string | null
          primary_care_physician: string | null
          social_determinants: Json | null
          state: string | null
          status: Database["public"]["Enums"]["patient_status"]
          updated_at: string | null
          vital_signs: Json | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          allergies?: Json | null
          blood_type?: string | null
          city?: string | null
          clinical_data?: Json | null
          conditions?: Json | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          current_medications?: Json | null
          custom_fields?: Json | null
          date_of_birth: string
          department_id?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          first_name: string
          gender?: string | null
          id?: string
          immunizations?: Json | null
          insurance_id?: string | null
          insurance_provider?: string | null
          last_modified_by?: string | null
          last_name: string
          mrn: string
          patient_embedding?: string | null
          phone?: string | null
          postal_code?: string | null
          preferred_language?: string | null
          primary_care_physician?: string | null
          social_determinants?: Json | null
          state?: string | null
          status?: Database["public"]["Enums"]["patient_status"]
          updated_at?: string | null
          vital_signs?: Json | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          allergies?: Json | null
          blood_type?: string | null
          city?: string | null
          clinical_data?: Json | null
          conditions?: Json | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          current_medications?: Json | null
          custom_fields?: Json | null
          date_of_birth?: string
          department_id?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          first_name?: string
          gender?: string | null
          id?: string
          immunizations?: Json | null
          insurance_id?: string | null
          insurance_provider?: string | null
          last_modified_by?: string | null
          last_name?: string
          mrn?: string
          patient_embedding?: string | null
          phone?: string | null
          postal_code?: string | null
          preferred_language?: string | null
          primary_care_physician?: string | null
          social_determinants?: Json | null
          state?: string | null
          status?: Database["public"]["Enums"]["patient_status"]
          updated_at?: string | null
          vital_signs?: Json | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean | null
          medical_role: Database["public"]["Enums"]["medical_role"]
          metadata: Json | null
          updated_at: string | null
          username: string | null
          website: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean | null
          medical_role?: Database["public"]["Enums"]["medical_role"]
          metadata?: Json | null
          updated_at?: string | null
          username?: string | null
          website?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          medical_role?: Database["public"]["Enums"]["medical_role"]
          metadata?: Json | null
          updated_at?: string | null
          username?: string | null
          website?: string | null
        }
        Relationships: []
      }
      report_audit_logs: {
        Row: {
          action: string
          changes: Json | null
          id: string
          report_id: string | null
          timestamp: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changes?: Json | null
          id?: string
          report_id?: string | null
          timestamp?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changes?: Json | null
          id?: string
          report_id?: string | null
          timestamp?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_audit_logs_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          clinical_guidelines: Json | null
          completed_at: string | null
          compliance_metadata: Json
          confidence_score: number | null
          content: Json | null
          created_at: string
          created_by: string
          department_id: string
          differential_diagnoses: Json | null
          error_message: string | null
          evidence_mapping: Json | null
          findings: Json | null
          icd_codes: Json | null
          id: string
          medical_references: Json | null
          metadata: Json
          model_metadata: Json
          patient_id: string
          recommendations: Json | null
          reviewed_at: string | null
          reviewed_by: string | null
          snomed_codes: Json | null
          source_documents: Json | null
          status: string
          summary: string | null
          title: string
          type: string
          updated_at: string
          updated_by: string
          validation_metadata: Json
        }
        Insert: {
          clinical_guidelines?: Json | null
          completed_at?: string | null
          compliance_metadata?: Json
          confidence_score?: number | null
          content?: Json | null
          created_at?: string
          created_by: string
          department_id: string
          differential_diagnoses?: Json | null
          error_message?: string | null
          evidence_mapping?: Json | null
          findings?: Json | null
          icd_codes?: Json | null
          id?: string
          medical_references?: Json | null
          metadata: Json
          model_metadata?: Json
          patient_id: string
          recommendations?: Json | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          snomed_codes?: Json | null
          source_documents?: Json | null
          status: string
          summary?: string | null
          title: string
          type: string
          updated_at?: string
          updated_by: string
          validation_metadata?: Json
        }
        Update: {
          clinical_guidelines?: Json | null
          completed_at?: string | null
          compliance_metadata?: Json
          confidence_score?: number | null
          content?: Json | null
          created_at?: string
          created_by?: string
          department_id?: string
          differential_diagnoses?: Json | null
          error_message?: string | null
          evidence_mapping?: Json | null
          findings?: Json | null
          icd_codes?: Json | null
          id?: string
          medical_references?: Json | null
          metadata?: Json
          model_metadata?: Json
          patient_id?: string
          recommendations?: Json | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          snomed_codes?: Json | null
          source_documents?: Json | null
          status?: string
          summary?: string | null
          title?: string
          type?: string
          updated_at?: string
          updated_by?: string
          validation_metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "reports_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_permissions: {
        Row: {
          access_level: Database["public"]["Enums"]["access_level"]
          conditions: Json | null
          created_at: string | null
          id: string
          medical_role: Database["public"]["Enums"]["medical_role"]
          metadata: Json | null
          resource_type: string
          updated_at: string | null
        }
        Insert: {
          access_level?: Database["public"]["Enums"]["access_level"]
          conditions?: Json | null
          created_at?: string | null
          id?: string
          medical_role: Database["public"]["Enums"]["medical_role"]
          metadata?: Json | null
          resource_type: string
          updated_at?: string | null
        }
        Update: {
          access_level?: Database["public"]["Enums"]["access_level"]
          conditions?: Json | null
          created_at?: string | null
          id?: string
          medical_role?: Database["public"]["Enums"]["medical_role"]
          metadata?: Json | null
          resource_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_departments: {
        Row: {
          access_level: Database["public"]["Enums"]["access_level"]
          created_at: string | null
          department_id: string | null
          id: string
          is_primary: boolean | null
          metadata: Json | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          access_level?: Database["public"]["Enums"]["access_level"]
          created_at?: string | null
          department_id?: string | null
          id?: string
          is_primary?: boolean | null
          metadata?: Json | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          access_level?: Database["public"]["Enums"]["access_level"]
          created_at?: string | null
          department_id?: string | null
          id?: string
          is_primary?: boolean | null
          metadata?: Json | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_departments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_departments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      votes: {
        Row: {
          chat_id: string
          created_at: string | null
          is_upvoted: boolean
          message_id: string
          updated_at: string | null
        }
        Insert: {
          chat_id: string
          created_at?: string | null
          is_upvoted: boolean
          message_id: string
          updated_at?: string | null
        }
        Update: {
          chat_id?: string
          created_at?: string | null
          is_upvoted?: boolean
          message_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "votes_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_states: {
        Row: {
          chat_id: string | null
          created_at: string
          current_step: Database["public"]["Enums"]["workflow_step"]
          id: string
          last_message_id: string | null
          metadata: Json | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          chat_id?: string | null
          created_at?: string
          current_step?: Database["public"]["Enums"]["workflow_step"]
          id?: string
          last_message_id?: string | null
          metadata?: Json | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          chat_id?: string | null
          created_at?: string
          current_step?: Database["public"]["Enums"]["workflow_step"]
          id?: string
          last_message_id?: string | null
          metadata?: Json | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_states_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_states_last_message_id_fkey"
            columns: ["last_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      binary_quantize:
        | {
            Args: {
              "": string
            }
            Returns: unknown
          }
        | {
            Args: {
              "": unknown
            }
            Returns: unknown
          }
      check_document_category_access: {
        Args: {
          category: Database["public"]["Enums"]["document_category"]
          required_level: Database["public"]["Enums"]["access_level"]
        }
        Returns: boolean
      }
      check_resource_access: {
        Args: {
          resource_type: string
          required_level: Database["public"]["Enums"]["access_level"]
        }
        Returns: boolean
      }
      gtrgm_compress: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      gtrgm_decompress: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      gtrgm_in: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      gtrgm_options: {
        Args: {
          "": unknown
        }
        Returns: undefined
      }
      gtrgm_out: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      halfvec_avg: {
        Args: {
          "": number[]
        }
        Returns: unknown
      }
      halfvec_out: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      halfvec_send: {
        Args: {
          "": unknown
        }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: {
          "": unknown[]
        }
        Returns: number
      }
      hnsw_bit_support: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      hnswhandler: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      ivfflat_bit_support: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      ivfflathandler: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      l2_norm:
        | {
            Args: {
              "": unknown
            }
            Returns: number
          }
        | {
            Args: {
              "": unknown
            }
            Returns: number
          }
      l2_normalize:
        | {
            Args: {
              "": string
            }
            Returns: string
          }
        | {
            Args: {
              "": unknown
            }
            Returns: unknown
          }
        | {
            Args: {
              "": unknown
            }
            Returns: unknown
          }
      match_documents: {
        Args: {
          query_embedding: string
          match_threshold: number
          match_count: number
        }
        Returns: {
          content: string
          similarity: number
        }[]
      }
      match_patient_documents: {
        Args: {
          embedding: string
          match_threshold: number
          match_count: number
          patient_id?: string
        }
        Returns: {
          id: string
          document_id: string
          content: string
          similarity: number
        }[]
      }
      set_limit: {
        Args: {
          "": number
        }
        Returns: number
      }
      show_limit: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      show_trgm: {
        Args: {
          "": string
        }
        Returns: string[]
      }
      sparsevec_out: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      sparsevec_send: {
        Args: {
          "": unknown
        }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: {
          "": unknown[]
        }
        Returns: number
      }
      update_workflow_state:
        | {
            Args: {
              p_user_id: string
              p_step: Database["public"]["Enums"]["workflow_step"]
              p_metadata?: Json
            }
            Returns: {
              chat_id: string | null
              created_at: string
              current_step: Database["public"]["Enums"]["workflow_step"]
              id: string
              last_message_id: string | null
              metadata: Json | null
              updated_at: string
              user_id: string | null
            }
          }
        | {
            Args: {
              p_user_id: string
              p_step: Database["public"]["Enums"]["workflow_step"]
              p_metadata?: Json
              p_chat_id?: string
              p_last_message_id?: string
            }
            Returns: {
              chat_id: string | null
              created_at: string
              current_step: Database["public"]["Enums"]["workflow_step"]
              id: string
              last_message_id: string | null
              metadata: Json | null
              updated_at: string
              user_id: string | null
            }
          }
      validate_document_type: {
        Args: {
          doc_type: Json
        }
        Returns: boolean
      }
      validate_jsonb_fields: {
        Args: {
          fields: Json[]
        }
        Returns: boolean
      }
      vector_avg: {
        Args: {
          "": number[]
        }
        Returns: string
      }
      vector_dims:
        | {
            Args: {
              "": string
            }
            Returns: number
          }
        | {
            Args: {
              "": unknown
            }
            Returns: number
          }
      vector_norm: {
        Args: {
          "": string
        }
        Returns: number
      }
      vector_out: {
        Args: {
          "": string
        }
        Returns: unknown
      }
      vector_send: {
        Args: {
          "": string
        }
        Returns: string
      }
      vector_typmod_in: {
        Args: {
          "": unknown[]
        }
        Returns: number
      }
    }
    Enums: {
      access_level: "none" | "read" | "write" | "admin"
      continents:
        | "Africa"
        | "Antarctica"
        | "Asia"
        | "Europe"
        | "Oceania"
        | "North America"
        | "South America"
      document_category:
        | "clinical"
        | "lab"
        | "imaging"
        | "prescription"
        | "administrative"
      medical_role: "admin" | "doctor" | "nurse" | "staff" | "researcher"
      patient_status: "active" | "inactive" | "archived" | "deceased"
      workflow_step:
        | "idle"
        | "uploading"
        | "extracting"
        | "verification"
        | "report_generation"
        | "complete"
        | "chat_started"
        | "chat_in_progress"
        | "chat_completed"
        | "chat_error"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
