/**
 * API Client implementation that integrates all API services.
 * This client is used by all hooks to access backend APIs.
 */
import { HttpClient } from './models/http-client'
import { Auth } from './services/auth-service'
import { Reports } from './services/reports-service'
import { Verification } from './services/verification-service'
import { Security } from './services/security-service'
import { Email } from './services/email-service'
import { Research } from './services/research-service'
import { Documents } from './services/documents-service'
import { Chat } from './services/chat-service'
import { Patients } from './services/patients-service'

/**
 * Centralized API client that exposes all API services
 */
export class ApiClient {
  private httpClient: HttpClient
  
  // Services
  public auth: Auth
  public reports: Reports
  public verification: Verification
  public security: Security
  public email: Email
  public research: Research
  public documents: Documents
  public chat: Chat
  public patients: Patients

  constructor(config: { baseUrl?: string } = {}) {
    // Initialize HTTP client
    this.httpClient = new HttpClient({
      baseUrl: config.baseUrl !== undefined ? config.baseUrl : '/api'
    })

    // Initialize all API services
    this.auth = new Auth(this.httpClient)
    this.reports = new Reports(this.httpClient)
    this.verification = new Verification(this.httpClient)
    this.security = new Security(this.httpClient)
    this.email = new Email(this.httpClient)
    this.research = new Research(this.httpClient)
    this.documents = new Documents(this.httpClient)
    this.chat = new Chat(this.httpClient)
    this.patients = new Patients(this.httpClient)
  }

  /**
   * Set security token for all API requests
   * @param token Security token for authentication
   */
  public setAuthToken(token: string) {
    this.httpClient.setSecurityData({ token })
  }

  /**
   * Clear security token
   */
  public clearAuthToken() {
    this.httpClient.setSecurityData(null)
  }
}

