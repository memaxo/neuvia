'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Laptop, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  PieChart as PieChartIcon 
} from 'lucide-react';

interface DocumentStats {
  byCategory: Array<{ category: string; count: string }>;
  byStatus: Array<{ processing_status: string; count: string }>;
  total: number;
  patientId: string;
}

interface PatientDocumentStatsProps {
  stats: DocumentStats;
}

export function PatientDocumentStats({ stats }: PatientDocumentStatsProps) {
  // Function to get appropriate icon and color for document status
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return <CheckCircle2 className="size-4 text-green-500" />;
      case 'processing':
        return <Clock className="size-4 text-yellow-500" />;
      case 'pending':
        return <Clock className="size-4 text-blue-500" />;
      case 'error':
        return <AlertCircle className="size-4 text-red-500" />;
      default:
        return <FileText className="size-4 text-gray-500" />;
    }
  };
  
  // Function to get appropriate icon and color for document category
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'clinical':
        return <FileText className="size-4 text-blue-500" />;
      case 'lab':
        return <Laptop className="size-4 text-green-500" />;
      case 'imaging':
        return <PieChartIcon className="size-4 text-purple-500" />;
      case 'prescription':
        return <FileText className="size-4 text-orange-500" />;
      case 'administrative':
        return <FileText className="size-4 text-gray-500" />;
      default:
        return <FileText className="size-4 text-gray-500" />;
    }
  };
  
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
      {/* Total Documents */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
          <FileText className="text-muted-foreground size-4" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.total}</div>
          <p className="text-muted-foreground text-xs">
            {stats.total === 0
              ? "No documents uploaded yet"
              : stats.total === 1
              ? "1 document in patient record"
              : `${stats.total} documents in patient record`}
          </p>
        </CardContent>
      </Card>
      
      {/* Documents by Category */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">By Category</CardTitle>
          <PieChartIcon className="text-muted-foreground size-4" />
        </CardHeader>
        <CardContent className="space-y-2">
          {stats.byCategory.length === 0 ? (
            <p className="text-muted-foreground text-xs">No document categories yet</p>
          ) : (
            <div className="space-y-2">
              {stats.byCategory.map(category => (
                <div className="flex items-center justify-between" key={category.category}>
                  <div className="flex items-center gap-1 text-sm">
                    {getCategoryIcon(category.category)}
                    <span className="capitalize">{category.category}</span>
                  </div>
                  <span className="text-sm font-medium">{category.count}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Documents by Status */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">By Status</CardTitle>
          <CheckCircle2 className="text-muted-foreground size-4" />
        </CardHeader>
        <CardContent className="space-y-2">
          {stats.byStatus.length === 0 ? (
            <p className="text-muted-foreground text-xs">No document statuses yet</p>
          ) : (
            <div className="space-y-2">
              {stats.byStatus.map(status => (
                <div className="flex items-center justify-between" key={status.processing_status}>
                  <div className="flex items-center gap-1 text-sm">
                    {getStatusIcon(status.processing_status)}
                    <span className="capitalize">{status.processing_status}</span>
                  </div>
                  <span className="text-sm font-medium">{status.count}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Latest Activity */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Latest Activity</CardTitle>
          <Clock className="text-muted-foreground size-4" />
        </CardHeader>
        <CardContent className="space-y-2">
          {stats.total === 0 ? (
            <p className="text-muted-foreground text-xs">No document activity yet</p>
          ) : (
            <div className="space-y-2">
              <div className="text-sm">
                Last document: <span className="font-medium">Recently</span>
              </div>
              <div className="text-sm">
                Most recent status: <span className="font-medium capitalize">
                  {stats.byStatus.length > 0 ? stats.byStatus[0].processing_status : 'None'}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 