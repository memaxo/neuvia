'use client';

import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  User,
  Phone,
  Mail,
  MapPin,
  CalendarCheck,
  Languages,
  HeartPulse,
  AlertCircle,
  Pill,
  Stethoscope,
  Building,
  CreditCard,
  Contact2
} from 'lucide-react';

interface PatientOverviewProps {
  patient: any; // Using any for now, can be replaced with a proper Patient type
}

export function PatientOverview({ patient }: PatientOverviewProps) {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not provided';
    try {
      return format(new Date(dateString), 'MMMM d, yyyy');
    } catch (e) {
      return 'Invalid date';
    }
  };
  
  // Helper to parse JSON arrays with fallback
  const parseJsonArray = (jsonString: string | null, defaultValue: any[] = []) => {
    if (!jsonString) return defaultValue;
    try {
      return JSON.parse(jsonString);
    } catch (e) {
      return defaultValue;
    }
  };
  
  // Parse JSON arrays
  const allergies = parseJsonArray(patient.allergies);
  const medications = parseJsonArray(patient.current_medications);
  const conditions = parseJsonArray(patient.conditions);
  
  return (
    <div className="space-y-6">
      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <User className="text-primary mr-2 size-5" />
            Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          <div>
            <div className="text-muted-foreground text-sm font-medium">Full Name</div>
            <div className="font-medium">{patient.first_name} {patient.last_name}</div>
          </div>
          
          <div>
            <div className="text-muted-foreground text-sm font-medium">Date of Birth</div>
            <div className="font-medium">{formatDate(patient.date_of_birth)}</div>
          </div>
          
          <div>
            <div className="text-muted-foreground text-sm font-medium">Gender</div>
            <div className="font-medium capitalize">{patient.gender || 'Not specified'}</div>
          </div>
          
          <div>
            <div className="text-muted-foreground text-sm font-medium">Medical Record Number</div>
            <div className="font-medium">{patient.mrn || 'Not assigned'}</div>
          </div>
          
          <div>
            <div className="text-muted-foreground text-sm font-medium">Preferred Language</div>
            <div className="flex items-center font-medium">
              <Languages className="text-muted-foreground mr-1 size-3" />
              {patient.preferred_language || 'Not specified'}
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <Phone className="text-primary mr-2 size-5" />
            Contact Information
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          <div>
            <div className="text-muted-foreground text-sm font-medium">Email</div>
            <div className="flex items-center font-medium">
              <Mail className="text-muted-foreground mr-1 size-3" />
              {patient.email || 'Not provided'}
            </div>
          </div>
          
          <div>
            <div className="text-muted-foreground text-sm font-medium">Phone</div>
            <div className="font-medium">{patient.phone || 'Not provided'}</div>
          </div>
          
          <div className="col-span-full">
            <div className="text-muted-foreground text-sm font-medium">Address</div>
            <div className="flex items-start font-medium">
              <MapPin className="text-muted-foreground mr-1 mt-1 size-3" />
              <div>
                {patient.address_line1 ? (
                  <>
                    <div>{patient.address_line1}</div>
                    {patient.address_line2 && <div>{patient.address_line2}</div>}
                    <div>
                      {[
                        patient.city,
                        patient.state,
                        patient.postal_code,
                        patient.country
                      ].filter(Boolean).join(', ')}
                    </div>
                  </>
                ) : (
                  'No address provided'
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Emergency Contact */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <Contact2 className="text-primary mr-2 size-5" />
            Emergency Contact
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          <div>
            <div className="text-muted-foreground text-sm font-medium">Name</div>
            <div className="font-medium">{patient.emergency_contact_name || 'Not provided'}</div>
          </div>
          
          <div>
            <div className="text-muted-foreground text-sm font-medium">Phone</div>
            <div className="font-medium">{patient.emergency_contact_phone || 'Not provided'}</div>
          </div>
          
          <div>
            <div className="text-muted-foreground text-sm font-medium">Relationship</div>
            <div className="font-medium">{patient.emergency_contact_relationship || 'Not specified'}</div>
          </div>
        </CardContent>
      </Card>
      
      {/* Medical Information Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <HeartPulse className="text-primary mr-2 size-5" />
            Medical Information
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <div className="text-muted-foreground text-sm font-medium">Blood Type</div>
            <div className="font-medium">{patient.blood_type || 'Not recorded'}</div>
          </div>
          
          <div>
            <div className="text-muted-foreground text-sm font-medium">Primary Care Physician</div>
            <div className="flex items-center font-medium">
              <Stethoscope className="text-muted-foreground mr-1 size-3" />
              {patient.primary_care_physician || 'Not assigned'}
            </div>
          </div>
          
          <div>
            <div className="text-muted-foreground flex items-center text-sm font-medium">
              <AlertCircle className="text-muted-foreground mr-1 size-3" />
              Allergies
            </div>
            <div className="text-sm">
              {allergies.length === 0 ? (
                <span className="text-muted-foreground">No known allergies</span>
              ) : (
                <ul className="list-disc pl-5">
                  {allergies.map((allergy: any, index: number) => (
                    <li key={index}>{allergy.name}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          
          <div>
            <div className="text-muted-foreground flex items-center text-sm font-medium">
              <Pill className="text-muted-foreground mr-1 size-3" />
              Current Medications
            </div>
            <div className="text-sm">
              {medications.length === 0 ? (
                <span className="text-muted-foreground">No current medications</span>
              ) : (
                <ul className="list-disc pl-5">
                  {medications.map((medication: any, index: number) => (
                    <li key={index}>{medication.name}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Administrative Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <Building className="text-primary mr-2 size-5" />
            Administrative Information
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <div className="text-muted-foreground text-sm font-medium">Insurance Provider</div>
            <div className="font-medium">
              {patient.insurance_provider || 'Not provided'}
            </div>
          </div>
          
          <div>
            <div className="text-muted-foreground text-sm font-medium">Insurance ID</div>
            <div className="flex items-center font-medium">
              <CreditCard className="text-muted-foreground mr-1 size-3" />
              {patient.insurance_id || 'Not provided'}
            </div>
          </div>
          
          <div>
            <div className="text-muted-foreground text-sm font-medium">Created</div>
            <div className="flex items-center font-medium">
              <CalendarCheck className="text-muted-foreground mr-1 size-3" />
              {formatDate(patient.created_at)}
            </div>
          </div>
          
          <div>
            <div className="text-muted-foreground text-sm font-medium">Last Updated</div>
            <div className="flex items-center font-medium">
              <CalendarCheck className="text-muted-foreground mr-1 size-3" />
              {formatDate(patient.updated_at)}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 