import type { Database } from '../supabase';

// Type-safe row types
export type Chat = Database['public']['Tables']['chats']['Row'];
export type Message = Database['public']['Tables']['messages']['Row'];
export type Vote = Database['public']['Tables']['votes']['Row'];
export type WorkflowStep = Database['public']['Enums']['workflow_step'];
export type WorkflowState = Database['public']['Tables']['workflow_states']['Row'];

// Type-safe insert types
export type ChatInsert = Database['public']['Tables']['chats']['Insert'];
export type MessageInsert = Database['public']['Tables']['messages']['Insert'];
export type VoteInsert = Database['public']['Tables']['votes']['Insert'];
export type WorkflowStateInsert = Database['public']['Tables']['workflow_states']['Insert'];

// Type-safe update types
export type ChatUpdate = Database['public']['Tables']['chats']['Update'];
export type MessageUpdate = Database['public']['Tables']['messages']['Update'];
export type VoteUpdate = Database['public']['Tables']['votes']['Update'];
export type WorkflowStateUpdate = Database['public']['Tables']['workflow_states']['Update'];

// Re-export the visibility type
export type ChatVisibility = 'public' | 'private';
