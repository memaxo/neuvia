'use client'

import React from 'react';
import { cn } from '@/lib/utils';

import type { DocumentAnalysis } from '../types';

interface DocumentAnalysisProps {
  analysis: DocumentAnalysis;
}

export function DocumentAnalysis({ analysis }: DocumentAnalysisProps) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 p-6 backdrop-blur-xl">
      <h3 className="mb-4 text-xl font-bold text-white">Document Analysis</h3>
      <div className="space-y-3 text-sm text-white/70">
        <p>
          <strong>Patient Name:</strong> {analysis.patientName}
        </p>
        <p>
          <strong>Symptoms Detected:</strong> {analysis.symptoms.join(', ')}
        </p>
        {analysis.diagnosis && (
          <p>
            <strong>Preliminary Diagnosis:</strong> {analysis.diagnosis}
          </p>
        )}
        {analysis.extractedData && (
          <div>
            <strong>Additional Data:</strong>
            <ul className="ml-4 list-disc">
              {Object.entries(analysis.extractedData).map(([key, value]) => (
                <li key={key}>
                  {key}: {value}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}