'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { format } from 'date-fns'
import {
  AlertCircle,
  Calendar,
  Eye,
  FileText,
  Filter,
  Search,
  Tag,
} from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

interface PatientDocument {
  id: string
  title: string
  category: string
  document_type: any
  file_type: string
  document_date: string
  processing_status: string
  is_processed: boolean
  created_at: string
  key_findings?: any
}

interface PatientDocumentsProps {
  patientId: string
  documents: PatientDocument[]
}

// Document view modes
type ViewMode = 'grid' | 'list' | 'compact'

// Document sort options
type SortOption =
  | 'dateDesc'
  | 'dateAsc'
  | 'titleAsc'
  | 'titleDesc'
  | 'statusAsc'
  | 'statusDesc'

export function PatientDocuments({
  patientId,
  documents = [],
}: PatientDocumentsProps) {
  const [searchText, setSearchText] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [sortBy, setSortBy] = useState<SortOption>('dateDesc')
  const [hasKeyFindings, setHasKeyFindings] = useState<boolean | null>(null)

  // Extract all unique categories, statuses, and document types for filters
  const allCategories = Array.from(
    new Set(documents.map((doc) => doc.category || 'other'))
  )
  const allStatuses = Array.from(
    new Set(documents.map((doc) => doc.processing_status))
  )
  const allTypes = Array.from(
    new Set(documents.map((doc) => doc.document_type?.type || 'unknown'))
  )

  // Apply filters and search
  const filteredDocuments = documents.filter((doc) => {
    if (!doc) return false

    // Text search (title and key findings)
    const titleMatch =
      !searchText || doc.title.toLowerCase().includes(searchText.toLowerCase())
    const keyFindingsMatch =
      !searchText ||
      (doc.key_findings &&
        (typeof doc.key_findings === 'string'
          ? doc.key_findings.toLowerCase().includes(searchText.toLowerCase())
          : JSON.stringify(doc.key_findings)
              .toLowerCase()
              .includes(searchText.toLowerCase())))
    const textMatch = titleMatch || keyFindingsMatch

    // Category filter
    const categoryMatch =
      selectedCategories.length === 0 ||
      selectedCategories.includes(doc.category || 'other')

    // Status filter
    const statusMatch =
      selectedStatuses.length === 0 ||
      selectedStatuses.includes(doc.processing_status)

    // Document type filter
    const typeMatch =
      selectedTypes.length === 0 ||
      selectedTypes.includes(doc.document_type?.type || 'unknown')

    // Key findings filter
    const keyFindingsFilterMatch =
      hasKeyFindings === null ||
      (hasKeyFindings === true &&
        doc.key_findings &&
        (typeof doc.key_findings === 'string'
          ? doc.key_findings.trim().length > 0
          : Object.keys(doc.key_findings).length > 0)) ||
      (hasKeyFindings === false &&
        (!doc.key_findings ||
          (typeof doc.key_findings === 'string'
            ? doc.key_findings.trim().length === 0
            : Object.keys(doc.key_findings).length === 0)))

    return (
      textMatch &&
      categoryMatch &&
      statusMatch &&
      typeMatch &&
      keyFindingsFilterMatch
    )
  })

  // Sort documents
  const sortedDocuments = [...filteredDocuments].sort((a, b) => {
    switch (sortBy) {
      case 'dateDesc':
        return (
          new Date(b.document_date || b.created_at).getTime() -
          new Date(a.document_date || a.created_at).getTime()
        )
      case 'dateAsc':
        return (
          new Date(a.document_date || a.created_at).getTime() -
          new Date(b.document_date || b.created_at).getTime()
        )
      case 'titleAsc':
        return a.title.localeCompare(b.title)
      case 'titleDesc':
        return b.title.localeCompare(a.title)
      case 'statusAsc':
        return a.processing_status.localeCompare(b.processing_status)
      case 'statusDesc':
        return b.processing_status.localeCompare(a.processing_status)
      default:
        return 0
    }
  })

  // Group documents by category
  const documentsByCategory = sortedDocuments.reduce(
    (acc, doc) => {
      if (!doc) return acc
      const category = doc.category || 'other'
      if (!acc[category]) acc[category] = []
      acc[category].push(doc)
      return acc
    },
    {} as Record<string, PatientDocument[]>
  )

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'complete':
        return 'success'
      case 'processing':
        return 'warning'
      case 'pending':
        return 'secondary'
      case 'error':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  const getDocumentIcon = (fileType: string) => {
    switch (fileType.toLowerCase()) {
      case 'pdf':
        return <FileText className="size-4 text-red-500" />
      case 'image/jpeg':
      case 'image/png':
        return <FileText className="size-4 text-blue-500" />
      default:
        return <FileText className="size-4" />
    }
  }

  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    )
  }

  const toggleStatus = (status: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status]
    )
  }

  const toggleType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    )
  }

  const clearAllFilters = () => {
    setSearchText('')
    setSelectedCategories([])
    setSelectedStatuses([])
    setSelectedTypes([])
    setHasKeyFindings(null)
  }

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground mb-4">No documents uploaded yet</p>
        <Button asChild>
          <Link href={`/dashboard/patients/${patientId}/documents/upload`}>
            Upload First Document
          </Link>
        </Button>
      </div>
    )
  }

  const renderDocumentGrid = (documents: PatientDocument[]) => (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {documents.map((doc) => (
        <Card className="overflow-hidden" key={doc.id}>
          <CardHeader className="pb-2">
            <div className="flex justify-between">
              <CardTitle
                className="truncate text-base font-medium"
                title={doc.title}
              >
                {doc.title}
              </CardTitle>
              <Badge
                className="capitalize"
                variant={getStatusBadgeVariant(doc.processing_status) as any}
              >
                {doc.processing_status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pb-2">
            <div className="grid grid-cols-2 gap-1 text-sm">
              <div className="text-muted-foreground flex items-center">
                <FileText className="mr-1 size-3" />
                Type:
              </div>
              <div className="capitalize">
                {doc.document_type?.type || 'Unknown'}
              </div>
              <div className="text-muted-foreground flex items-center">
                <Calendar className="mr-1 size-3" />
                Date:
              </div>
              <div>
                {doc.document_date
                  ? format(new Date(doc.document_date), 'PP')
                  : 'Unknown'}
              </div>
            </div>

            {doc.key_findings && (
              <div className="mt-2 text-sm">
                <div className="text-muted-foreground mb-1">Key Findings:</div>
                <p className="line-clamp-2">
                  {typeof doc.key_findings === 'string'
                    ? doc.key_findings
                    : JSON.stringify(doc.key_findings)}
                </p>
              </div>
            )}
          </CardContent>
          <CardFooter className="pt-2">
            <Button asChild className="w-full" size="sm" variant="outline">
              <Link
                href={`/dashboard/patients/${patientId}/documents/${doc.id}`}
              >
                <Eye className="mr-2 size-4" />
                View
              </Link>
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  )

  const renderDocumentList = (documents: PatientDocument[]) => (
    <div className="space-y-3">
      {documents.map((doc) => (
        <div className="flex flex-col rounded-md border p-3" key={doc.id}>
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getDocumentIcon(doc.file_type)}
              <h4 className="font-medium">{doc.title}</h4>
            </div>
            <Badge
              className="capitalize"
              variant={getStatusBadgeVariant(doc.processing_status) as any}
            >
              {doc.processing_status}
            </Badge>
          </div>

          <div className="mb-2 flex flex-wrap gap-4 text-sm">
            <div className="flex items-center">
              <Calendar className="text-muted-foreground mr-1 size-3" />
              {doc.document_date
                ? format(new Date(doc.document_date), 'PP')
                : 'Unknown date'}
            </div>
            <div className="flex items-center">
              <Tag className="text-muted-foreground mr-1 size-3" />
              <span className="capitalize">{doc.category || 'Other'}</span>
            </div>
            <div className="flex items-center">
              <FileText className="text-muted-foreground mr-1 size-3" />
              <span className="capitalize">
                {doc.document_type?.type || 'Unknown'}
              </span>
            </div>
          </div>

          {doc.key_findings && (
            <div className="mb-2 text-sm">
              <p className="text-muted-foreground mb-1 text-xs">
                Key Findings:
              </p>
              <p className="line-clamp-2">
                {typeof doc.key_findings === 'string'
                  ? doc.key_findings
                  : JSON.stringify(doc.key_findings)}
              </p>
            </div>
          )}

          <div className="text-right">
            <Button asChild size="sm" variant="outline">
              <Link
                href={`/dashboard/patients/${patientId}/documents/${doc.id}`}
              >
                <Eye className="mr-2 size-4" />
                View
              </Link>
            </Button>
          </div>
        </div>
      ))}
    </div>
  )

  const renderDocumentCompact = (documents: PatientDocument[]) => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-muted/50 border-b">
            <th className="whitespace-nowrap py-3 pl-4 text-left text-xs font-medium uppercase tracking-wider">
              Title
            </th>
            <th className="whitespace-nowrap py-3 text-left text-xs font-medium uppercase tracking-wider">
              Date
            </th>
            <th className="whitespace-nowrap py-3 text-left text-xs font-medium uppercase tracking-wider">
              Category
            </th>
            <th className="whitespace-nowrap py-3 text-left text-xs font-medium uppercase tracking-wider">
              Type
            </th>
            <th className="whitespace-nowrap py-3 text-left text-xs font-medium uppercase tracking-wider">
              Status
            </th>
            <th className="whitespace-nowrap py-3 pr-4 text-right text-xs font-medium uppercase tracking-wider">
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc, index) => (
            <tr
              className={`hover:bg-muted/50 ${index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}
              key={doc.id}
            >
              <td
                className="max-w-[200px] truncate py-3 pl-4 text-sm"
                title={doc.title}
              >
                {doc.title}
              </td>
              <td className="whitespace-nowrap py-3 text-sm">
                {doc.document_date
                  ? format(new Date(doc.document_date), 'PP')
                  : 'Unknown'}
              </td>
              <td className="py-3 text-sm capitalize">
                {doc.category || 'Other'}
              </td>
              <td className="py-3 text-sm capitalize">
                {doc.document_type?.type || 'Unknown'}
              </td>
              <td className="py-3 text-sm">
                <Badge
                  className="capitalize"
                  variant={getStatusBadgeVariant(doc.processing_status) as any}
                >
                  {doc.processing_status}
                </Badge>
              </td>
              <td className="py-3 pr-4 text-right text-sm">
                <Button asChild size="sm" variant="ghost">
                  <Link
                    href={`/dashboard/patients/${patientId}/documents/${doc.id}`}
                  >
                    <Eye className="size-4" />
                  </Link>
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Controls and Filters */}
      <div className="space-y-4">
        <div className="flex flex-wrap justify-between gap-4">
          {/* Search and View Mode */}
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <div className="relative max-w-md flex-1">
              <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
              <Input
                className="pl-10"
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search documents..."
                value={searchText}
              />
            </div>

            <Select
              onValueChange={(value) => setViewMode(value as ViewMode)}
              value={viewMode}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="View" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="grid">Grid View</SelectItem>
                <SelectItem value="list">List View</SelectItem>
                <SelectItem value="compact">Compact View</SelectItem>
              </SelectContent>
            </Select>

            <Select
              onValueChange={(value) => setSortBy(value as SortOption)}
              value={sortBy}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dateDesc">Newest First</SelectItem>
                <SelectItem value="dateAsc">Oldest First</SelectItem>
                <SelectItem value="titleAsc">Title (A-Z)</SelectItem>
                <SelectItem value="titleDesc">Title (Z-A)</SelectItem>
                <SelectItem value="statusAsc">Status (A-Z)</SelectItem>
                <SelectItem value="statusDesc">Status (Z-A)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Advanced Filters */}
          <Popover>
            <PopoverTrigger asChild>
              <Button className="flex items-center gap-1" variant="outline">
                <Filter className="size-4" />
                Filters
                {(selectedCategories.length > 0 ||
                  selectedStatuses.length > 0 ||
                  selectedTypes.length > 0 ||
                  hasKeyFindings !== null) && (
                  <Badge className="ml-1" variant="secondary">
                    {selectedCategories.length +
                      selectedStatuses.length +
                      selectedTypes.length +
                      (hasKeyFindings !== null ? 1 : 0)}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium">Categories</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {allCategories.map((category) => (
                      <div
                        className="flex items-center space-x-2"
                        key={category}
                      >
                        <Checkbox
                          checked={selectedCategories.includes(category)}
                          id={`category-${category}`}
                          onCheckedChange={() => toggleCategory(category)}
                        />
                        <Label
                          className="capitalize"
                          htmlFor={`category-${category}`}
                        >
                          {category}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <h4 className="font-medium">Status</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {allStatuses.map((status) => (
                      <div className="flex items-center space-x-2" key={status}>
                        <Checkbox
                          checked={selectedStatuses.includes(status)}
                          id={`status-${status}`}
                          onCheckedChange={() => toggleStatus(status)}
                        />
                        <Label
                          className="capitalize"
                          htmlFor={`status-${status}`}
                        >
                          {status}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <h4 className="font-medium">Document Types</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {allTypes.map((type) => (
                      <div className="flex items-center space-x-2" key={type}>
                        <Checkbox
                          checked={selectedTypes.includes(type)}
                          id={`type-${type}`}
                          onCheckedChange={() => toggleType(type)}
                        />
                        <Label className="capitalize" htmlFor={`type-${type}`}>
                          {type}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <h4 className="font-medium">Key Findings</h4>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={hasKeyFindings === true}
                        id="has-findings"
                        onCheckedChange={() =>
                          setHasKeyFindings(
                            hasKeyFindings === true ? null : true
                          )
                        }
                      />
                      <Label htmlFor="has-findings">Has key findings</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={hasKeyFindings === false}
                        id="no-findings"
                        onCheckedChange={() =>
                          setHasKeyFindings(
                            hasKeyFindings === false ? null : false
                          )
                        }
                      />
                      <Label htmlFor="no-findings">No key findings</Label>
                    </div>
                  </div>
                </div>

                <Button onClick={clearAllFilters} size="sm" variant="outline">
                  Clear All Filters
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex flex-wrap items-center justify-between">
          <div className="text-muted-foreground text-sm">
            {filteredDocuments.length}{' '}
            {filteredDocuments.length === 1 ? 'document' : 'documents'} found
          </div>

          {/* Active filters display */}
          {(selectedCategories.length > 0 ||
            selectedStatuses.length > 0 ||
            selectedTypes.length > 0 ||
            hasKeyFindings !== null) && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground text-xs">
                Active filters:
              </span>
              {selectedCategories.map((category) => (
                <Badge
                  className="cursor-pointer capitalize"
                  key={`cat-${category}`}
                  onClick={() => toggleCategory(category)}
                  variant="outline"
                >
                  {category} &times;
                </Badge>
              ))}
              {selectedStatuses.map((status) => (
                <Badge
                  className="cursor-pointer capitalize"
                  key={`status-${status}`}
                  onClick={() => toggleStatus(status)}
                  variant="outline"
                >
                  {status} &times;
                </Badge>
              ))}
              {selectedTypes.map((type) => (
                <Badge
                  className="cursor-pointer capitalize"
                  key={`type-${type}`}
                  onClick={() => toggleType(type)}
                  variant="outline"
                >
                  {type} &times;
                </Badge>
              ))}
              {hasKeyFindings !== null && (
                <Badge
                  className="cursor-pointer"
                  key="findings"
                  onClick={() => setHasKeyFindings(null)}
                  variant="outline"
                >
                  {hasKeyFindings ? 'Has findings' : 'No findings'} &times;
                </Badge>
              )}
              <Button
                className="h-6 px-2"
                onClick={clearAllFilters}
                size="sm"
                variant="ghost"
              >
                Clear all
              </Button>
            </div>
          )}
        </div>
      </div>

      {filteredDocuments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="text-muted-foreground mb-2 size-8" />
          <p className="text-muted-foreground">
            No documents match your filters
          </p>
          <Button
            className="mt-4"
            onClick={clearAllFilters}
            size="sm"
            variant="outline"
          >
            Clear All Filters
          </Button>
        </div>
      ) : viewMode !== 'compact' &&
        Object.keys(documentsByCategory).length > 0 ? (
        <Tabs
          className="w-full"
          defaultValue={Object.keys(documentsByCategory)[0]}
        >
          <TabsList className="flex flex-wrap">
            {Object.keys(documentsByCategory).map((category) => (
              <TabsTrigger
                className="capitalize"
                key={category}
                value={category}
              >
                {category} ({documentsByCategory[category].length})
              </TabsTrigger>
            ))}
          </TabsList>

          {Object.entries(documentsByCategory).map(([category, docs]) => (
            <TabsContent className="mt-6" key={category} value={category}>
              {viewMode === 'grid'
                ? renderDocumentGrid(docs)
                : renderDocumentList(docs)}
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        // Compact view or when no categories are present
        <div>
          {viewMode === 'grid'
            ? renderDocumentGrid(filteredDocuments)
            : viewMode === 'list'
              ? renderDocumentList(filteredDocuments)
              : renderDocumentCompact(filteredDocuments)}
        </div>
      )}
    </div>
  )
}
