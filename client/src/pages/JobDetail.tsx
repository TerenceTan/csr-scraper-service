
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Loader2, Download, FileSpreadsheet, FileText, ChevronDown, ChevronUp, Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useRoute, Link } from "wouter";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export default function JobDetail() {
  const [, params] = useRoute("/job/:id");
  const jobId = params?.id ? parseInt(params.id) : null;

  const jobQuery = trpc.scraping.getJob.useQuery(
    { jobId: jobId! },
    { enabled: jobId !== null, refetchInterval: 5000 }
  );

  const updateSectionMutation = trpc.scraping.updateSection.useMutation({
    onSuccess: () => {
      toast.success("Content updated");
      jobQuery.refetch();
    },
    onError: (error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  const exportExcelMutation = trpc.scraping.exportExcel.useMutation({
    onSuccess: (data) => {
      // Convert base64 to blob and download
      const byteCharacters = atob(data.data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Excel file downloaded");
    },
    onError: (error) => {
      toast.error(`Export failed: ${error.message}`);
    },
  });

  const exportCSVMutation = trpc.scraping.exportCSV.useMutation({
    onSuccess: (data) => {
      const blob = new Blob([data.data], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("CSV file downloaded");
    },
    onError: (error) => {
      toast.error(`Export failed: ${error.message}`);
    },
  });

  const [editingSection, setEditingSection] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [openPages, setOpenPages] = useState<Record<number, boolean>>({});

  const handleEditSection = (sectionId: number, content: string) => {
    setEditingSection(sectionId);
    setEditContent(content);
  };

  const handleSaveSection = (sectionId: number) => {
    updateSectionMutation.mutate({ sectionId, content: editContent });
    setEditingSection(null);
  };

  const handleCancelEdit = () => {
    setEditingSection(null);
    setEditContent("");
  };

  const togglePage = (pageId: number) => {
    setOpenPages((prev) => ({ ...prev, [pageId]: !prev[pageId] }));
  };

  if (!jobId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Invalid job ID</p>
      </div>
    );
  }

  if (jobQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (jobQuery.error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600">{jobQuery.error.message}</p>
            <Button asChild className="mt-4">
              <Link href="/">Back to Home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!jobQuery.data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const { job, pages } = jobQuery.data;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container py-8">
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" className="mb-4">
              ← Back to Jobs
            </Button>
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Job #{job.id}</h1>
              <p className="text-gray-600 mt-1">
                Status: {job.status} • {job.completedUrls} / {job.totalUrls} URLs completed
                {job.failedUrls > 0 && ` • ${job.failedUrls} failed`}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => exportExcelMutation.mutate({ jobId })}
                disabled={exportExcelMutation.isPending || job.status !== "completed"}
                variant="default"
              >
                {exportExcelMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                )}
                Export Excel
              </Button>
              <Button
                onClick={() => exportCSVMutation.mutate({ jobId })}
                disabled={exportCSVMutation.isPending || job.status !== "completed"}
                variant="outline"
              >
                {exportCSVMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="mr-2 h-4 w-4" />
                )}
                Export CSV
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {pages.map((page) => (
            <Card key={page.id}>
              <Collapsible open={openPages[page.id]} onOpenChange={() => togglePage(page.id)}>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">
                          {page.pageTitle || "Untitled Page"}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {page.url}
                        </CardDescription>
                        <p className="text-sm text-muted-foreground mt-1">
                          {page.sections.length} sections • Status: {page.status}
                        </p>
                      </div>
                      {openPages[page.id] ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-3">
                    {page.sections.map((section) => (
                      <div key={section.id} className="border rounded-lg p-4 bg-white">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                                {section.sectionType}
                              </span>
                              {section.sectionTitle && (
                                <span className="text-sm font-medium text-gray-700">
                                  {section.sectionTitle}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {section.charCount} characters
                            </p>
                          </div>
                          {editingSection !== section.id && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditSection(section.id, section.content)}
                            >
                              Edit
                            </Button>
                          )}
                        </div>
                        {editingSection === section.id ? (
                          <div className="space-y-2">
                            <Textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              rows={4}
                              className="font-sans"
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleSaveSection(section.id)}
                                disabled={updateSectionMutation.isPending}
                              >
                                {updateSectionMutation.isPending ? (
                                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                ) : (
                                  <Save className="mr-2 h-3 w-3" />
                                )}
                                Save
                              </Button>
                              <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">
                            {section.content}
                          </p>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
