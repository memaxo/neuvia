'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { useState } from 'react';
import { CheckCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';

// Define form schema with all fields from the database schema
const patientFormSchema = z.object({
  // Personal Information
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  gender: z.enum(['male', 'female', 'other']),
  preferredLanguage: z.string().min(2, 'Please select a language'),
  
  // Contact Information
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().min(10, 'Phone number must be at least 10 digits').optional().or(z.literal('')),
  addressLine1: z.string().optional().or(z.literal('')),
  addressLine2: z.string().optional().or(z.literal('')),
  city: z.string().optional().or(z.literal('')),
  state: z.string().optional().or(z.literal('')),
  postalCode: z.string().optional().or(z.literal('')),
  country: z.string().optional().or(z.literal('')),
  
  // Emergency Contact
  emergencyContactName: z.string().optional().or(z.literal('')),
  emergencyContactPhone: z.string().optional().or(z.literal('')),
  emergencyContactRelationship: z.string().optional().or(z.literal('')),
  
  // Medical Information
  bloodType: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown']).optional().default('Unknown'),
  allergies: z.string().optional().or(z.literal('')),
  currentMedications: z.string().optional().or(z.literal('')),
  conditions: z.string().optional().or(z.literal('')),
  
  // Administrative
  mrn: z.string().optional().or(z.literal('')),
  primaryCarePhysician: z.string().optional().or(z.literal('')),
  insuranceProvider: z.string().optional().or(z.literal('')),
  insuranceId: z.string().optional().or(z.literal('')),
});

type PatientFormValues = z.infer<typeof patientFormSchema>;

type FormStep = 'personal' | 'contact' | 'emergency' | 'medical' | 'administrative';

interface PatientFormProps {
  action: (formData: FormData) => Promise<void>;
}

export function PatientForm({ action }: PatientFormProps) {
  const [formStep, setFormStep] = useState<FormStep>('personal');
  
  const form = useForm<PatientFormValues>({
    resolver: zodResolver(patientFormSchema),
    defaultValues: {
      fullName: '',
      dateOfBirth: '',
      gender: 'other',
      preferredLanguage: 'en',
      email: '',
      phone: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      postalCode: '',
      country: '',
      emergencyContactName: '',
      emergencyContactPhone: '',
      emergencyContactRelationship: '',
      bloodType: 'Unknown',
      allergies: '',
      currentMedications: '',
      conditions: '',
      mrn: '',
      primaryCarePhysician: '',
      insuranceProvider: '',
      insuranceId: '',
    },
  });

  const goToNextStep = () => {
    const steps: FormStep[] = ['personal', 'contact', 'emergency', 'medical', 'administrative'];
    const currentIndex = steps.indexOf(formStep);
    const nextStep = steps[currentIndex + 1];
    if (nextStep) {
      setFormStep(nextStep);
    }
  };

  const goToPreviousStep = () => {
    const steps: FormStep[] = ['personal', 'contact', 'emergency', 'medical', 'administrative'];
    const currentIndex = steps.indexOf(formStep);
    const prevStep = steps[currentIndex - 1];
    if (prevStep) {
      setFormStep(prevStep);
    }
  };

  return (
    <Form {...form}>
      <form action={action} className="space-y-6">
        {/* Step navigation */}
        <nav className="mb-8 flex justify-between">
          <ol className="flex w-full">
            {[
              { label: 'Personal', value: 'personal' },
              { label: 'Contact', value: 'contact' },
              { label: 'Emergency', value: 'emergency' },
              { label: 'Medical', value: 'medical' },
              { label: 'Administrative', value: 'administrative' }
            ].map((step, index) => (
              <li className="flex w-full items-center" key={step.value}>
                <button
                  className={`flex w-full flex-col items-center ${index < ['personal', 'contact', 'emergency', 'medical', 'administrative'].indexOf(formStep) + 1 ? 'text-primary' : 'text-muted-foreground'}`}
                  onClick={() => setFormStep(step.value as FormStep)}
                  type="button"
                >
                  <div className={`mb-2 flex size-8 items-center justify-center rounded-full ${step.value === formStep ? 'bg-primary text-white' : index < ['personal', 'contact', 'emergency', 'medical', 'administrative'].indexOf(formStep) + 1 ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    {index < ['personal', 'contact', 'emergency', 'medical', 'administrative'].indexOf(formStep) ? <CheckCircle className="size-5" /> : index + 1}
                  </div>
                  <span className="text-xs">{step.label}</span>
                </button>
                {index < 4 && (
                  <div className={`mx-2 h-px flex-1 ${index < ['personal', 'contact', 'emergency', 'medical', 'administrative'].indexOf(formStep) ? 'bg-primary' : 'bg-muted'}`} />
                )}
              </li>
            ))}
          </ol>
        </nav>
        
        {/* Personal Information (Step 1) */}
        {formStep === 'personal' && (
          <Card className="p-6">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Personal Information</h2>
              <p className="text-muted-foreground text-sm">Enter the patient's basic personal information.</p>
              
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dateOfBirth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Birth</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gender</FormLabel>
                      <Select defaultValue={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select gender" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="preferredLanguage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preferred Language</FormLabel>
                      <Select defaultValue={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select language" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="es">Spanish</SelectItem>
                          <SelectItem value="fr">French</SelectItem>
                          <SelectItem value="de">German</SelectItem>
                          <SelectItem value="zh">Chinese</SelectItem>
                          <SelectItem value="ja">Japanese</SelectItem>
                          <SelectItem value="ar">Arabic</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="mt-4 flex justify-end">
                <Button onClick={goToNextStep} type="button">Next: Contact Information</Button>
              </div>
            </div>
          </Card>
        )}
        
        {/* Contact Information (Step 2) */}
        {formStep === 'contact' && (
          <Card className="p-6">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Contact Information</h2>
              <p className="text-muted-foreground text-sm">Enter the patient's contact details.</p>
              
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input placeholder="patient@example.com" type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input placeholder="(555) 123-4567" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="addressLine1"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Address Line 1</FormLabel>
                      <FormControl>
                        <Input placeholder="123 Main St" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="addressLine2"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Address Line 2</FormLabel>
                      <FormControl>
                        <Input placeholder="Apt 4B" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input placeholder="Anytown" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State/Province</FormLabel>
                      <FormControl>
                        <Input placeholder="State" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="postalCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Postal Code</FormLabel>
                      <FormControl>
                        <Input placeholder="12345" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country</FormLabel>
                      <FormControl>
                        <Input placeholder="Country" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="mt-4 flex justify-between">
                <Button onClick={goToPreviousStep} type="button" variant="outline">Back</Button>
                <Button onClick={goToNextStep} type="button">Next: Emergency Contact</Button>
              </div>
            </div>
          </Card>
        )}
        
        {/* Emergency Contact (Step 3) */}
        {formStep === 'emergency' && (
          <Card className="p-6">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Emergency Contact</h2>
              <p className="text-muted-foreground text-sm">Provide emergency contact information for the patient.</p>
              
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="emergencyContactName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Emergency Contact Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Jane Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="emergencyContactPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Emergency Contact Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="(555) 123-4567" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="emergencyContactRelationship"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Relationship to Patient</FormLabel>
                      <FormControl>
                        <Input placeholder="Spouse, Parent, etc." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="mt-4 flex justify-between">
                <Button onClick={goToPreviousStep} type="button" variant="outline">Back</Button>
                <Button onClick={goToNextStep} type="button">Next: Medical Information</Button>
              </div>
            </div>
          </Card>
        )}
        
        {/* Medical Information (Step 4) */}
        {formStep === 'medical' && (
          <Card className="p-6">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Medical Information</h2>
              <p className="text-muted-foreground text-sm">Enter the patient's basic medical information.</p>
              
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="bloodType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Blood Type</FormLabel>
                      <Select defaultValue={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select blood type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="A+">A+</SelectItem>
                          <SelectItem value="A-">A-</SelectItem>
                          <SelectItem value="B+">B+</SelectItem>
                          <SelectItem value="B-">B-</SelectItem>
                          <SelectItem value="AB+">AB+</SelectItem>
                          <SelectItem value="AB-">AB-</SelectItem>
                          <SelectItem value="O+">O+</SelectItem>
                          <SelectItem value="O-">O-</SelectItem>
                          <SelectItem value="Unknown">Unknown</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="col-span-2">
                  <FormField
                    control={form.control}
                    name="allergies"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Allergies</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="List any known allergies, one per line" 
                            {...field}
                            className="min-h-[100px]" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="col-span-2">
                  <FormField
                    control={form.control}
                    name="currentMedications"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current Medications</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="List current medications, dosages, and frequency" 
                            {...field}
                            className="min-h-[100px]" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="col-span-2">
                  <FormField
                    control={form.control}
                    name="conditions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Known Medical Conditions</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="List any known medical conditions or diagnoses" 
                            {...field}
                            className="min-h-[100px]" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              
              <div className="mt-4 flex justify-between">
                <Button onClick={goToPreviousStep} type="button" variant="outline">Back</Button>
                <Button onClick={goToNextStep} type="button">Next: Administrative</Button>
              </div>
            </div>
          </Card>
        )}
        
        {/* Administrative Information (Step 5) */}
        {formStep === 'administrative' && (
          <Card className="p-6">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Administrative Information</h2>
              <p className="text-muted-foreground text-sm">Enter administrative and insurance details.</p>
              
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="mrn"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Medical Record Number (MRN)</FormLabel>
                      <FormControl>
                        <Input placeholder="Leave blank to auto-generate" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="primaryCarePhysician"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary Care Physician</FormLabel>
                      <FormControl>
                        <Input placeholder="Dr. Jane Smith" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="insuranceProvider"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Insurance Provider</FormLabel>
                      <FormControl>
                        <Input placeholder="Insurance Company" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="insuranceId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Insurance ID</FormLabel>
                      <FormControl>
                        <Input placeholder="123456789" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="mt-4 flex justify-between">
                <Button onClick={goToPreviousStep} type="button" variant="outline">Back</Button>
                <Button className="bg-primary" type="submit">Create Patient Record</Button>
              </div>
            </div>
          </Card>
        )}
      </form>
    </Form>
  );
} 